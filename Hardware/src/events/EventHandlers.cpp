#include "EventHandlers.h"
#include <core/Globals.h>
#include <AppEvents.h>
#include <Utilities/logging.h>
#include <setup/NetworkStorage.h>
#include <core/WebSocketServer.h>
#include <core/WebSocketClient.h>
#include <AchaemenidMQTT.h>
#include <ConfigApplier.h>
#include <ISegmentStorage.h>
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

static SemaphoreHandle_t segmentStorageMutex = nullptr;

static void persistCurrentSegmentConfig(const char* reason) {
    if (segmentStorage == nullptr) {
        WARNINGF("[SegStorage] Cannot persist after %s: storage unavailable", reason);
        return;
    }

    if (segmentStorageMutex != nullptr) {
        xSemaphoreTake(segmentStorageMutex, portMAX_DELAY);
    }

    // ParseResult is ~4.5KB; keep it out of the constrained MQTT/async callback stack.
    static ParseResult snapshot;
    pinManager.exportConfig(snapshot);
    segmentStorage->saveSegmentConfig(snapshot);

    if (segmentStorageMutex != nullptr) {
        xSemaphoreGive(segmentStorageMutex);
    }
}

/**
 * @brief Listener: Handles requested pin state changes (e.g. from MQTT).
 */
auto onPinChangeRequest = [](PinStateChangeRequestEvent* evt) {
    if (evt == nullptr) return;
    
    // Check if the pin is handled by a rule (e.g., button mode)
    if (pinManager.getIsHandledByPin(evt->pin)) {
        WARNINGF("[Event] Pin %d is currently handled by a Rule. Ignoring external request.", evt->pin);
        return;
    }

    if (pinManager.setPinState(evt->pin, evt->state)) {
        // Every newer command supersedes the previous auto-off deadline, including OFF
        // and ON commands without a timer.
        uniuno::TimerHandle existing = pinManager.getTimerIdByPin(evt->pin);
        if (existing.isActive()) existing.cancel();
        pinManager.setTimerIdByPin(evt->pin, uniuno::TimerHandle());

        INFOF("[Event] Pin %d state changed to %s via Request", evt->pin, evt->state ? "ON" : "OFF");
        
        // Only suppress Cloudflare sync for commands that originated from Cloudflare.
        // MQTT and local WebSocket changes must be reported to the durable state owner.
        const bool syncCloudflare = (evt->origin != PinStateChangeOrigin::Cloudflare);
        PinStateChangedEvent changedEvt{evt->pin, evt->state, syncCloudflare, evt->origin};
        eventBus.dispatch(changedEvt);
        
        // Handle Auto-Off if requested
        if (evt->state && evt->auto_off > 0) {
            int delay = evt->auto_off;
            int pin = evt->pin;
            
            uniuno::TimerHandle newTimer = appTimer->setTimeout([pin, delay]() {
                // Check if still handled
                if (pinManager.getIsHandledByPin(pin)) return;
                
                // Turn off locally
                if (pinManager.setPinState(pin, false)) {
                    INFOF("[AutoOff] Pin %d turned OFF automatically", pin);
                    
                    // Natural expiry of a Dashboard-owned output timer is intentionally
                    // silent: the Dashboard already runs the matching countdown locally.
                }
            }, delay * 1000);
            
            pinManager.setTimerIdByPin(evt->pin, newTimer);
            INFOF("[AutoOff] Scheduled auto-off for pin %d in %ds", evt->pin, delay);
        }
    } else {
        WARNINGF("[Event] Failed to set pin %d (not found)", evt->pin);
    }
};

/**
 * @brief Listener: Handles dynamic segment add requests.
 */
auto onSegmentAdd = [](SegmentAddRequestEvent* evt) {
    if (evt == nullptr || evt->id == nullptr || evt->type == nullptr) return;
    SegmentType sType = SegmentType::Output;
    if (strcmp(evt->type, "input") == 0) {
        sType = SegmentType::Input;
    }
    bool success = pinManager.addSegment(
        evt->id, sType, evt->pin);
    if (success) {
        INFOF("[Event] Segment '%s' added on pin %d", evt->id, evt->pin);
        persistCurrentSegmentConfig("segment add");
    }
};

/**
 * @brief Listener: Handles dynamic segment remove requests.
 */
auto onSegmentRemove = [](SegmentRemoveRequestEvent* evt) {
    if (evt == nullptr) return;
    bool success = pinManager.removeSegment(evt->id);
    if (success) {
        INFOF("[Event] Segment '%s' removed", evt->id);
        persistCurrentSegmentConfig("segment remove");
    }
};

auto onSegmentUpdateRule = [](SegmentUpdateRuleRequestEvent* evt) {
    if (evt == nullptr || evt->id == nullptr) return;
    if (pinManager.updateSegmentRuleByPin(evt->pin, evt->rule)) {
        INFOF("[Event] Rule updated for input GPIO%d (high=%d low=%d active=%d)",
              evt->pin, evt->rule.highActionCount, evt->rule.lowActionCount, evt->rule.active);
        persistCurrentSegmentConfig("segment rule update");
    } else {
        WARNINGF("[Event] Rule update rejected for input GPIO%d (not registered as an input)", evt->pin);
    }
};

/**
 * @brief Listener: Logs pin state changes (confirmation).
 */
auto onPinChanged = [](PinStateChangedEvent* evt) {
    if (evt == nullptr) return;

    // A command ACK must never be interpreted as a new pin state.
    if (evt->origin == PinStateChangeOrigin::DashboardCommand) {
        char ackBuf[96];
        snprintf(ackBuf, sizeof(ackBuf),
                 "{\"type\":\"command_ack\",\"pin\":%d,\"state\":%s}",
                 evt->pin, evt->state ? "true" : "false");
        mqttClient.publish(mqttClient.getBaseTopic() + "/State", ackBuf);
        return;
    }

    const char* source = "local";
    switch (evt->origin) {
        case PinStateChangeOrigin::Automation: source = "automation"; break;
        case PinStateChangeOrigin::PhysicalInput: source = "physical_input"; break;
        case PinStateChangeOrigin::Cloudflare: source = "cloudflare"; break;
        case PinStateChangeOrigin::Local: source = "local"; break;
        case PinStateChangeOrigin::DashboardCommand: return;
    }

    char stateBuf[128];
    snprintf(stateBuf, sizeof(stateBuf),
             "{\"type\":\"pin_update\",\"pin\":%d,\"state\":%s,\"source\":\"%s\"}",
             evt->pin, evt->state ? "true" : "false", source);

    if (wsServer) wsServer->broadcastState(stateBuf);
    const bool mqttPublished = mqttClient.publish(mqttClient.getBaseTopic() + "/State", stateBuf);
    if (!mqttPublished) {
        WARNINGF("[StateSync] MQTT publish failed for pin %d (source=%s); dashboard may remain stale", evt->pin, source);
    }
    if (evt->syncCloudflare && wsClient) wsClient->syncPinState(evt->pin, evt->state);
};

/**
 * @brief Listener: Actions after config is loaded.
 */
auto onConfigLoaded = [](ConfigLoadedEvent* evt) {
    if (evt == nullptr) return;

    if (evt->hasParsedConfig && evt->parsed != nullptr) {
        if (evt->parsed->segmentsProvided) {
            static ParseResult previousConfig;
            bool hasPreviousConfig = false;
            if (segmentStorage != nullptr) {
                if (segmentStorageMutex != nullptr) xSemaphoreTake(segmentStorageMutex, portMAX_DELAY);
                hasPreviousConfig = segmentStorage->loadSegmentConfig(previousConfig);
                if (segmentStorageMutex != nullptr) xSemaphoreGive(segmentStorageMutex);
            }
            if (hasPreviousConfig) {
                for (int i = 0; i < MAX_SEGMENTS; ++i) {
                    if (previousConfig.segments[i].valid) pinManager.removeSegment(previousConfig.segments[i].id);
                }
            }
            evt->pinCount = ConfigApplier::apply(*evt->parsed, &pinManager);
            persistCurrentSegmentConfig("full config apply");
        }
        configLoaded = true;
    }

    INFOF("[Event] Config loaded with %d pins.", evt->pinCount);
    const bool wifiChanged = saveNetworkConfig(*evt);

    if (evt->mqtt.valid) {
        INFOF("[MQTT] Configuring dynamically: host=%s, port=%d, qos=%d", evt->mqtt.host, evt->mqtt.port, evt->mqtt.qos);
        mqttClient.begin(String(evt->mqtt.host), evt->mqtt.port, String(evt->mqtt.baseTopic), evt->mqtt.qos, "", "");
        mqttClient.subscribe(String(evt->mqtt.baseTopic) + "/Command");
        mqttClient.connect();
    } else if (mqttClient.getBaseTopic().length() > 0) {
        mqttClient.subscribe(mqttClient.getBaseTopic() + "/Command");
        mqttClient.connect();
    } else {
        WARNING("[MQTT] No valid MQTT config received from server or NVS. Using fallback.");
        mqttClient.begin("broker.emqx.io", 1883, "KamyarIoT/Achaemenid", 1, "", "");
        mqttClient.subscribe("KamyarIoT/Achaemenid/Command");
        mqttClient.connect();
    }

    if (wifiChanged && evt->hasParsedConfig) {
        WARNING("[Network] WiFi credentials changed. Restarting to apply saved networks.");
        delay(250);
        ESP.restart();
    }
};

/**
 * @brief Listener: Handles requests to sync full state over MQTT.
 */
auto onStateSyncRequest = [](StateSyncRequestEvent* evt) {
    if (evt == nullptr) return;
    INFO("[Event] Syncing full state to MQTT...");
    String stateJson = pinManager.exportStateJson();
    mqttClient.publish(mqttClient.getBaseTopic() + "/State", stateJson, false);
};

/**
 * @brief Listener: Handles CloudSyncRequestEvent to sync directly to Cloudflare
 */
auto onCloudSyncRequest = [](CloudSyncRequestEvent* evt) {
    if (evt == nullptr) return;
    if (wsClient) {
        wsClient->syncPinState(evt->pin, evt->state);
    }
};

/**
 * @brief Listener: Handles network status changes
 */
auto onNetworkStatus = [](NetworkStatusEvent* evt) {
    if (evt == nullptr) return;
    if (wsClient) {
        wsClient->setNetworkAvailable(evt->connected);
    }
    if (evt->connected) {
        if (wsServer) wsServer->begin(81);
        
        // Delay MQTT connection by 2 seconds to avoid LWIP TCP window crash
        // caused by concurrent AsyncTCP and blocking WiFiClientSecure connections.
        appTimer->setTimeout([]() {
            mqttClient.connect();
        }, 2000);
    }
};

void setupEventBus() {
    if (segmentStorageMutex == nullptr) {
        segmentStorageMutex = xSemaphoreCreateMutex();
        if (segmentStorageMutex == nullptr) {
            WARNING("[SegStorage] Could not create persistence mutex");
        }
    }

    // Register all event listeners
    eventBus.on<PinStateChangeRequestEvent>(onPinChangeRequest);
    eventBus.on<SegmentAddRequestEvent>(onSegmentAdd);
    eventBus.on<SegmentRemoveRequestEvent>(onSegmentRemove);
    eventBus.on<SegmentUpdateRuleRequestEvent>(onSegmentUpdateRule);
    eventBus.on<PinStateChangedEvent>(onPinChanged);
    eventBus.on<ConfigLoadedEvent>(onConfigLoaded);
    eventBus.on<StateSyncRequestEvent>(onStateSyncRequest);
    eventBus.on<NetworkStatusEvent>(onNetworkStatus);
    eventBus.on<CloudSyncRequestEvent>(onCloudSyncRequest);
}
