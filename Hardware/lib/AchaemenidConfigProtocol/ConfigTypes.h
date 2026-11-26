#ifndef CONFIG_TYPES_H
#define CONFIG_TYPES_H

#include <Arduino.h>
#include <cstdio>
#include <cstring>

static const int MAX_SEGMENTS = 48;
static constexpr int LOCAL_GPIO_MIN = 0;
static constexpr int LOCAL_GPIO_MAX = 39;
static constexpr int VIRTUAL_PIN_MIN = 40;
static constexpr int VIRTUAL_PIN_MAX = 127;
static constexpr int TOTAL_PIN_SLOTS = 128;

static constexpr int MAX_AUX_NODES = 16;
static constexpr uint8_t MAX_AUX_NODE_PIN_CAPACITY = 32;
static constexpr uint8_t AUX_NODE_ID_LOCAL = 0;
static constexpr uint8_t REMOTE_PIN_UNSET = 0xFF;

static constexpr uint8_t DEFAULT_PWM_RESOLUTION = 8;
static constexpr uint8_t MIN_PWM_RESOLUTION = 8;
static constexpr uint8_t MAX_PWM_RESOLUTION = 12;
static constexpr uint16_t DEFAULT_PWM_FREQUENCY = 5000;
static constexpr uint16_t MIN_PWM_FREQUENCY = 100;
static constexpr uint16_t MAX_PWM_FREQUENCY = 40000;
static constexpr int16_t RULE_ANALOG_VALUE_UNSET = -1;
static constexpr uint16_t MAX_ANALOG_OUTPUT_VALUE = 4095;

static constexpr uint8_t DEFAULT_ADC_RESOLUTION = 12;
static constexpr uint8_t MIN_ADC_RESOLUTION = 8;
static constexpr uint8_t MAX_ADC_RESOLUTION = 12;
static constexpr uint16_t DEFAULT_ADC_SAMPLE_INTERVAL_MS = 500;
static constexpr uint16_t MIN_ADC_SAMPLE_INTERVAL_MS = 50;
static constexpr uint16_t MAX_ADC_SAMPLE_INTERVAL_MS = 60000;
static constexpr uint16_t DEFAULT_ADC_DELTA_THRESHOLD = 40;
static constexpr uint16_t MIN_ADC_DELTA_THRESHOLD = 1;
static constexpr uint16_t MAX_ANALOG_INPUT_VALUE = 4095;

static constexpr int RULE_TRIGGER_DOUBLE_CLICK = -1; // Double-click trigger condition on digital inputs
static constexpr uint16_t DEFAULT_DOUBLE_CLICK_WINDOW_MS = 400; // Max inter-click gap for double-click detection
static constexpr uint8_t MAX_ANALOG_RANGE_RULES = 6; // Max independent value-range rules per analog_input pin
static constexpr uint8_t MAX_RULE_ACTIONS_PER_SIDE = 6; // Max actions per HIGH/LOW digital edge
static constexpr uint8_t MAX_RULE_CONDITIONS_PER_ACTION = 4; // Max guard conditions per action/range

inline constexpr bool isLocalGpioPin(int pin) {
    return pin >= LOCAL_GPIO_MIN && pin <= LOCAL_GPIO_MAX;
}

inline constexpr bool isVirtualPin(int pin) {
    return pin >= VIRTUAL_PIN_MIN && pin <= VIRTUAL_PIN_MAX;
}

inline constexpr bool isValidManagedPin(int pin) {
    return pin >= LOCAL_GPIO_MIN && pin <= VIRTUAL_PIN_MAX;
}

inline constexpr bool isValidAuxNodeId(int nodeId) {
    return nodeId >= 1 && nodeId <= MAX_AUX_NODES;
}

inline constexpr bool isValidAuxRemotePin(int remotePin) {
    return remotePin >= 0 && remotePin <= LOCAL_GPIO_MAX;
}

enum AuxChipType : uint8_t {
    AUX_CHIP_UNKNOWN = 0,
    AUX_CHIP_ESP8266_01 = 1,
    AUX_CHIP_ESP8266_12 = 2,
    AUX_CHIP_ESP32 = 3,
    AUX_CHIP_ESP32_C3 = 4,
    AUX_CHIP_ESP32_S3 = 5,
    AUX_CHIP_MAX = 5
};

inline bool isValidUnicastMac(const uint8_t mac[6]) {
    if (mac == nullptr) return false;
    bool allZero = true;
    bool allFf = true;
    for (int i = 0; i < 6; ++i) {
        if (mac[i] != 0x00) allZero = false;
        if (mac[i] != 0xFF) allFf = false;
    }
    if (allZero || allFf) return false;
    // Reject IEEE 802 multicast MACs (LSB of first octet == 1)
    if ((mac[0] & 0x01U) != 0U) return false;
    return true;
}

inline bool macEquals(const uint8_t a[6], const uint8_t b[6]) {
    if (a == nullptr || b == nullptr) return false;
    return memcmp(a, b, 6) == 0;
}

inline int hexNibbleValue(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
    if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
    return -1;
}

inline bool parseMacAddress(const char* text, uint8_t outMac[6]) {
    if (text == nullptr || outMac == nullptr) return false;
    uint8_t parsed[6] = {0, 0, 0, 0, 0, 0};
    const size_t len = strlen(text);
    if (len == 17) {
        const char sep = text[2];
        if (sep != ':' && sep != '-') return false;
        for (int i = 0; i < 6; ++i) {
            const int hi = hexNibbleValue(text[i * 3]);
            const int lo = hexNibbleValue(text[i * 3 + 1]);
            if (hi < 0 || lo < 0) return false;
            if (i < 5 && text[i * 3 + 2] != sep) return false;
            parsed[i] = static_cast<uint8_t>((hi << 4) | lo);
        }
    } else if (len == 12) {
        for (int i = 0; i < 6; ++i) {
            const int hi = hexNibbleValue(text[i * 2]);
            const int lo = hexNibbleValue(text[i * 2 + 1]);
            if (hi < 0 || lo < 0) return false;
            parsed[i] = static_cast<uint8_t>((hi << 4) | lo);
        }
    } else {
        return false;
    }

    if (!isValidUnicastMac(parsed)) return false;
    memcpy(outMac, parsed, 6);
    return true;
}

inline void formatMacAddress(const uint8_t mac[6], char* outBuf, size_t outSize) {
    if (outBuf == nullptr || outSize == 0) return;
    if (mac == nullptr || outSize < 18) {
        outBuf[0] = '\0';
        return;
    }
    snprintf(outBuf, outSize, "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

struct AuxNodeConfig {
    char name[32];
    uint8_t mac[6];
    uint8_t nodeId;
    uint8_t pinCapacity;
    AuxChipType chipType;
    bool online : 1;
    bool valid : 1;

    void reset() {
        name[0] = '\0';
        memset(mac, 0, sizeof(mac));
        nodeId = AUX_NODE_ID_LOCAL;
        pinCapacity = 0;
        chipType = AUX_CHIP_UNKNOWN;
        online = false;
        valid = false;
    }

    AuxNodeConfig() { reset(); }
};

inline bool isValidDigitalHoldTime(int32_t holdTime) {
    return holdTime == RULE_TRIGGER_DOUBLE_CLICK ||
           holdTime == 0 || holdTime == 3 || holdTime == 5 || holdTime == 10;
}

enum RuleActionType : uint8_t {
    ACTION_IMMEDIATE = 0,
    ACTION_AFTER_DELAY = 1,
    ACTION_FOR_DURATION = 2
};

enum AnalogRangeTriggerMode : uint8_t {
    RANGE_ON_ENTER = 0, // Fire action when analog value enters [minValue .. maxValue]
    RANGE_ON_EXIT = 1   // Fire action when analog value exits [minValue .. maxValue] (respecting hysteresis)
};

enum RuleConditionLogic : uint8_t {
    COND_LOGIC_AND = 0, // All configured guard conditions must pass
    COND_LOGIC_OR = 1   // At least one configured guard condition must pass
};

enum RuleConditionOp : uint8_t {
    COND_STATE_HIGH = 0,   // Digital input/output HIGH/ON, or analog_output ON
    COND_STATE_LOW = 1,    // Digital input/output LOW/OFF, or analog_output OFF
    COND_VAL_GT = 2,       // Analog value > value
    COND_VAL_GTE = 3,      // Analog value >= value
    COND_VAL_LT = 4,       // Analog value < value
    COND_VAL_LTE = 5,      // Analog value <= value
    COND_VAL_EQ = 6,       // Analog value == value
    COND_VAL_BETWEEN = 7,  // min <= analog value <= max
    COND_VAL_OUTSIDE = 8,  // analog value < min || analog value > max
    COND_OP_MAX = 8
};

struct RuleCondition {
    uint16_t value;
    uint16_t maxValue;
    int8_t sourcePin; // Target segment GPIO (0..39 local, 40..127 virtual), -1 = unset
    uint8_t op;       // RuleConditionOp

    void reset() {
        value = 0;
        maxValue = 0;
        sourcePin = -1;
        op = COND_STATE_HIGH;
    }

    RuleCondition() { reset(); }
};

inline bool isValidRuleCondition(const RuleCondition& cond) {
    return isValidManagedPin(cond.sourcePin) &&
           cond.op <= COND_OP_MAX &&
           cond.value <= MAX_ANALOG_OUTPUT_VALUE &&
           cond.maxValue <= MAX_ANALOG_OUTPUT_VALUE;
}

struct RuleAction {
    int16_t targetValue;  // -1 = boolean actionState mode, 0..4095 = explicit PWM duty
    int8_t requiredHoldTime; // -1 = double_click, 0 = single/immediate, 3/5/10 = hold seconds
    int8_t targetPin;
    uint8_t delay;
    RuleActionType actionType;
    uint8_t conditionCount;
    uint8_t conditionLogic;
    bool actionState : 1;
    RuleCondition conditions[MAX_RULE_CONDITIONS_PER_ACTION];

    void reset() {
        requiredHoldTime = 0;
        targetPin = -1;
        delay = 0;
        targetValue = RULE_ANALOG_VALUE_UNSET;
        actionType = ACTION_IMMEDIATE;
        conditionCount = 0;
        conditionLogic = COND_LOGIC_AND;
        actionState = false;
        for (uint8_t i = 0; i < MAX_RULE_CONDITIONS_PER_ACTION; ++i) {
            conditions[i].reset();
        }
    }

    RuleAction() { reset(); }
};

struct AnalogRangeRule {
    uint16_t minValue;                  // Inclusive lower bound (0..maxScale)
    uint16_t maxValue;                  // Inclusive upper bound (minValue..maxScale)
    uint16_t hysteresis;                // Exit margin to prevent boundary chatter (0..maxScale/2)
    int16_t targetValue;                // -1 = boolean actionState mode, 0..4095 = explicit PWM duty
    int8_t targetPin;                   // Target output pin (0..39 local or 40..127 virtual), -1 = unset
    uint8_t delay;                      // Seconds for AFTER_DELAY / FOR_DURATION (0..60)
    RuleActionType actionType;          // IMMEDIATE, AFTER_DELAY, FOR_DURATION
    AnalogRangeTriggerMode triggerMode; // RANGE_ON_ENTER (0) or RANGE_ON_EXIT (1)
    uint8_t conditionCount;
    uint8_t conditionLogic;
    bool actionState : 1;               // Digital target state when targetValue == -1
    bool enabled : 1;                   // True when this range slot is active
    RuleCondition conditions[MAX_RULE_CONDITIONS_PER_ACTION];

    void reset() {
        minValue = 0;
        maxValue = 0;
        hysteresis = 0;
        targetValue = RULE_ANALOG_VALUE_UNSET;
        targetPin = -1;
        delay = 0;
        actionType = ACTION_IMMEDIATE;
        triggerMode = RANGE_ON_ENTER;
        conditionCount = 0;
        conditionLogic = COND_LOGIC_AND;
        actionState = false;
        enabled = false;
        for (uint8_t i = 0; i < MAX_RULE_CONDITIONS_PER_ACTION; ++i) {
            conditions[i].reset();
        }
    }

    RuleAction toRuleAction() const {
        RuleAction act;
        act.requiredHoldTime = 0;
        act.targetPin = targetPin;
        act.delay = delay;
        act.targetValue = targetValue;
        act.actionType = actionType;
        act.actionState = actionState;
        act.conditionCount = conditionCount;
        act.conditionLogic = conditionLogic;
        const uint8_t cnt = conditionCount <= MAX_RULE_CONDITIONS_PER_ACTION
            ? conditionCount
            : MAX_RULE_CONDITIONS_PER_ACTION;
        for (uint8_t i = 0; i < cnt; ++i) {
            act.conditions[i] = conditions[i];
        }
        return act;
    }

    AnalogRangeRule() { reset(); }
};

struct RuleConfig {
    RuleAction highActions[MAX_RULE_ACTIONS_PER_SIDE];
    RuleAction lowActions[MAX_RULE_ACTIONS_PER_SIDE];
    AnalogRangeRule analogRanges[MAX_ANALOG_RANGE_RULES];
    
    int highActionCount;
    int lowActionCount;
    uint8_t analogRangeCount;
    
    bool active : 1;

    void reset() {
        for (uint8_t i = 0; i < MAX_RULE_ACTIONS_PER_SIDE; ++i) {
            highActions[i].reset();
            lowActions[i].reset();
        }
        for (uint8_t i = 0; i < MAX_ANALOG_RANGE_RULES; ++i) {
            analogRanges[i].reset();
        }
        highActionCount = 0;
        lowActionCount = 0;
        analogRangeCount = 0;
        active = false;
    }

    bool hasAnyRule() const {
        return active || highActionCount > 0 || lowActionCount > 0 || analogRangeCount > 0;
    }

    RuleConfig() { reset(); }
};

struct SegmentConfig {
    char id[32];
    char type[16];
    RuleConfig rule;
    
    int pin;
    int autoOffDelay;
    uint16_t analogValue;
    uint16_t pwmFrequency;
    uint16_t adcSampleIntervalMs;
    uint16_t adcDeltaThreshold;
    uint16_t adcHighThreshold;
    uint16_t adcLowThreshold;
    uint8_t pwmResolution;
    uint8_t adcResolution;
    uint8_t nodeId;
    uint8_t remotePin;
    
    bool value : 1;
    bool valid : 1;
    bool isVirtual : 1;

    void reset() {
        id[0] = '\0';
        type[0] = '\0';
        rule.reset();
        pin = -1;
        autoOffDelay = 0;
        analogValue = 0;
        pwmFrequency = DEFAULT_PWM_FREQUENCY;
        adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
        adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
        adcHighThreshold = 0;
        adcLowThreshold = 0;
        pwmResolution = DEFAULT_PWM_RESOLUTION;
        adcResolution = DEFAULT_ADC_RESOLUTION;
        nodeId = AUX_NODE_ID_LOCAL;
        remotePin = REMOTE_PIN_UNSET;
        value = false;
        valid = false;
        isVirtual = false;
    }

    SegmentConfig() { reset(); }
};

struct MqttConfig {
    char host[64];
    char baseTopic[64];
    char user[32];
    char password[32];
    
    int port;
    int qos;
    
    bool valid : 1;

    void reset() {
        host[0] = '\0';
        baseTopic[0] = '\0';
        user[0] = '\0';
        password[0] = '\0';
        port = 1883;
        qos = 1;
        valid = false;
    }

    MqttConfig() { reset(); }
};

struct WifiNetworkConfig {
    char password[64];
    char ssid[33];
    
    bool valid : 1;

    void reset() {
        ssid[0] = '\0';
        password[0] = '\0';
        valid = false;
    }

    WifiNetworkConfig() { reset(); }
};

struct ParseResult {
    SegmentConfig segments[MAX_SEGMENTS];
    AuxNodeConfig auxNodes[MAX_AUX_NODES];
    MqttConfig mqtt;
    WifiNetworkConfig wifi[5];
    
    int wifiCount;
    int count;
    int auxNodeCount;
    char apSsid[33];
    char apPassword[64];
    char mdnsHost[33];
    bool apValid;
    bool apProvided;
    bool mdnsProvided;
    bool wifiProvided;
    bool segmentsProvided;
    bool auxNodesProvided;
    bool success : 1;

    void reset() {
        for (int i = 0; i < MAX_SEGMENTS; ++i) {
            segments[i].reset();
        }
        for (int i = 0; i < MAX_AUX_NODES; ++i) {
            auxNodes[i].reset();
        }
        mqtt.reset();
        for (int i = 0; i < 5; ++i) {
            wifi[i].reset();
        }
        wifiCount = 0;
        count = 0;
        auxNodeCount = 0;
        apSsid[0] = '\0';
        apPassword[0] = '\0';
        mdnsHost[0] = '\0';
        apValid = false;
        apProvided = false;
        mdnsProvided = false;
        wifiProvided = false;
        segmentsProvided = false;
        auxNodesProvided = false;
        success = false;
    }

    ParseResult() { reset(); }
};

#endif // CONFIG_TYPES_H
