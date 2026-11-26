#include "EventHandlers.h"
#include <ProjectConfig.h>
#include <core/Globals.h>
#include <AppEvents.h>
#include <Utilities/logging.h>
#include <setup/NetworkStorage.h>
#include <core/WebSocketServer.h>
#include <core/WebSocketClient.h>
#include <AchaemenidMQTT.h>
#include <BootManager.h>
#include <ConfigApplier.h>
#include <ISegmentStorage.h>
#include <IAuxNodeStorage.h>
#include <WiFi.h>
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <cstdio>
#include <memory>

static SemaphoreHandle_t segmentStorageMutex = nullptr;

static void persistCurrentSegmentConfig(const char* reason) {
  if (segmentStorage == nullptr) {
    WARNINGF("[SegStorage] Cannot persist after %s: storage unavailable", reason);
    return;
  }

  if (segmentStorageMutex != nullptr) {
    xSemaphoreTake(segmentStorageMutex, portMAX_DELAY);
  }

  // Allocate transiently on heap to keep both .dram0.bss and MQTT callback stack lean.
  std::unique_ptr<ParseResult> snapshot(new (std::nothrow) ParseResult());
  if (snapshot) {
    pinManager.exportConfig(*snapshot);
    segmentStorage->saveSegmentConfig(*snapshot);
  } else {
    ERRORF("[SegStorage] Out of memory persisting segments after %s", reason);
  }

  if (segmentStorageMutex != nullptr) {
    xSemaphoreGive(segmentStorageMutex);
  }
}

static void persistCurrentAuxNodeConfig(const char* reason) {
  if (auxNodeStorage == nullptr) {
    WARNINGF("[AuxStorage] Cannot persist after %s: storage unavailable", reason);
    return;
  }

  if (segmentStorageMutex != nullptr) {
    xSemaphoreTake(segmentStorageMutex, portMAX_DELAY);
  }

  std::unique_ptr<ParseResult> snapshot(new (std::nothrow) ParseResult());
  if (snapshot) {
    auxNodeManager.exportConfig(*snapshot);
    auxNodeStorage->saveAuxNodes(*snapshot);
  } else {
    ERRORF("[AuxStorage] Out of memory persisting aux nodes after %s", reason);
  }

  if (segmentStorageMutex != nullptr) {
    xSemaphoreGive(segmentStorageMutex);
  }
}

static void dispatchVirtualCommandIfApplicable(int pin, bool state, int16_t analogValue, uint8_t resolution) {
  uint8_t nodeId = AUX_NODE_ID_LOCAL;
  uint8_t remotePin = REMOTE_PIN_UNSET;
  if (!pinManager.getVirtualBinding(pin, nodeId, remotePin)) {
    return;
  }

  const AuxNodeConfig* node = auxNodeManager.getNodeById(nodeId);
  VirtualPinCommandEvent cmd{};
  cmd.virtualPin = pin;
  cmd.nodeId = nodeId;
  cmd.remotePin = remotePin;
  cmd.segmentType = static_cast<uint8_t>(pinManager.getSegmentTypeByPin(pin));
  cmd.state = state;
  cmd.analogValue = analogValue;
  cmd.resolution = resolution;
  if (node != nullptr) {
    memcpy(cmd.mac, node->mac, 6);
  } else {
    memset(cmd.mac, 0, sizeof(cmd.mac));
    WARNINGF("[VirtualBus] Virtual pin %d targets unregistered node #%u", pin, nodeId);
  }
  eventBus.dispatch(cmd);
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

  bool changed = false;
  if (evt->analogValue >= 0 && pinManager.isAnalogOutputPin(evt->pin)) {
    changed = pinManager.setPinAnalogValue(evt->pin, static_cast<uint16_t>(evt->analogValue));
  } else {
    const bool targetState = (evt->analogValue >= 0) ? (evt->analogValue > 0) : evt->state;
    changed = pinManager.setPinState(evt->pin, targetState);
  }

  if (changed) {
    // Every newer command supersedes the previous auto-off deadline, including OFF
    // and ON commands without a timer.
    uniuno::TimerHandle existing = pinManager.getTimerIdByPin(evt->pin);
    if (existing.isActive()) existing.cancel();
    pinManager.setTimerIdByPin(evt->pin, uniuno::TimerHandle());

    const bool actualState = pinManager.getPinState(evt->pin);
    const int16_t actualAnalog = pinManager.getPinAnalogValue(evt->pin);
    const uint8_t actualRes = pinManager.getPinPwmResolution(evt->pin);

    if (actualAnalog >= 0) {
      INFOF("[Event] Pin %d PWM changed to %d (%u-bit, %s) via Request", evt->pin, static_cast<int>(actualAnalog),
            static_cast<unsigned int>(actualRes), actualState ? "ON" : "OFF");
    } else {
      INFOF("[Event] Pin %d state changed to %s via Request", evt->pin, actualState ? "ON" : "OFF");
    }

    // Only suppress Cloudflare sync for commands that originated from Cloudflare.
    // MQTT and local WebSocket changes must be reported to the durable state owner.
    const bool syncCloudflare = (evt->origin != PinStateChangeOrigin::Cloudflare);
    PinStateChangedEvent changedEvt{evt->pin, actualState, syncCloudflare, evt->origin, actualAnalog, actualRes};
    eventBus.dispatch(changedEvt);

    // Handle Auto-Off if requested (works for both digital outputs and PWM analog_output)
    if (actualState && evt->auto_off > 0) {
      int delay = evt->auto_off;
      int pin = evt->pin;

      uniuno::TimerHandle newTimer = appTimer->setTimeout(
          [pin, delay] {
            // Check if still handled
            if (pinManager.getIsHandledByPin(pin)) return;

            // Turn off locally (for PWM, sets duty=0 while keeping lastNonZeroValue)
            if (pinManager.setPinState(pin, false)) {
              INFOF("[AutoOff] Pin %d turned OFF automatically", pin);
              dispatchVirtualCommandIfApplicable(pin, false, pinManager.getPinAnalogValue(pin),
                                                 pinManager.getPinPwmResolution(pin));

              // Natural expiry of a Dashboard-owned output timer is intentionally
              // silent: the Dashboard already runs the matching countdown locally.
            }
          },
          delay * 1000);

      pinManager.setTimerIdByPin(evt->pin, newTimer);
      INFOF("[AutoOff] Scheduled auto-off for pin %d in %ds", evt->pin, delay);
    }
  } else {
    WARNINGF("[Event] Failed to set pin %d (not found or incompatible segment type)", evt->pin);
  }
};

/**
 * @brief Listener: Handles dynamic segment add requests.
 */
auto onSegmentAdd = [](SegmentAddRequestEvent* evt) {
  if (evt == nullptr || evt->id == nullptr || evt->type == nullptr) return;
  const SegmentType sType = parseSegmentType(evt->type);
  const bool success = pinManager.upsertSegment(evt->id, sType, evt->pin, 0, RuleConfig(), evt->pwmResolution,
                                                evt->pwmFrequency, evt->adcResolution, evt->adcSampleIntervalMs,
                                                evt->adcDeltaThreshold, evt->adcHighThreshold, evt->adcLowThreshold);
  if (success) {
    if (sType == SegmentType::AnalogOutput && evt->initialValue > 0) {
      pinManager.setPinAnalogValue(evt->pin, evt->initialValue);
    }
    INFOF("[Event] Segment '%s' (%s) active on pin %d", evt->id, segmentTypeToString(sType), evt->pin);
    persistCurrentSegmentConfig("segment add");
  }
};

/**
 * @brief Listener: Handles dynamic segment remove requests.
 */
auto onSegmentRemove = [](SegmentRemoveRequestEvent* evt) {
  if (evt == nullptr) return;
  const bool success = pinManager.removeSegmentByIdOrPin(evt->id, evt->pin);
  if (success) {
    if (evt->pin >= 0) {
      INFOF("[Event] Segment '%s' (pin %d) removed", evt->id ? evt->id : "", evt->pin);
    } else {
      INFOF("[Event] Segment '%s' removed", evt->id ? evt->id : "");
    }
    persistCurrentSegmentConfig("segment remove");
  }
};

auto onSegmentUpdateRule = [](SegmentUpdateRuleRequestEvent* evt) {
  if (evt == nullptr) return;
  if (pinManager.updateSegmentRuleByPin(evt->pin, evt->rule)) {
    INFOF("[Event] Rule updated for input GPIO%d (high=%d low=%d ranges=%u active=%d)", evt->pin,
          evt->rule.highActionCount, evt->rule.lowActionCount, static_cast<unsigned int>(evt->rule.analogRangeCount),
          evt->rule.active);
    persistCurrentSegmentConfig("segment rule update");
  } else {
    WARNINGF("[Event] Rule update rejected for input GPIO%d (not registered as a digital or analog input)", evt->pin);
  }
};

auto onSegmentUpdateAnalogInputConfig = [](SegmentUpdateAnalogInputConfigRequestEvent* evt) {
  if (evt == nullptr) return;
  if (pinManager.updateAnalogInputConfigByPin(evt->pin, evt->sampleIntervalMs, evt->deltaThreshold, evt->highThreshold,
                                              evt->lowThreshold, evt->resolution)) {
    INFOF("[Event] Analog input config updated for GPIO%d", evt->pin);
    persistCurrentSegmentConfig("analog input config update");
  } else {
    WARNINGF("[Event] Analog input config update rejected for GPIO%d (not an analog_input segment)", evt->pin);
  }
};

auto onAnalogInputReadRequest = [](AnalogInputReadRequestEvent* evt) {
  if (evt == nullptr) return;
  AdcSampleResult sample;
  if (pinManager.readAnalogInputNow(evt->pin, sample)) {
    const uint8_t res = pinManager.getPinAdcResolution(evt->pin);
    PinStateChangedEvent changedEvt{
        evt->pin, sample.thresholdState, true, PinStateChangeOrigin::Local, static_cast<int16_t>(sample.value), res};
    eventBus.dispatch(changedEvt);
    INFOF("[Event] On-demand ADC read GPIO%d -> %u (%u-bit, state=%s)", evt->pin, sample.value, res,
          sample.thresholdState ? "HIGH" : "LOW");
  } else {
    WARNINGF("[Event] On-demand ADC read rejected for GPIO%d (not an analog_input segment)", evt->pin);
  }
};

auto onAuxNodeUpsert = [](AuxNodeUpsertRequestEvent* evt) {
  if (evt == nullptr) return;
  if (auxNodeManager.upsertNode(evt->nodeId, evt->mac, evt->pinCapacity, evt->chipType, evt->name)) {
    persistCurrentAuxNodeConfig("aux node upsert");
    char macText[18];
    formatMacAddress(evt->mac, macText, sizeof(macText));
    char ackBuf[160];
    snprintf(ackBuf, sizeof(ackBuf),
             "{\"type\":\"aux_node_ack\",\"action\":\"upsert\",\"id\":%u,\"mac\":\"%s\",\"cap\":%u,\"chip\":%u}",
             evt->nodeId, macText, evt->pinCapacity, static_cast<unsigned int>(evt->chipType));
    mqttClient.publish(mqttClient.getBaseTopic() + "/State", ackBuf);
  }
};

auto onAuxNodeRemove = [](AuxNodeRemoveRequestEvent* evt) {
  if (evt == nullptr) return;
  uint8_t removedId = AUX_NODE_ID_LOCAL;
  const bool removed = auxNodeManager.removeNodeByIdOrMac(evt->nodeId, evt->hasMac ? evt->mac : nullptr, &removedId);
  if (removed) {
    if (evt->cascadeSegments && removedId != AUX_NODE_ID_LOCAL) {
      const int removedSegs = pinManager.removeSegmentsByNodeId(removedId);
      if (removedSegs > 0) {
        INFOF("[Event] Cascade-removed %d virtual segment(s) bound to Aux Node #%u", removedSegs, removedId);
        persistCurrentSegmentConfig("aux node cascade remove");
      }
    }
    persistCurrentAuxNodeConfig("aux node remove");
    char ackBuf[96];
    snprintf(ackBuf, sizeof(ackBuf), "{\"type\":\"aux_node_ack\",\"action\":\"delete\",\"id\":%u}", removedId);
    mqttClient.publish(mqttClient.getBaseTopic() + "/State", ackBuf);
  }
};

auto onVirtualSegmentAdd = [](VirtualSegmentAddRequestEvent* evt) {
  if (evt == nullptr || evt->id == nullptr || evt->type == nullptr) return;
  if (!auxNodeManager.hasNodeId(evt->nodeId)) {
    WARNINGF("[Event] Rejected virtual segment '%s' (vpin %d): Aux Node #%u is not registered", evt->id,
             evt->virtualPin, evt->nodeId);
    return;
  }

  const SegmentType sType = parseSegmentType(evt->type);
  const bool success = pinManager.upsertVirtualSegment(
      evt->id, sType, evt->virtualPin, evt->nodeId, evt->remotePin, 0, RuleConfig(), evt->pwmResolution,
      evt->pwmFrequency, evt->adcResolution, evt->adcSampleIntervalMs, evt->adcDeltaThreshold, evt->adcHighThreshold,
      evt->adcLowThreshold);
  if (success) {
    if (sType == SegmentType::AnalogOutput && evt->initialValue > 0) {
      pinManager.setPinAnalogValue(evt->virtualPin, evt->initialValue);
    }
    INFOF("[Event] Virtual segment '%s' (%s) active on vpin %d -> node #%u rpin %u", evt->id,
          segmentTypeToString(sType), evt->virtualPin, evt->nodeId, evt->remotePin);
    persistCurrentSegmentConfig("virtual segment add");
  }
};

auto onVirtualPinCommand = [](VirtualPinCommandEvent* evt) {
  if (evt == nullptr) return;
  char macText[18];
  formatMacAddress(evt->mac, macText, sizeof(macText));
  INFOF("[VirtualBus] Queued wireless cmd -> node#%u (%s) rpin=%u vpin=%d state=%s val=%d (Phase 2 ESP-NOW hook)",
        evt->nodeId, macText, evt->remotePin, evt->virtualPin, evt->state ? "ON" : "OFF",
        static_cast<int>(evt->analogValue));
};

auto onAuxNodesBootstrapped = [](AuxNodesBootstrappedEvent* evt) {
  if (evt == nullptr) return;
  INFOF("[VirtualBus] Restored %d auxiliary ESP node(s) from NVS (ready for Phase 2 ESP-NOW peer init & boot "
        "announcement)",
        evt->nodeCount);
};

/**
 * @brief Listener: Logs pin state changes (confirmation).
 */
auto onPinChanged = [](PinStateChangedEvent* evt) {
  if (evt == nullptr) return;

  // Forward outbound virtual segment transitions to the wireless transport hook (Phase 2 ESP-NOW).
  // Never echo inbound remote PhysicalInput updates back to the auxiliary node.
  if (evt->origin != PinStateChangeOrigin::PhysicalInput) {
    dispatchVirtualCommandIfApplicable(evt->pin, evt->state, evt->analogValue, evt->resolution);
  }

  // A command ACK must never be interpreted as a new pin state.
  if (evt->origin == PinStateChangeOrigin::DashboardCommand) {
    char ackBuf[128];
    if (evt->analogValue >= 0) {
      snprintf(ackBuf, sizeof(ackBuf),
               "{\"type\":\"command_ack\",\"pin\":%d,\"state\":%s,\"value\":%d,\"resolution\":%u}", evt->pin,
               evt->state ? "true" : "false", static_cast<int>(evt->analogValue),
               static_cast<unsigned int>(evt->resolution));
    } else {
      snprintf(ackBuf, sizeof(ackBuf), "{\"type\":\"command_ack\",\"pin\":%d,\"state\":%s}", evt->pin,
               evt->state ? "true" : "false");
    }
    mqttClient.publish(mqttClient.getBaseTopic() + "/State", ackBuf);
    return;
  }

  const char* source = "local";
  switch (evt->origin) {
  case PinStateChangeOrigin::Automation:
    source = "automation";
    break;
  case PinStateChangeOrigin::PhysicalInput:
    source = "physical_input";
    break;
  case PinStateChangeOrigin::Cloudflare:
    source = "cloudflare";
    break;
  case PinStateChangeOrigin::Local:
    source = "local";
    break;
  case PinStateChangeOrigin::DashboardCommand:
    return;
  }

  char stateBuf[160];
  if (evt->analogValue >= 0) {
    snprintf(stateBuf, sizeof(stateBuf),
             "{\"type\":\"pin_update\",\"pin\":%d,\"state\":%s,\"value\":%d,\"resolution\":%u,\"source\":\"%s\"}",
             evt->pin, evt->state ? "true" : "false", static_cast<int>(evt->analogValue),
             static_cast<unsigned int>(evt->resolution), source);
  } else {
    snprintf(stateBuf, sizeof(stateBuf), "{\"type\":\"pin_update\",\"pin\":%d,\"state\":%s,\"source\":\"%s\"}",
             evt->pin, evt->state ? "true" : "false", source);
  }

  if (wsServer) wsServer->broadcastState(stateBuf);
  const bool mqttPublished = mqttClient.publish(mqttClient.getBaseTopic() + "/State", stateBuf);
  if (!mqttPublished) {
    WARNINGF("[StateSync] MQTT publish failed for pin %d (source=%s); dashboard may remain stale", evt->pin, source);
  }
  if (evt->syncCloudflare && wsClient) {
    wsClient->syncPinState(evt->pin, evt->state, evt->analogValue, evt->resolution);
  }
};

/**
 * @brief Listener: Actions after config is loaded.
 */
auto onConfigLoaded = [](ConfigLoadedEvent* evt) {
  if (evt == nullptr) return;

  if (evt->hasParsedConfig && evt->parsed != nullptr) {
    if (evt->parsed->auxNodesProvided) {
      auxNodeManager.clearAllNodes();
      for (int i = 0; i < evt->parsed->auxNodeCount; ++i) {
        const AuxNodeConfig& node = evt->parsed->auxNodes[i];
        if (!node.valid) continue;
        auxNodeManager.upsertNode(node.nodeId, node.mac, node.pinCapacity, node.chipType, node.name);
      }
      persistCurrentAuxNodeConfig("full config apply");
    }
    if (evt->parsed->segmentsProvided) {
      pinManager.clearAllSegments();
      evt->pinCount = ConfigApplier::apply(*evt->parsed, &pinManager, &auxNodeManager);
      persistCurrentSegmentConfig("full config apply");
    }
    configLoaded = true;
  }

  INFOF("[Event] Config loaded with %d pins.", evt->pinCount);
  const bool wifiChanged = saveNetworkConfig(*evt);

  if (evt->hasParsedConfig && evt->parsed != nullptr && evt->parsed->mdnsProvided && bootManager != nullptr) {
    bootManager->refreshMdnsIdentity();
  }

  if (wifiChanged && evt->hasParsedConfig) {
    WARNING("[Network] WiFi credentials changed. Restarting to apply saved networks.");
    mqttClient.disconnect(true);
    if (evt->parsed != nullptr && evt->parsed->wifiProvided && evt->wifiCount == 0) {
      WiFi.disconnect(false, true);
    }
    Serial.flush();
    delay(250);
    ESP.restart();
    return;
  }

  if (evt->mqtt.valid) {
    INFOF("[MQTT] Configuring dynamically: host=%s, port=%d, qos=%d", evt->mqtt.host, evt->mqtt.port, evt->mqtt.qos);
    mqttClient.begin(String(evt->mqtt.host), evt->mqtt.port, String(evt->mqtt.baseTopic), evt->mqtt.qos,
                     String(evt->mqtt.user), String(evt->mqtt.password));
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
};

/**
 * @brief Listener: Handles requests to sync full state over MQTT.
 */
auto onStateSyncRequest = [](StateSyncRequestEvent* evt) {
  if (evt == nullptr) return;
  INFO("[Event] Syncing full state to MQTT...");
  constexpr size_t kStateBufSize = ACHAEMENID_STATE_SYNC_BUF_SIZE;
  std::unique_ptr<char[]> stateBuf(new (std::nothrow) char[kStateBufSize]);
  if (!stateBuf) {
    ERROR("[Event] Out of memory allocating state sync buffer");
    return;
  }
  const size_t stateLen = pinManager.exportStateJson(stateBuf.get(), kStateBufSize, &auxNodeManager);
  char stateTopic[96];
  std::snprintf(stateTopic, sizeof(stateTopic), "%s/State", mqttClient.getBaseTopicCStr());
  mqttClient.publish(stateTopic, reinterpret_cast<const uint8_t*>(stateBuf.get()), stateLen, false);
};

/**
 * @brief Listener: Handles CloudSyncRequestEvent to sync directly to Cloudflare
 */
auto onCloudSyncRequest = [](CloudSyncRequestEvent* evt) {
  if (evt == nullptr) return;
  if (wsClient) {
    wsClient->syncPinState(evt->pin, evt->state, evt->analogValue, evt->resolution);
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
    appTimer->setTimeout([] { mqttClient.connect(); }, 2000);
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
  eventBus.on<SegmentUpdateAnalogInputConfigRequestEvent>(onSegmentUpdateAnalogInputConfig);
  eventBus.on<AnalogInputReadRequestEvent>(onAnalogInputReadRequest);
  eventBus.on<AuxNodeUpsertRequestEvent>(onAuxNodeUpsert);
  eventBus.on<AuxNodeRemoveRequestEvent>(onAuxNodeRemove);
  eventBus.on<VirtualSegmentAddRequestEvent>(onVirtualSegmentAdd);
  eventBus.on<VirtualPinCommandEvent>(onVirtualPinCommand);
  eventBus.on<AuxNodesBootstrappedEvent>(onAuxNodesBootstrapped);
  eventBus.on<PinStateChangedEvent>(onPinChanged);
  eventBus.on<ConfigLoadedEvent>(onConfigLoaded);
  eventBus.on<StateSyncRequestEvent>(onStateSyncRequest);
  eventBus.on<NetworkStatusEvent>(onNetworkStatus);
  eventBus.on<CloudSyncRequestEvent>(onCloudSyncRequest);
}
