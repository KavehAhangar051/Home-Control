/**
 * @file main.cpp
 * @brief Achaemenid IoT Node — Event-Driven Architecture
 *
 * بهینه‌سازی‌های اعمال‌شده روی loop() (Memory-for-Speed):
 *  1. IRAM_ATTR روی loop() — حذف flash cache miss در hot path
 *  2. LoopFn Dispatch Table — حذف null-check pointer هر سیکل
 *  3. Pre-cached Callbacks — حذف StaticFunction::bind() از hot path
 *  4. CCOUNT Throttle — wsServer/wsClient هر 1ms و Watchdog/OTA health هر 500ms
 */

#include <Arduino.h>
#include <core/Globals.h>
#include <setup/SystemSetup.h>
#include <BootManager.h>
#include <RuleEngine.h>
#include <Utilities/logging.h>
#include <AppEvents.h>
#include "events/EventHandlers.h"
#include <setup/NetworkStorage.h>
#include <core/WebSocketServer.h>
#include <core/WebSocketClient.h>
#include <NvsSegmentStorage.h>
#include <NvsAuxNodeStorage.h>
#include "core/LoopOptimizer.h"

// ============================================================================
// Stack size override
// ============================================================================
// Override weak Arduino-ESP32 loopTask stack size (default 8KB → 16KB)
size_t getArduinoLoopTaskStackSize(void) {
  return 10240;
}

// ============================================================================
// روش ۳: Pre-cached Callback definitions (فقط یکبار در setup)
// ============================================================================

/**
 * @brief Digital input callback — در DRAM ذخیره، در loop() مستقیم فراخوانی می‌شه
 * بدون هیچ StaticFunction::bind() در هر iteration
 */
static void onInputChanged_cached(int pin, bool state, unsigned long dur, const RuleConfig& r) {
  PinStateChangedEvent changed{pin, state, false, PinStateChangeOrigin::PhysicalInput};
  eventBus.dispatch(changed);
  if (ruleEngine) ruleEngine->handleInput(pin, state, dur, r);
}

/**
 * @brief Analog input callback — مستقیم از LUT، بدون bind overhead
 */
static void onAnalogChanged_cached(const AnalogInputChange& ch, const RuleConfig& r) {
  if (ch.valueChanged || ch.thresholdChanged) {
    PinStateChangedEvent changed{
        ch.pin,       ch.thresholdState, false, PinStateChangeOrigin::PhysicalInput, static_cast<int16_t>(ch.value),
        ch.resolution};
    eventBus.dispatch(changed);
  }
  if (ch.rangeMaskChanged && ruleEngine) {
    ruleEngine->handleAnalogInput(ch, r);
  }
  if (ch.thresholdChanged) {
    if (ruleEngine) ruleEngine->handleInput(ch.pin, ch.thresholdState, ch.durationSec, r);
  } else if (ch.valueChanged && !ch.rangeMaskChanged && ruleEngine) {
    ruleEngine->scheduleCloudSync(ch.pin);
  }
}

// ============================================================================
// روش ۲: Loop Service wrappers برای dispatch table
// ============================================================================

/** Wrapper برای bootManager->loop() — بدون null-check در loop اصلی */
static LOOP_IRAM_ATTR void bootManagerLoopFn() {
  bootManager->loop();
}

/** Wrapper برای wsServer/wsClient — با CCOUNT throttle (روش ۴) */
static LOOP_IRAM_ATTR void wsLoopFn() {
  // روش ۴: فقط اگر 1ms گذشته باشه poll کن
  if (UNLIKELY(uniuno::isWsPollDue())) {
    wsServer->loop();
    wsClient->loop();
  }
}

/** Wrapper برای Task Watchdog و تایید پایداری OTA — هر 500ms یکبار */
static LOOP_IRAM_ATTR void watchdogLoopFn() {
  if (UNLIKELY(uniuno::isWatchdogFeedDue())) {
    pollWatchdogAndOtaHealth();
  }
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==========================================");
  Serial.println("  Achaemenid IoT Node - Modular Async     ");
  Serial.println("==========================================");

  setupErrorHandler();
  setupWatchdog(15);
  setupEventBus();
  setupNetworkAndTime();
  setupTimer();
  if (appTimer != nullptr) {
    appTimer->startHardwareTimer(1000);
    INFO("[System] Hardware timer started at 1ms resolution.");
  }
  setupMqtt();
  setupWebSocket();
  setupRuleEngine();

  // Load Network Configuration from NVS
  String savedSSID[5];
  String savedPass[5];
  int savedCount = 0;
  MqttConfig savedMqtt;
  loadNetworkConfig(savedSSID, savedPass, savedCount, savedMqtt);

  if (savedCount > 0) {
    INFOF("[System] Found %d saved WiFi networks in NVS", savedCount);
    for (int i = 0; i < savedCount; i++) {
      ::network->add_access_point(savedSSID[i].c_str(), savedPass[i].c_str());
    }
  }

  if (savedMqtt.valid) {
    mqttClient.begin(String(savedMqtt.host), savedMqtt.port, String(savedMqtt.baseTopic), savedMqtt.qos,
                     String(savedMqtt.user), String(savedMqtt.password));
    mqttClient.subscribe(String(savedMqtt.baseTopic) + "/Command");
    INFOF("[System] Restored MQTT settings from NVS (Host: %s)", savedMqtt.host);
  } else {
    mqttClient.begin("broker.emqx.io", 1883, "KamyarIoT/Achaemenid", 1, "", "");
    mqttClient.subscribe("KamyarIoT/Achaemenid/Command");
    WARNING("[System] No MQTT settings in NVS. Configured fallback broker independently of Cloudflare.");
  }

  INFO("[System] Setup completed. Starting Async Boot Sequence...");

  static uniuno::NvsSegmentStorage segmentStorageInstance;
  static uniuno::NvsAuxNodeStorage auxNodeStorageInstance;
  static BootManager bootManagerInstance;
  segmentStorage = &segmentStorageInstance;
  auxNodeStorage = &auxNodeStorageInstance;
  bootManager = &bootManagerInstance;

  BootContext bootCtx = {::network,      &pinManager,   &executor,         &eventBus,       appTimer,
                         segmentStorage, &configLoaded, &rawConfigPayload, &auxNodeManager, auxNodeStorage};
  bootManager->startBootSequenceAsync(bootCtx);

  // -------------------------------------------------------------------------
  // روش ۳: Pre-cache کردن callbacks — یکبار در setup()
  // از makeStaticFunction برای plain function pointer استفاده می‌کنیم
  // -------------------------------------------------------------------------
  uniuno::s_cachedInputCb = uniuno::makeStaticFunction(&onInputChanged_cached);
  uniuno::s_cachedAnalogCb = uniuno::makeStaticFunction(&onAnalogChanged_cached);
  uniuno::s_callbacksCached = true;
  INFO("[Loop] Callbacks pre-cached.");

  // -------------------------------------------------------------------------
  // روش ۲: ثبت سرویس‌ها در dispatch table
  // -------------------------------------------------------------------------
  if (bootManager) uniuno::registerLoopService(&bootManagerLoopFn);
  if (wsServer && wsClient) uniuno::registerLoopService(&wsLoopFn);
  uniuno::registerLoopService(&watchdogLoopFn);

  INFO("[Loop] Dispatch table built.");
}

// ============================================================================
// LOOP — بهینه‌سازی‌شده
// ============================================================================

/**
 * @brief تابع loop اصلی — IRAM_ATTR (روش ۱)
 *
 * ترتیب اجرا:
 *  ① executor.poll()          — Bitmask Xtensa, بدون overhead
 *  ② Loop dispatch table      — بدون null-check (روش ۲: boot, WS 1ms, WDT/OTA 500ms)
 *  ③ processInputs            — با pre-cached callback (روش ۳)
 *  ④ processAnalogInputs      — با pre-cached callback (روش ۳)
 */
LOOP_IRAM_ATTR void loop() {
  // ① Executor poll — Xtensa NSA bitmask، 2 cycle idle
  executor.poll();

  // ② Loop services dispatch — بدون null-check، بدون branch miss
  // wsServer و wsClient داخل wsLoopFn با CCOUNT throttle (روش ۴) هستن
  for (uint8_t i = 0; i < uniuno::s_loopTableSize; i++) {
    uniuno::s_loopTable[i]();
  }

  // ③④ Input processing — با pre-cached callbacks (روش ۳)
  // hasInputsChanged و hasAnalogInputsDue قبلاً UNLIKELY fast-path دارن
  if (ruleEngine) {
    pinManager.processInputs(uniuno::s_cachedInputCb);
    pinManager.processAnalogInputs(uniuno::s_cachedAnalogCb);
  }
}
