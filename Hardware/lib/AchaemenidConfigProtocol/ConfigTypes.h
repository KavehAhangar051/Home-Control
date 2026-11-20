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

enum RuleActionType : uint8_t {
    ACTION_IMMEDIATE = 0,
    ACTION_AFTER_DELAY = 1,
    ACTION_FOR_DURATION = 2
};

struct RuleAction {
    int requiredHoldTime; // 0, 3, 5, 10
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

struct RuleConfig {
    RuleAction highActions[4];
    RuleAction lowActions[4];
    
    int highActionCount;
    int lowActionCount;
    
    bool active : 1;

    void reset() {
        for (int i = 0; i < 4; ++i) {
            highActions[i].reset();
            lowActions[i].reset();
        }
        highActionCount = 0;
        lowActionCount = 0;
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
    
    int port;
    int qos;
    
    bool valid : 1;

    void reset() {
        host[0] = '\0';
        baseTopic[0] = '\0';
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
    bool apValid;
    bool apProvided;
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
        apValid = false;
        apProvided = false;
        wifiProvided = false;
        segmentsProvided = false;
        success = false;
    }

    ParseResult() { reset(); }
};

#endif // CONFIG_TYPES_H
