/**
 * @file main.cpp
 * @brief Achaemenid IoT Node — Event-Driven Architecture
 *
 * بهینه‌سازی‌های اعمال‌شده روی loop() (Memory-for-Speed):
 *  1. IRAM_ATTR روی loop() — حذف flash cache miss در hot path
 *  2. Inline Fast-Gates در IRAM — حذف callx8 غیرمستقیم و فراخوانی Flash در تیک‌های
 * عادی
 *  3. Pre-cached Callbacks — حذف StaticFunction::bind() از hot path
 *  4. CCOUNT Throttle — wsServer/wsClient و Watchdog/OTA health با توکن‌های ProjectConfig.h
 */

#include <Arduino.h>
#include <ProjectConfig.h>
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
// Override weak Arduino-ESP32 loopTask stack size (configured via ProjectConfig.h)
size_t getArduinoLoopTaskStackSize(void) {
  return ACHAEMENID_LOOP_TASK_STACK_SIZE;
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
// Cold out-of-line WebSocket poll slow path (runs at most once per WS interval)
// ============================================================================
static __attribute__((noinline)) void pollWebSocketsSlowPath() {
  if (wsServer) wsServer->loop();
  if (wsClient) wsClient->loop();
}

static void startLocalWebSocketServer() {
  if (wsServer) wsServer->begin(81);
}

// ============================================================================
// SETUP
// ============================================================================

void setup() {
  Serial.begin(ACHAEMENID_SERIAL_BAUD);
  delay(ACHAEMENID_BOOT_DELAY_MS);

  Serial.println("\n==========================================");
  Serial.println("  Achaemenid IoT Node - Modular Async     ");
  Serial.println("==========================================");

  setupErrorHandler();
  setupWatchdog(ACHAEMENID_WDT_TIMEOUT_SEC);
  setupEventBus();
  setupNetworkAndTime();
  setupTimer();
  if (appTimer != nullptr) {
    appTimer->startHardwareTimer(ACHAEMENID_HW_TIMER_RESOLUTION_US);
    INFO("[System] Hardware timer started at 1ms resolution.");
  }
  setupMqtt();
  setupWebSocket();
  setupRuleEngine();

  // Load Network Configuration from NVS
  String savedSSID[ACHAEMENID_MAX_SAVED_WIFI_NETWORKS];
  String savedPass[ACHAEMENID_MAX_SAVED_WIFI_NETWORKS];
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
    mqttClient.subscribe(String(savedMqtt.baseTopic) + ACHAEMENID_FALLBACK_MQTT_COMMAND_SUFFIX);
    INFOF("[System] Restored MQTT settings from NVS (Host: %s)", savedMqtt.host);
  } else {
    mqttClient.begin(ACHAEMENID_FALLBACK_MQTT_HOST, ACHAEMENID_FALLBACK_MQTT_PORT, ACHAEMENID_FALLBACK_MQTT_TOPIC,
                     ACHAEMENID_FALLBACK_MQTT_QOS, ACHAEMENID_FALLBACK_MQTT_USER, ACHAEMENID_FALLBACK_MQTT_PASS);
    mqttClient.subscribe(ACHAEMENID_FALLBACK_MQTT_TOPIC ACHAEMENID_FALLBACK_MQTT_COMMAND_SUFFIX);
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
  bootCtx.startLocalWebSocketServer = &startLocalWebSocketServer;
  bootManager->startBootSequenceAsync(bootCtx);

  // -------------------------------------------------------------------------
  // Pre-cache کردن callbacks — یکبار در setup()
  // -------------------------------------------------------------------------
  uniuno::s_cachedInputCb = uniuno::makeStaticFunction(&onInputChanged_cached);
  uniuno::s_cachedAnalogCb = uniuno::makeStaticFunction(&onAnalogChanged_cached);
  INFO("[Loop] Callbacks pre-cached.");
}

// ============================================================================
// LOOP — 100% IRAM steady-state fast-path (Zero indirect calls, zero Flash misses)
// ============================================================================

LOOP_IRAM_ATTR void loop() {
  // ① Executor poll — Xtensa NSA bitmask (~2 cycles idle, 100% IRAM)
  executor.poll();

  // ② BootManager WiFi health / Captive Portal — inline ~4-cycle IRAM fast-gate
  if (UNLIKELY(bootManager->isPollDue())) {
    bootManager->loop();
  }

  // ③ WebSocket server/client — inline 3-cycle CCOUNT 1ms fast-gate
  if (UNLIKELY(uniuno::isWsPollDue())) {
    pollWebSocketsSlowPath();
  }

  // ④ Task Watchdog + OTA stability — inline 3-cycle CCOUNT 500ms fast-gate
  if (UNLIKELY(uniuno::isWatchdogFeedDue())) {
    pollWatchdogAndOtaHealth();
  }

  // ⑤⑥ Digital & Analog inputs — single-pass APB GPIO poll + direct StaticFunction
  pinManager.processInputs(uniuno::s_cachedInputCb);
  pinManager.processAnalogInputs(uniuno::s_cachedAnalogCb);
}
