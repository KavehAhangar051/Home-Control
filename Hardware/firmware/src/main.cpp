/**
 * @file main.cpp
 * @brief Achaemenid IoT Node — Event-Driven Architecture
 *
 * بهینه‌سازی‌های اعمال‌شده روی loop() (Memory-for-Speed):
 *  1. IRAM_ATTR روی loop() — حذف flash cache miss در hot path
 *  2. LoopFn Dispatch Table — حذف null-check pointer هر سیکل
 *  3. Pre-cached Callbacks — حذف StaticFunction::bind() از hot path
 *  4. CCOUNT Throttle — wsServer/wsClient هر 1ms (نه هر iteration)
 *  5. GPIO Shadow Bitmask — REG_READ مستقیم در LoopOptimizer
 *  6. Pin Dispatch LUT — O(1) indexed dispatch بدون RuleEngine search
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
#include "core/LoopOptimizer.h"

// ============================================================================
// Stack size override
// ============================================================================
// Override weak Arduino-ESP32 loopTask stack size (default 8KB → 16KB)
size_t getArduinoLoopTaskStackSize(void) {
    return 16384;
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
            ch.pin,
            ch.thresholdState,
            false,
            PinStateChangeOrigin::PhysicalInput,
            static_cast<int16_t>(ch.value),
            ch.resolution
        };
        eventBus.dispatch(changed);
    }
    if (ch.rangeMaskChanged) {
        if (ruleEngine) ruleEngine->handleAnalogInput(ch, r);
    }
    if (ch.thresholdChanged) {
        if (ruleEngine) ruleEngine->handleInput(ch.pin, ch.thresholdState, ch.durationSec, r);
    } else if (ch.valueChanged && !ch.rangeMaskChanged) {
        if (ruleEngine) ruleEngine->scheduleCloudSync(ch.pin);
    }
}

// ============================================================================
// روش ۶: LUT — توابع dispatch که از جدول فراخوانی می‌شن
// ============================================================================

/**
 * @brief ساخت (یا بازسازی) جدول Pin Dispatch LUT
 * باید یکبار بعد از اینکه segmentها load شدن فراخوانی بشه
 * (در setup() و بعد از هر ConfigLoadedEvent)
 */
static void rebuildPinDispatchLUT() {
    memset(uniuno::s_pinDispatchLUT, 0, sizeof(uniuno::s_pinDispatchLUT));

    for (uint8_t pin = 0; pin < uniuno::ESP32_GPIO_COUNT; pin++) {
        bool isDigital = false;
        bool isAnalog  = false;

        // بررسی نوع pin از طریق PinManager
        // isAnalogInputPin و isDigitalInputPin از state manager
        if (pinManager.isAnalogInputPin(static_cast<int>(pin))) {
            isAnalog = true;
        }
        // برای digital input: pin باید در mask باشه ولی analog نباشه
        // از طریق rule check می‌کنیم — اگر rule داره و analog نیست، digital input هست
        if (!isAnalog) {
            RuleConfig rule = pinManager.getRuleByPin(static_cast<int>(pin));
            if (rule.active || rule.highActionCount > 0 || rule.lowActionCount > 0) {
                isDigital = true;
            }
        }

        if (isDigital) {
            uniuno::s_pinDispatchLUT[pin].onDigitalChange = &onInputChanged_cached;
            uniuno::s_pinDispatchLUT[pin].active = true;
        }
        if (isAnalog) {
            uniuno::s_pinDispatchLUT[pin].onAnalogChange = &onAnalogChanged_cached;
            uniuno::s_pinDispatchLUT[pin].active = true;
        }
    }

    uniuno::s_lutBuilt = true;
    INFO("[Loop] Pin Dispatch LUT rebuilt.");
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
        mqttClient.begin(String(savedMqtt.host), savedMqtt.port, String(savedMqtt.baseTopic), savedMqtt.qos, "", "");
        mqttClient.subscribe(String(savedMqtt.baseTopic) + "/Command");
        INFOF("[System] Restored MQTT settings from NVS (Host: %s)", savedMqtt.host);
    } else {
        mqttClient.begin("broker.emqx.io", 1883, "KamyarIoT/Achaemenid", 1, "", "");
        mqttClient.subscribe("KamyarIoT/Achaemenid/Command");
        WARNING("[System] No MQTT settings in NVS. Configured fallback broker independently of Cloudflare.");
    }

    INFO("[System] Setup completed. Starting Async Boot Sequence...");

    segmentStorage = new uniuno::NvsSegmentStorage();
    bootManager    = new BootManager();

    BootContext bootCtx = {
        ::network,
        &pinManager,
        &executor,
        &eventBus,
        appTimer,
        segmentStorage,
        &configLoaded,
        &rawConfigPayload
    };
    bootManager->startBootSequenceAsync(bootCtx);

    // -------------------------------------------------------------------------
    // روش ۳: Pre-cache کردن callbacks — یکبار در setup()
    // از makeStaticFunction برای plain function pointer استفاده می‌کنیم
    // -------------------------------------------------------------------------
    uniuno::s_cachedInputCb  = uniuno::makeStaticFunction(&onInputChanged_cached);
    uniuno::s_cachedAnalogCb = uniuno::makeStaticFunction(&onAnalogChanged_cached);
    uniuno::s_callbacksCached = true;
    INFO("[Loop] Callbacks pre-cached.");

    // -------------------------------------------------------------------------
    // روش ۶: ساخت اولیه LUT (بعد از load بیشتر داده می‌شه)
    // -------------------------------------------------------------------------
    rebuildPinDispatchLUT();

    // -------------------------------------------------------------------------
    // روش ۲: ثبت سرویس‌ها در dispatch table
    // bootManager همیشه بعد از init وجود داره
    // wsServer و wsClient هم در setupWebSocket ساخته شدن
    // -------------------------------------------------------------------------
    if (bootManager) uniuno::registerLoopService(&bootManagerLoopFn);
    if (wsServer && wsClient) uniuno::registerLoopService(&wsLoopFn);

    INFO("[Loop] Dispatch table built.");
}

// ============================================================================
// LOOP — بهینه‌سازی‌شده با تمام ۶ روش
// ============================================================================

/**
 * @brief تابع loop اصلی — IRAM_ATTR (روش ۱)
 *
 * ترتیب اجرا:
 *  ① executor.poll()          — Bitmask Xtensa, بدون overhead
 *  ② Loop dispatch table      — بدون null-check (روش ۲)
 *  ③ processInputs            — با pre-cached callback (روش ۳)
 *  ④ processAnalogInputs      — با pre-cached callback (روش ۳)
 *  wsServer/wsClient poll     — داخل wsLoopFn با CCOUNT throttle (روش ۴)
 *
 * روش ۵ و ۶ (GPIO Shadow + LUT) برای آینده آماده‌ست؛
 * PinStateManager از قبل GPIO shadow bitmask داره (hasInputsChanged)
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
