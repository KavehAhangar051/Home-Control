/**
 * @file main.cpp
 * @brief Achaemenid IoT Node - Event-Driven Architecture (Refactored)
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

// Override weak Arduino-ESP32 loopTask stack size (default 8KB -> 16KB)
// Provides generous headroom for power-of-2 FastFunction SBO, nested Futures, JSON & WiFi init.
size_t getArduinoLoopTaskStackSize(void) {
    return 16384;
}

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

    // Configure MQTT independently of Cloudflare so command subscription is
    // ready as soon as WiFi connects, even when the cloud WebSocket is offline.
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
    
    // Start Boot Sequence
    segmentStorage = new uniuno::NvsSegmentStorage();
    bootManager = new BootManager();

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
}

void loop() {
    // 1. Poll the global async executor (hardware bitmask NSA: 1 cycle when idle)
    executor.poll();

    // 2. Service WiFi recovery and local provisioning portal (throttled to 500ms)
    if (bootManager) bootManager->loop();

    // 3. Process inputs for segments of type 'input' and 'analog_input' (zero stack lambda re-allocation)
    if (ruleEngine) {
        static const auto onInputCallback = [](int pin, bool state, unsigned long dur, const RuleConfig& r) {
            PinStateChangedEvent changed{pin, state, false, PinStateChangeOrigin::PhysicalInput};
            eventBus.dispatch(changed);
            ruleEngine->handleInput(pin, state, dur, r);
        };
        pinManager.processInputs(onInputCallback);

        static const auto onAnalogInputCallback = [](const AnalogInputChange& ch, const RuleConfig& r) {
            if (ch.valueChanged || ch.thresholdChanged) {
                PinStateChangedEvent changed{
                    ch.pin,
                    ch.thresholdState,
                    false, // Cloud sync is debounced below to prevent flooding
                    PinStateChangeOrigin::PhysicalInput,
                    static_cast<int16_t>(ch.value),
                    ch.resolution
                };
                eventBus.dispatch(changed);
            }
            if (ch.rangeMaskChanged) {
                ruleEngine->handleAnalogInput(ch, r);
            }
            if (ch.thresholdChanged) {
                ruleEngine->handleInput(ch.pin, ch.thresholdState, ch.durationSec, r);
            } else if (ch.valueChanged && !ch.rangeMaskChanged) {
                ruleEngine->scheduleCloudSync(ch.pin);
            }
        };
        pinManager.processAnalogInputs(onAnalogInputCallback);
    }

    // 4. Poll Local WebSocket Server (guarded by _isStarted)
    if (wsServer) wsServer->loop();

    // 5. WebSocket Client (Zero WiFi.status overhead, single-subtraction backoff)
    if (wsClient) wsClient->loop();
}
