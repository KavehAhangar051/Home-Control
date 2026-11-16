#ifndef PIN_ENTRY_H
#define PIN_ENTRY_H

#include <Arduino.h>
#include <GpioSwitch.h>
#include <AchaemenidConfigProtocol.h>
#include <Timer/TimerHandle.h>

enum class SegmentType : uint8_t {
    Output,
    Input
};

/**
 * @brief Memory-optimized representation of a single managed hardware pin/segment.
 * Fields ordered to minimize CPU alignment padding on 32-bit Xtensa.
 */
struct PinEntry {
    // 32-byte identifier string
    char segmentId[32];
    
    // Complex objects and sub-structs
    RuleConfig rule;
    RuleAction pendingHoldAction;
    GpioSwitch gpio;
    
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
    int8_t pinNumber;
    SegmentType type;
    
    // Bitfield flags (packed into a single byte)
    bool hasGpio : 1;
    bool lastInputState : 1;
    bool pendingRuleActionState : 1;
    bool isHandled : 1;
    bool active : 1;
};

#endif // PIN_ENTRY_H
