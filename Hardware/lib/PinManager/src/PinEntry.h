#ifndef PIN_ENTRY_H
#define PIN_ENTRY_H

#include <Arduino.h>
#include <GpioSwitch.h>
#include <GpioPwm.h>
#include <GpioAdc.h>
#include <AchaemenidConfigProtocol.h>
#include <Timer/TimerHandle.h>
#include <cstring>

enum class SegmentType : uint8_t {
    Output = 0,
    Input = 1,
    AnalogOutput = 2,
    AnalogInput = 3
};

inline SegmentType parseSegmentType(const char* typeStr) {
    if (typeStr == nullptr) return SegmentType::Output;
    if (strcmp(typeStr, "input") == 0) return SegmentType::Input;
    if (strcmp(typeStr, "analog_output") == 0 || strcmp(typeStr, "pwm_output") == 0) {
        return SegmentType::AnalogOutput;
    }
    if (strcmp(typeStr, "analog_input") == 0 || strcmp(typeStr, "adc_input") == 0) {
        return SegmentType::AnalogInput;
    }
    return SegmentType::Output;
}

inline const char* segmentTypeToString(SegmentType type) {
    switch (type) {
        case SegmentType::Input: return "input";
        case SegmentType::AnalogOutput: return "analog_output";
        case SegmentType::AnalogInput: return "analog_input";
        case SegmentType::Output:
        default: return "gpio_toggle";
    }
}

/**
 * @brief Lightweight change payload emitted by PinManager::processAnalogInputs().
 */
struct AnalogInputChange {
    int pin;
    unsigned long durationSec;
    uint16_t value;
    uint8_t resolution;
    bool valueChanged : 1;
    bool thresholdChanged : 1;
    bool thresholdState : 1;
};

/**
 * @brief Memory-optimized representation of a single managed hardware pin/segment.
 * Fields ordered to minimize CPU alignment padding on 32-bit Xtensa.
 */
struct PinEntry {
    // 32-byte identifier string
    char segmentId[32];
    
    // Complex objects and sub-structs (zero-heap inline drivers)
    RuleConfig rule;
    RuleAction pendingHoldAction;
    GpioSwitch gpio;
    GpioPwm pwm;
    GpioAdc adc;
    
    // Active timer handles
    uniuno::TimerHandle autoOffTimer;
    uniuno::TimerHandle cloudSyncTimer;
    uniuno::TimerHandle ruleActionTimer;
    uniuno::TimerHandle holdTimer;

    // Timestamps for duration tracking and debounce
    unsigned long stateStartTime;
    unsigned long lastDebounceTime;
    
    // Scaled fundamental types for compact footprint
    uint16_t autoOffDelay;
    int16_t pendingRuleActionAnalogValue;
    int8_t pinNumber;
    SegmentType type;
    
    // Bitfield flags (packed into a single byte)
    bool hasGpio : 1;
    bool hasPwm : 1;
    bool hasAdc : 1;
    bool lastInputState : 1;
    bool pendingRuleActionState : 1;
    bool isHandled : 1;
    bool active : 1;
};

#endif // PIN_ENTRY_H
