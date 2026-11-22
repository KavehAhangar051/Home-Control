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
    bool rangeMaskChanged : 1;
};

/**
 * @brief Memory-optimized representation of a single managed hardware pin/segment.
 * Hot fields placed in the primary cache line to eliminate L1 cache misses in loop().
 */
struct PinEntry {
    // --- HOT FIELDS: First cache line for high-frequency loop scanning ---
    int8_t pinNumber;
    SegmentType type;
    uint8_t analogRangeActiveMask; // Bit i = 1 iff analogRanges[i] is currently active
    uint8_t clickCount;            // Pending click count for digital double-click detection (0..2)
    uint8_t nodeId;                // 0 = local ESP32 GPIO, 1..16 = auxiliary ESP node ID
    uint8_t remotePin;             // Remote GPIO on auxiliary node (0..39), REMOTE_PIN_UNSET for local
    
    // Bitfield flags
    bool hasGpio : 1;
    bool hasPwm : 1;
    bool hasAdc : 1;
    bool lastInputState : 1;
    bool pendingRuleActionState : 1;
    bool isHandled : 1;
    bool clickPolarity : 1;
    bool active : 1;
    bool isVirtual : 1;
    bool virtualState : 1;

    // Timestamps for duration tracking, debounce, and double-click detection
    unsigned long stateStartTime;
    unsigned long lastDebounceTime;
    unsigned long lastClickTimeMs;

    uint16_t autoOffDelay;
    int16_t pendingRuleActionAnalogValue;

    // Virtual segment shadow state & configuration (used only when isVirtual == true)
    uint16_t virtualAnalogValue;
    uint16_t virtualLastNonZeroValue;
    uint16_t virtualPwmFrequency;
    uint16_t virtualAdcSampleIntervalMs;
    uint16_t virtualAdcDeltaThreshold;
    uint16_t virtualAdcHighThreshold;
    uint16_t virtualAdcLowThreshold;
    uint8_t virtualPwmResolution;
    uint8_t virtualAdcResolution;

    // Rule config used directly on state changes
    RuleConfig rule;

    // --- SECONDARY DRIVER OBJECTS ---
    GpioSwitch gpio;
    GpioPwm pwm;
    GpioAdc adc;

    // Active timer handles
    uniuno::TimerHandle autoOffTimer;
    uniuno::TimerHandle cloudSyncTimer;
    uniuno::TimerHandle ruleActionTimer;
    uniuno::TimerHandle holdTimer;
    uniuno::TimerHandle doubleClickTimer;

    RuleAction pendingHoldAction;

    // 32-byte identifier string (cold path: only for setup / config export)
    char segmentId[32];
};

#endif // PIN_ENTRY_H
