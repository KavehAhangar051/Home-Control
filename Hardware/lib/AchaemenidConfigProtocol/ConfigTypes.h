#ifndef CONFIG_TYPES_H
#define CONFIG_TYPES_H

#include <Arduino.h>

static const int MAX_SEGMENTS = 16;
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

struct RuleAction {
    int requiredHoldTime; // -1 = double_click, 0 = single/immediate, 3/5/10 = hold seconds
    int targetPin;
    int delay;
    int16_t targetValue;  // -1 = boolean actionState mode, 0..4095 = explicit PWM duty
    RuleActionType actionType;
    bool actionState : 1;

    void reset() {
        requiredHoldTime = 0;
        targetPin = -1;
        delay = 0;
        targetValue = RULE_ANALOG_VALUE_UNSET;
        actionType = ACTION_IMMEDIATE;
        actionState = false;
    }

    RuleAction() { reset(); }
};

struct AnalogRangeRule {
    uint16_t minValue;                  // Inclusive lower bound (0..maxScale)
    uint16_t maxValue;                  // Inclusive upper bound (minValue..maxScale)
    uint16_t hysteresis;                // Exit margin to prevent boundary chatter (0..maxScale/2)
    int16_t targetValue;                // -1 = boolean actionState mode, 0..4095 = explicit PWM duty
    int8_t targetPin;                   // Target output GPIO (0..39), -1 = unset
    uint8_t delay;                      // Seconds for AFTER_DELAY / FOR_DURATION (0..60)
    RuleActionType actionType;          // IMMEDIATE, AFTER_DELAY, FOR_DURATION
    AnalogRangeTriggerMode triggerMode; // RANGE_ON_ENTER (0) or RANGE_ON_EXIT (1)
    bool actionState : 1;               // Digital target state when targetValue == -1
    bool enabled : 1;                   // True when this range slot is active

    void reset() {
        minValue = 0;
        maxValue = 0;
        hysteresis = 0;
        targetValue = RULE_ANALOG_VALUE_UNSET;
        targetPin = -1;
        delay = 0;
        actionType = ACTION_IMMEDIATE;
        triggerMode = RANGE_ON_ENTER;
        actionState = false;
        enabled = false;
    }

    RuleAction toRuleAction() const {
        RuleAction act;
        act.requiredHoldTime = 0;
        act.targetPin = targetPin;
        act.delay = delay;
        act.targetValue = targetValue;
        act.actionType = actionType;
        act.actionState = actionState;
        return act;
    }

    AnalogRangeRule() { reset(); }
};

struct RuleConfig {
    RuleAction highActions[4];
    RuleAction lowActions[4];
    AnalogRangeRule analogRanges[MAX_ANALOG_RANGE_RULES];
    
    int highActionCount;
    int lowActionCount;
    uint8_t analogRangeCount;
    
    bool active : 1;

    void reset() {
        for (int i = 0; i < 4; ++i) {
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
    
    bool value : 1;
    bool valid : 1;

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
        value = false;
        valid = false;
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
    MqttConfig mqtt;
    WifiNetworkConfig wifi[5];
    
    int wifiCount;
    int count;
    char apSsid[33];
    char apPassword[64];
    char mdnsHost[33];
    bool apValid;
    bool apProvided;
    bool mdnsProvided;
    bool wifiProvided;
    bool segmentsProvided;
    bool success : 1;

    void reset() {
        for (int i = 0; i < MAX_SEGMENTS; ++i) {
            segments[i].reset();
        }
        mqtt.reset();
        for (int i = 0; i < 5; ++i) {
            wifi[i].reset();
        }
        wifiCount = 0;
        count = 0;
        apSsid[0] = '\0';
        apPassword[0] = '\0';
        mdnsHost[0] = '\0';
        apValid = false;
        apProvided = false;
        mdnsProvided = false;
        wifiProvided = false;
        segmentsProvided = false;
        success = false;
    }

    ParseResult() { reset(); }
};

#endif // CONFIG_TYPES_H
