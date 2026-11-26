#ifndef APP_EVENTS_H
#define APP_EVENTS_H
#include <ConfigTypes.h>

/**
 * @file AppEvents.h
 * @brief Application-level event definitions for Achaemenid IoT Node.
 *
 * These events flow through the central EventDispatcher to decouple
 * components and enable a reactive, event-driven architecture.
 *
 * ARCHITECTURE:
 *   MQTT Message → MqttCommandEvent → MqttCommandHandler
 *     → PinStateChangeRequestEvent → PinManager
 *       → PinStateChangedEvent → (logging, future dashboard sync, etc.)
 */

/**
 * @struct MqttCommandEvent
 * @brief Dispatched when a raw MQTT payload arrives.
 *
 * Listeners parse the payload and take appropriate action.
 */
struct MqttCommandEvent {
  static constexpr const char* Name = "mqtt.command";
  const char* payload; /**< Raw JSON payload string */
};

/**
 * @struct PinStateChangeRequestEvent
 * @brief Request to change a pin's state (from MQTT or HTTP).
 *
 * PinManager listens for this and applies the change to hardware.
 */
enum class PinStateChangeOrigin : uint8_t { Local, DashboardCommand, Automation, PhysicalInput, Cloudflare };

struct PinStateChangeRequestEvent {
  static constexpr const char* Name = "pin.change_request";
  int pin;                     /**< Physical GPIO pin number */
  bool state;                  /**< Desired state (true=ON, false=OFF) */
  int auto_off;                /**< Time in seconds to auto-off, -1 for none */
  PinStateChangeOrigin origin; /**< Prevent echoing Cloudflare commands back to Cloudflare */
  int16_t analogValue;         /**< -1 = boolean toggle/restore mode; 0..4095 = explicit PWM duty */

  PinStateChangeRequestEvent(int p, bool s, int a = -1, PinStateChangeOrigin source = PinStateChangeOrigin::Local,
                             int16_t analogVal = RULE_ANALOG_VALUE_UNSET)
      : pin(p), state(s), auto_off(a), origin(source), analogValue(analogVal) {}

  static PinStateChangeRequestEvent analog(int p, uint16_t duty, int a = -1,
                                           PinStateChangeOrigin source = PinStateChangeOrigin::Local) {
    const uint16_t clamped = duty > MAX_ANALOG_OUTPUT_VALUE ? MAX_ANALOG_OUTPUT_VALUE : duty;
    return PinStateChangeRequestEvent(p, clamped > 0, a, source, static_cast<int16_t>(clamped));
  }
};

/**
 * @struct SegmentAddRequestEvent
 * @brief Request to dynamically add a new segment at runtime.
 */
struct SegmentAddRequestEvent {
  static constexpr const char* Name = "segment.add_request";
  const char* id;   /**< Segment unique identifier */
  const char* type; /**< Segment type (e.g., "gpio_toggle", "input", "analog_output", "analog_input") */
  int pin;          /**< Physical GPIO pin number */
  uint8_t pwmResolution = DEFAULT_PWM_RESOLUTION;                /**< PWM resolution bits (8..12) for analog_output */
  uint16_t pwmFrequency = DEFAULT_PWM_FREQUENCY;                 /**< PWM carrier frequency Hz for analog_output */
  uint16_t initialValue = 0;                                     /**< Initial PWM duty cycle (0..4095) */
  uint8_t adcResolution = DEFAULT_ADC_RESOLUTION;                /**< ADC resolution bits (8..12) for analog_input */
  uint16_t adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS; /**< ADC polling interval (50..60000 ms) */
  uint16_t adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;      /**< ADC deadband for reporting */
  uint16_t adcHighThreshold = 0; /**< ADC Schmitt-trigger HIGH threshold (0 = disabled) */
  uint16_t adcLowThreshold = 0;  /**< ADC Schmitt-trigger LOW threshold */
};

/**
 * @struct SegmentRemoveRequestEvent
 * @brief Request to dynamically remove a segment at runtime.
 */
struct SegmentRemoveRequestEvent {
  static constexpr const char* Name = "segment.remove_request";
  const char* id; /**< Segment unique identifier to remove */
  int pin = -1;   /**< Optional fallback physical GPIO pin (0..39), or -1 if omitted */
};

/**
 * @struct SegmentUpdateRuleRequestEvent
 * @brief Request to update the rule of a digital or analog input segment.
 */
struct SegmentUpdateRuleRequestEvent {
  static constexpr const char* Name = "segment.update_rule_request";
  int pin;
  RuleConfig rule;
};

/**
 * @struct SegmentUpdateAnalogInputConfigRequestEvent
 * @brief Request to reconfigure sampling, deadband, and hysteresis thresholds on an analog_input segment.
 */
struct SegmentUpdateAnalogInputConfigRequestEvent {
  static constexpr const char* Name = "segment.update_analog_input_config";
  int pin;
  uint16_t sampleIntervalMs;
  uint16_t deltaThreshold;
  uint16_t highThreshold;
  uint16_t lowThreshold;
  uint8_t resolution; /**< 0 = preserve existing resolution, 8..12 = update bit depth */
};

/**
 * @struct AnalogInputReadRequestEvent
 * @brief Request an immediate on-demand ADC sample and publish for an analog_input pin.
 */
struct AnalogInputReadRequestEvent {
  static constexpr const char* Name = "analog_input.read_request";
  int pin;
};

/**
 * @struct PinStateChangedEvent
 * @brief Dispatched AFTER a pin state has been successfully changed.
 *
 * Can be used for logging, dashboard sync confirmation, etc.
 */
struct PinStateChangedEvent {
  static constexpr const char* Name = "pin.state_changed";
  int pin;    /**< Physical GPIO pin number */
  bool state; /**< New state (true=ON, false=OFF) */
  bool syncCloudflare;
  PinStateChangeOrigin origin;
  int16_t analogValue; /**< -1 for digital segments, 0..4095 for analog_output */
  uint8_t resolution;  /**< 0 for digital segments, 8..12 for analog_output */

  PinStateChangedEvent(int p, bool s, bool sync = true, PinStateChangeOrigin source = PinStateChangeOrigin::Local,
                       int16_t analogVal = RULE_ANALOG_VALUE_UNSET, uint8_t res = 0)
      : pin(p), state(s), syncCloudflare(sync), origin(source), analogValue(analogVal), resolution(res) {}
};

/**
 * @struct ConfigLoadedEvent
 * @brief Dispatched when initial configuration is loaded from server.
 */
struct ConfigLoadedEvent {
  static constexpr const char* Name = "config.loaded";
  int pinCount;              /**< Number of pins configured */
  MqttConfig mqtt;           /**< MQTT configuration parsed from server */
  WifiNetworkConfig wifi[5]; /**< WiFi configuration parsed from server */
  int wifiCount;
  const ParseResult* parsed;
  bool hasParsedConfig;

  ConfigLoadedEvent() : pinCount(0), wifiCount(0), parsed(nullptr), hasParsedConfig(false) {}
};

/**
 * @struct NetworkStatusEvent
 * @brief Dispatched when network connectivity changes.
 */
struct NetworkStatusEvent {
  static constexpr const char* Name = "network.status";
  bool connected; /**< True if WiFi is connected */
};

/**
 * @struct DashboardPresenceEvent
 * @brief Dispatched when the dashboard announces its presence.
 */
struct DashboardPresenceEvent {
  static constexpr const char* Name = "dashboard.presence";
  bool isOnline;
};
/**
 * @struct StateSyncRequestEvent
 * @brief Dispatched when a client requests full state sync via MQTT.
 */
struct StateSyncRequestEvent {
  static constexpr const char* Name = "state.sync_request";
};

/**
 * @struct CloudSyncRequestEvent
 * @brief Request to sync a pin's state directly to the Cloudflare WS Client.
 */
struct CloudSyncRequestEvent {
  static constexpr const char* Name = "cloud.sync_request";
  int pin;
  bool state;
  int16_t analogValue;
  uint8_t resolution;
  CloudSyncRequestEvent(int p, bool s, int16_t analogVal = RULE_ANALOG_VALUE_UNSET, uint8_t res = 0)
      : pin(p), state(s), analogValue(analogVal), resolution(res) {}
};

/**
 * @struct AuxNodeUpsertRequestEvent
 * @brief Request to register or update an auxiliary ESP node (MAC address, capacity, chip type, name).
 */
struct AuxNodeUpsertRequestEvent {
  static constexpr const char* Name = "aux_node.upsert_request";
  uint8_t nodeId;
  uint8_t mac[6];
  uint8_t pinCapacity;
  AuxChipType chipType;
  const char* name;
};

/**
 * @struct AuxNodeRemoveRequestEvent
 * @brief Request to remove an auxiliary ESP node by nodeId or fallback MAC, optionally cascading its virtual segments.
 */
struct AuxNodeRemoveRequestEvent {
  static constexpr const char* Name = "aux_node.remove_request";
  uint8_t nodeId;
  uint8_t mac[6];
  bool hasMac;
  bool cascadeSegments;
};

/**
 * @struct VirtualSegmentAddRequestEvent
 * @brief Request to dynamically register or replace a virtual segment bound to (nodeId, remotePin).
 */
struct VirtualSegmentAddRequestEvent {
  static constexpr const char* Name = "virtual_segment.add_request";
  const char* id;
  const char* type;
  int virtualPin;
  uint8_t nodeId;
  uint8_t remotePin;
  uint8_t pwmResolution = DEFAULT_PWM_RESOLUTION;
  uint16_t pwmFrequency = DEFAULT_PWM_FREQUENCY;
  uint16_t initialValue = 0;
  uint8_t adcResolution = DEFAULT_ADC_RESOLUTION;
  uint16_t adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
  uint16_t adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
  uint16_t adcHighThreshold = 0;
  uint16_t adcLowThreshold = 0;
};

/**
 * @struct VirtualPinCommandEvent
 * @brief Dispatched when a virtual output/PWM segment changes state on the hub.
 * Phase 2 ESP-NOW / ESP-MESH transport subscribes to this event to transmit the command to mac[6].
 */
struct VirtualPinCommandEvent {
  static constexpr const char* Name = "virtual_pin.command";
  int virtualPin;
  uint8_t nodeId;
  uint8_t mac[6];
  uint8_t remotePin;
  uint8_t segmentType; // Cast of SegmentType
  bool state;
  int16_t analogValue;
  uint8_t resolution;
};

/**
 * @struct AuxNodesBootstrappedEvent
 * @brief Dispatched on hub boot once persisted auxiliary ESP node MACs are restored from NVS.
 * Phase 2 ESP-NOW transport subscribes to register peers and broadcast hub-online announcements.
 */
struct AuxNodesBootstrappedEvent {
  static constexpr const char* Name = "aux_nodes.bootstrapped";
  int nodeCount;
};

#endif // APP_EVENTS_H
