#include "PinStateManager.h"
#include <Utilities/logging.h>
#include <Timer/Optimization/TimerAsm.h>
#include <Optimization/XtensaAnalogAsm.h>

#if defined(ESP32)
#include <soc/gpio_struct.h>
#define PIN_STATE_IRAM IRAM_ATTR
#else
#define PIN_STATE_IRAM
#endif

// Minimum duration in milliseconds to filter mechanical button contact bounce
static constexpr unsigned long DEBOUNCE_THRESHOLD_MS = 35;

static inline uint16_t maxScaleForBits(uint8_t bits) {
    if (bits < MIN_PWM_RESOLUTION) bits = MIN_PWM_RESOLUTION;
    if (bits > MAX_PWM_RESOLUTION) bits = MAX_PWM_RESOLUTION;
    return static_cast<uint16_t>((1UL << bits) - 1UL);
}

bool PinStateManager::setPinState(int pin, bool state) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->active) {
        return false;
    }

    if (entry->isVirtual) {
        if (entry->type == SegmentType::Output) {
            entry->virtualState = state;
            INFOF("[PinManager] Virtual Pin %d (node=%u rpin=%u) -> %s",
                  pin, entry->nodeId, entry->remotePin, state ? "ON" : "OFF");
            return true;
        }
        if (entry->type == SegmentType::AnalogOutput) {
            const uint16_t maxDuty = maxScaleForBits(entry->virtualPwmResolution);
            if (state) {
                const uint16_t restore = (entry->virtualLastNonZeroValue > 0 && entry->virtualLastNonZeroValue <= maxDuty)
                    ? entry->virtualLastNonZeroValue
                    : maxDuty;
                entry->virtualAnalogValue = restore;
                entry->virtualLastNonZeroValue = restore;
                entry->virtualState = true;
            } else {
                entry->virtualAnalogValue = 0;
                entry->virtualState = false;
            }
            INFOF("[PinManager] Virtual Pin %d PWM (node=%u rpin=%u) -> %s (duty=%u/%u)",
                  pin, entry->nodeId, entry->remotePin, state ? "ON" : "OFF",
                  entry->virtualAnalogValue, maxDuty);
            return true;
        }
        return false;
    }

    if (entry->hasGpio) {
        entry->gpio.setState(state);
        INFOF("[PinManager] Pin %d -> %s", pin, state ? "ON" : "OFF");
        return true;
    }

    if (entry->hasPwm) {
        entry->pwm.setState(state);
        INFOF("[PinManager] Pin %d (PWM) -> %s (duty=%u/%u)",
              pin, state ? "ON" : "OFF", entry->pwm.getValue(), entry->pwm.getMaxDuty());
        return true;
    }

    return false;
}

bool PinStateManager::setStateById(const char* id, bool state) {
    const int idx = _registry.findById(id);
    PinEntry* entry = _registry.getEntryByIndex(idx);
    if (!entry || !entry->active) {
        return false;
    }

    if (entry->isVirtual) {
        return setPinState(entry->pinNumber, state);
    }

    if (entry->hasGpio) {
        entry->gpio.setState(state);
        INFOF("[PinManager] '%s' (pin %d) -> %s", id, entry->pinNumber, state ? "ON" : "OFF");
        return true;
    }

    if (entry->hasPwm) {
        entry->pwm.setState(state);
        INFOF("[PinManager] '%s' (pin %d, PWM) -> %s (duty=%u/%u)",
              id, entry->pinNumber, state ? "ON" : "OFF", entry->pwm.getValue(), entry->pwm.getMaxDuty());
        return true;
    }

    return false;
}

bool PinStateManager::setPinAnalogValue(int pin, uint16_t value) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (UNLIKELY(!entry || !entry->active)) {
        return false;
    }

    if (entry->isVirtual) {
        if (entry->type != SegmentType::AnalogOutput) {
            return false;
        }
        const uint16_t maxDuty = maxScaleForBits(entry->virtualPwmResolution);
        const uint16_t clamped = (value > maxDuty) ? maxDuty : value;
        entry->virtualAnalogValue = clamped;
        if (clamped > 0) {
            entry->virtualLastNonZeroValue = clamped;
        }
        entry->virtualState = (clamped > 0);
        INFOF("[PinManager] Virtual Pin %d PWM (node=%u rpin=%u) -> %u/%u (%u-bit)",
              pin, entry->nodeId, entry->remotePin, clamped, maxDuty, entry->virtualPwmResolution);
        return true;
    }

    if (UNLIKELY(!entry->hasPwm)) {
        return false;
    }

    entry->pwm.setValue(value);
    INFOF("[PinManager] Pin %d PWM -> %u/%u (%u-bit)",
          pin, entry->pwm.getValue(), entry->pwm.getMaxDuty(), entry->pwm.getResolution());
    return true;
}

bool PinStateManager::setAnalogValueById(const char* id, uint16_t value) {
    const int idx = _registry.findById(id);
    PinEntry* entry = _registry.getEntryByIndex(idx);
    if (UNLIKELY(!entry || !entry->active)) {
        return false;
    }

    if (entry->isVirtual) {
        return setPinAnalogValue(entry->pinNumber, value);
    }

    if (UNLIKELY(!entry->hasPwm)) {
        return false;
    }

    entry->pwm.setValue(value);
    INFOF("[PinManager] '%s' (pin %d) PWM -> %u/%u (%u-bit)",
          id, entry->pinNumber, entry->pwm.getValue(), entry->pwm.getMaxDuty(), entry->pwm.getResolution());
    return true;
}

bool PinStateManager::readAnalogInputNow(int pin, AdcSampleResult& outResult) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (UNLIKELY(!entry || !entry->active || entry->type != SegmentType::AnalogInput)) {
        outResult = AdcSampleResult();
        return false;
    }

    if (entry->isVirtual) {
        outResult = AdcSampleResult();
        outResult.sampled = true;
        outResult.value = entry->virtualAnalogValue;
        outResult.thresholdState = entry->lastInputState;
        outResult.valueChanged = false;
        outResult.thresholdChanged = false;
        return true;
    }

    if (UNLIKELY(!entry->hasAdc)) {
        outResult = AdcSampleResult();
        return false;
    }

    // Safely preempt any background SAR1 async burst so hardware registers never collide
    if (_activeAdcSlot >= 0 && _activeAdcSlot < static_cast<int8_t>(_numAnalogInputs)) {
        PinEntry* activeEntry = _analogEntries[_activeAdcSlot];
        if (activeEntry && activeEntry->hasAdc) {
            activeEntry->adc.abortAsyncBurst();
        }
        _activeAdcSlot = -1;
    }

    const unsigned long now = millis();
    outResult = entry->adc.readNow(now);
    if (outResult.thresholdChanged) {
        entry->stateStartTime = now;
    }
    entry->lastInputState = outResult.thresholdState;
    _hasAnalogSchedule = false; // Recompute earliest deadline on next loop tick
    return outResult.sampled;
}

bool PinStateManager::injectVirtualInputState(
    int pin,
    bool state,
    unsigned long& outDurationSec,
    RuleConfig& outRule
) {
    outDurationSec = 0;
    outRule.reset();

    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->active || !entry->isVirtual || entry->type != SegmentType::Input) {
        return false;
    }
    if (entry->lastInputState == state) {
        return false;
    }

    const unsigned long now = millis();
    if (entry->stateStartTime > 0 && now > entry->stateStartTime) {
        outDurationSec = uniuno::xtensa_asm::asm_div1000_u32(
            static_cast<uint32_t>(now - entry->stateStartTime));
    }
    entry->stateStartTime = now;
    entry->lastDebounceTime = now;
    entry->lastInputState = state;
    entry->virtualState = state;
    outRule = entry->getRuleRef();
    return true;
}

bool PinStateManager::injectVirtualAnalogInput(
    int pin,
    uint16_t rawValue,
    AnalogInputChange& outChange,
    RuleConfig& outRule
) {
    outChange = AnalogInputChange{};
    outRule.reset();

    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->active || !entry->isVirtual || entry->type != SegmentType::AnalogInput) {
        return false;
    }

    const uint16_t maxScale = maxScaleForBits(entry->virtualAdcResolution);
    const uint16_t clamped = (rawValue > maxScale) ? maxScale : rawValue;
    const uint16_t prevValue = entry->virtualAnalogValue;
    const uint16_t diff = (clamped >= prevValue) ? (clamped - prevValue) : (prevValue - clamped);
    const bool valueChanged = (diff >= entry->virtualAdcDeltaThreshold) ||
                              (clamped != prevValue && (clamped == 0 || clamped == maxScale));

    bool nextThresholdState = entry->lastInputState;
    if (entry->virtualAdcHighThreshold > 0) {
        if (!entry->lastInputState && clamped >= entry->virtualAdcHighThreshold) {
            nextThresholdState = true;
        } else if (entry->lastInputState && clamped <= entry->virtualAdcLowThreshold) {
            nextThresholdState = false;
        }
    }
    const bool thresholdChanged = (nextThresholdState != entry->lastInputState);

    const unsigned long now = millis();
    unsigned long durationSec = 0;
    if (thresholdChanged) {
        if (entry->stateStartTime > 0 && now > entry->stateStartTime) {
            durationSec = uniuno::xtensa_asm::asm_div1000_u32(
                static_cast<uint32_t>(now - entry->stateStartTime));
        }
        entry->stateStartTime = now;
        entry->lastInputState = nextThresholdState;
    }

    if (valueChanged || thresholdChanged) {
        entry->virtualAnalogValue = clamped;
    } else {
        entry->virtualAnalogValue = clamped;
    }

    const RuleConfig& entryRule = entry->getRuleRef();
    bool rangeMaskChanged = false;
    if (entryRule.active && entryRule.analogRangeCount > 0) {
        const uint8_t prevMask = entry->analogRangeActiveMask;
        uint8_t nextMask = 0;
        const uint8_t count = (entryRule.analogRangeCount <= MAX_ANALOG_RANGE_RULES)
            ? entryRule.analogRangeCount
            : MAX_ANALOG_RANGE_RULES;
        for (uint8_t r = 0; r < count; ++r) {
            const AnalogRangeRule& rr = entryRule.analogRanges[r];
            if (!rr.enabled) continue;
            const bool wasIn = ((prevMask >> r) & 1U) != 0U;
            if (uniuno::xtensa_asm::asm_range_eval(
                    clamped, rr.minValue, rr.maxValue, rr.hysteresis, maxScale, wasIn)) {
                nextMask |= static_cast<uint8_t>(1U << r);
            }
        }
        rangeMaskChanged = (nextMask != prevMask);
    }

    if (!valueChanged && !thresholdChanged && !rangeMaskChanged) {
        return false;
    }

    outChange.pin = entry->pinNumber;
    outChange.durationSec = durationSec;
    outChange.value = clamped;
    outChange.resolution = entry->virtualAdcResolution;
    outChange.valueChanged = valueChanged;
    outChange.thresholdChanged = thresholdChanged;
    outChange.thresholdState = nextThresholdState;
    outChange.rangeMaskChanged = rangeMaskChanged;
    outRule = entryRule;
    return true;
}

void PinStateManager::rebuildInputCache() {
    // Abort any in-flight async SAR1 burst before mutating the cached pointer table
    if (_activeAdcSlot >= 0 && _activeAdcSlot < static_cast<int8_t>(_numAnalogInputs)) {
        PinEntry* activeEntry = _analogEntries[_activeAdcSlot];
        if (activeEntry && activeEntry->hasAdc) {
            activeEntry->adc.abortAsyncBurst();
        }
    }

    _numInputs = 0;
    _numAnalogInputs = 0;
    _inputMask0_31 = 0;
    _inputMask32_39 = 0;
    _lastInputs0_31 = 0;
    _lastInputs32_39 = 0;
    _nextAnalogSampleTime = 0;
    _lastAnalogGateCycle = 0;
    _activeAdcStartCycle = 0;
    _activeAdcSlot = -1;
    _analogRoundRobin = 0;
    _hasAnalogSchedule = false;

    for (int i = 0; i < MAX_PINS; i++) {
        _analogEntries[i] = nullptr;
        PinEntry* entry = _registry.getEntryByIndex(i);
        if (!entry || !entry->active || entry->isVirtual) continue;

        if (entry->type == SegmentType::Input) {
            _inputIndices[_numInputs++] = static_cast<uint8_t>(i);
            const int pin = entry->pinNumber;
            if (pin < 32) {
                const uint32_t bit = (1UL << pin);
                _inputMask0_31 |= bit;
                if (entry->lastInputState) _lastInputs0_31 |= bit;
            } else if (pin < 40) {
                const uint32_t bit = (1UL << (pin - 32));
                _inputMask32_39 |= bit;
                if (entry->lastInputState) _lastInputs32_39 |= bit;
            }
        } else if (entry->type == SegmentType::AnalogInput && entry->hasAdc) {
            _analogEntries[_numAnalogInputs++] = entry;
        }
    }

    // Pre-calculate round-robin lookup table to eliminate runtime modulo in hot loop
    for (uint8_t start = 0; start < MAX_PINS; ++start) {
        for (uint8_t step = 0; step < MAX_PINS; ++step) {
            _analogSlotOrder[start][step] = (_numAnalogInputs > 0)
                ? static_cast<uint8_t>((start + step) % _numAnalogInputs)
                : 0;
        }
    }
}

/**
 * @brief Hardware bit-scan input processor (O(changed_pins)).
 * Triggered only after PinManager::processInputs() detects a hardware GPIO bit flip.
 * Uses Xtensa hardware ctz (nsau) to visit strictly the changed pins instead of scanning all inputs.
 */
HOT_PATH PIN_STATE_IRAM void PinStateManager::processInputs(
    const uniuno::StaticFunction<void, int, bool, unsigned long, const RuleConfig&>& onInputChanged) {
    if (UNLIKELY(_numInputs == 0)) return;

#if defined(ESP32)
    const uint32_t current0_31 = GPIO.in;
    const uint32_t current32_39 = GPIO.in1.val;

    uint32_t changed0_31 = (current0_31 ^ _lastInputs0_31) & _inputMask0_31;
    uint32_t changed32_39 = (current32_39 ^ _lastInputs32_39) & _inputMask32_39;

    if (LIKELY((changed0_31 | changed32_39) == 0)) {
        return;
    }

    const unsigned long currentMillis = millis();

    auto handleTransition = [&](int pin, bool currentState) {
        PinEntry* entry = _registry.getEntryByPin(pin);
        if (UNLIKELY(!entry)) return;

        // Software Debounce: Ignore mechanical bounces under threshold with branchless asm comparison
        if (!uniuno::asm_opt::is_timer_expired(currentMillis, entry->lastDebounceTime + DEBOUNCE_THRESHOLD_MS)) {
            return;
        }

        entry->lastDebounceTime = currentMillis;

        // Compute hold duration using fast ~4-cycle reciprocal multiply (avoids ~40-cycle software division)
        unsigned long durationSec = 0;
        if (entry->stateStartTime > 0 && currentMillis > entry->stateStartTime) {
            durationSec = uniuno::xtensa_asm::asm_div1000_u32(
                static_cast<uint32_t>(currentMillis - entry->stateStartTime));
        }
        entry->stateStartTime = currentMillis;
        entry->lastInputState = currentState;

        // Update shadow bitmasks for fast-path comparison using single-instruction asm
        if (pin < 32) {
            if (currentState) uniuno::asm_opt::set_bitmap_bit(_lastInputs0_31, pin);
            else uniuno::asm_opt::clear_bitmap_bit(_lastInputs0_31, pin);
        } else if (pin < 40) {
            if (currentState) uniuno::asm_opt::set_bitmap_bit(_lastInputs32_39, pin - 32);
            else uniuno::asm_opt::clear_bitmap_bit(_lastInputs32_39, pin - 32);
        }

        if (onInputChanged) {
            onInputChanged(pin, currentState, durationSec, entry->getRuleRef());
        }
    };

    // O(changed_pins): Process ONLY pins whose hardware bit actually flipped
    while (changed0_31) {
        const int pin = __builtin_ctz(changed0_31);
        changed0_31 &= changed0_31 - 1;
        handleTransition(pin, uniuno::asm_opt::test_bitmap_bit(current0_31, pin));
    }

    while (changed32_39) {
        const int bitIdx = __builtin_ctz(changed32_39);
        changed32_39 &= changed32_39 - 1;
        handleTransition(32 + bitIdx, uniuno::asm_opt::test_bitmap_bit(current32_39, bitIdx));
    }
#else
    const unsigned long currentMillis = millis();

    for (uint8_t i = 0; i < _numInputs; i++) {
        const uint8_t idx = _inputIndices[i];
        PinEntry* entry = _registry.getEntryByIndex(idx);
        if (UNLIKELY(!entry)) continue;

        const int pin = entry->pinNumber;
        const bool currentState = digitalRead(pin) == HIGH;

        if (currentState != entry->lastInputState) {
            if (!uniuno::asm_opt::is_timer_expired(currentMillis, entry->lastDebounceTime + DEBOUNCE_THRESHOLD_MS)) {
                continue;
            }

            entry->lastDebounceTime = currentMillis;

            unsigned long durationSec = 0;
            if (entry->stateStartTime > 0 && currentMillis > entry->stateStartTime) {
                durationSec = uniuno::xtensa_asm::asm_div1000_u32(
                    static_cast<uint32_t>(currentMillis - entry->stateStartTime));
            }
            entry->stateStartTime = currentMillis;
            entry->lastInputState = currentState;

            if (onInputChanged) {
                onInputChanged(pin, currentState, durationSec, entry->getRuleRef());
            }
        }
    }
#endif
}

/**
 * @brief Non-blocking pipelined SAR1 ADC1 analog input scheduler.
 *
 * On ESP32:
 * - Coordinates all active analog_input segments round-robin over the single SAR1 unit.
 * - Starts a 4-sample hardware burst in ~4 CPU cycles and immediately returns to loop().
 * - Collects each finished conversion in ~3 CPU cycles and launches the next oversample
 *   without ever stalling the CPU.
 * - Recomputes the earliest next deadline so idle loop() ticks stay in the 3-cycle CCOUNT gate.
 */
HOT_PATH PIN_STATE_IRAM void PinStateManager::processAnalogInputs(
    const uniuno::StaticFunction<void, const AnalogInputChange&, const RuleConfig&>& onAnalogChanged) {
    if (UNLIKELY(_numAnalogInputs == 0)) return;

    auto emitAnalogResult = [&](PinEntry* entry, const AdcSampleResult& res, unsigned long nowMs) {
        if (!res.sampled) return;

        unsigned long durationSec = 0;
        if (res.thresholdChanged) {
            if (entry->stateStartTime > 0 && nowMs > entry->stateStartTime) {
                durationSec = uniuno::xtensa_asm::asm_div1000_u32(
                    static_cast<uint32_t>(nowMs - entry->stateStartTime));
            }
            entry->stateStartTime = nowMs;
            entry->lastInputState = res.thresholdState;
        }

        // Branchless Xtensa check: detect if ANY configured analog range boundary was crossed
        // even when res.valueChanged is false (e.g. deltaThreshold > step size).
        const RuleConfig& entryRule = entry->getRuleRef();
        bool rangeMaskChanged = false;
        if (entryRule.active && entryRule.analogRangeCount > 0) {
            const uint16_t maxScale = entry->adc.getMaxValue();
            const uint8_t prevMask = entry->analogRangeActiveMask;
            uint8_t nextMask = 0;
            const uint8_t count = entryRule.analogRangeCount <= MAX_ANALOG_RANGE_RULES
                ? entryRule.analogRangeCount
                : MAX_ANALOG_RANGE_RULES;
            for (uint8_t r = 0; r < count; ++r) {
                const AnalogRangeRule& rr = entryRule.analogRanges[r];
                if (!rr.enabled) continue;
                const bool wasIn = ((prevMask >> r) & 1U) != 0U;
                if (uniuno::xtensa_asm::asm_range_eval(
                        res.value, rr.minValue, rr.maxValue, rr.hysteresis, maxScale, wasIn)) {
                    nextMask |= static_cast<uint8_t>(1U << r);
                }
            }
            rangeMaskChanged = (nextMask != prevMask);
        }

        if ((res.valueChanged || res.thresholdChanged || rangeMaskChanged) && onAnalogChanged) {
            AnalogInputChange change;
            change.pin = entry->pinNumber;
            change.durationSec = durationSec;
            change.value = res.value;
            change.resolution = entry->adc.getResolution();
            change.valueChanged = res.valueChanged;
            change.thresholdChanged = res.thresholdChanged;
            change.thresholdState = res.thresholdState;
            change.rangeMaskChanged = rangeMaskChanged;
            onAnalogChanged(change, entryRule);
        }
    };

#if defined(ESP32)
    // Phase 1: If a SAR1 hardware burst is currently in flight, service it without stalling!
    if (_activeAdcSlot >= 0) {
        if (UNLIKELY(_activeAdcSlot >= static_cast<int8_t>(_numAnalogInputs))) {
            _activeAdcSlot = -1;
        } else {
            PinEntry* activeEntry = _analogEntries[_activeAdcSlot];
            if (UNLIKELY(!activeEntry || !activeEntry->active || !activeEntry->hasAdc)) {
                _activeAdcSlot = -1;
            } else {
                AdcSampleResult res;
                const unsigned long nowMs = millis();
                if (!activeEntry->adc.pollAsyncBurst(nowMs, res)) {
                    // Still converting or next oversample launched -> keep _activeAdcStartCycle fresh
                    _activeAdcStartCycle = uniuno::asm_opt::get_cpu_cycle_count();
                    return;
                }

                // Burst finished (4/4 oversamples + branchless DSP complete!)
                _activeAdcSlot = -1;
                emitAnalogResult(activeEntry, res, nowMs);
                // Fall through to immediately start any other overdue channel or update next deadline
            }
        }
    }

    // Phase 2: Find next due channel (round-robin) and launch non-blocking SAR1 burst (~4 cycles)
    const unsigned long currentMillis = millis();
    bool hasNext = false;
    unsigned long earliestNext = 0;
    int8_t dueSlot = -1;

    for (uint8_t step = 0; step < _numAnalogInputs; ++step) {
        const uint8_t slot = _analogSlotOrder[_analogRoundRobin][step];
        PinEntry* entry = _analogEntries[slot];
        if (UNLIKELY(!entry || !entry->active || !entry->hasAdc)) continue;

        const unsigned long nextDue = entry->adc.getLastSampleTime() + entry->adc.getSampleIntervalMs();
        if (dueSlot < 0 && uniuno::asm_opt::is_timer_expired(currentMillis, nextDue)) {
            dueSlot = static_cast<int8_t>(slot);
            _analogRoundRobin = _analogSlotOrder[slot][1];
        }

        if (!hasNext || static_cast<long>(nextDue - earliestNext) < 0) {
            earliestNext = nextDue;
            hasNext = true;
        }
    }

    if (dueSlot >= 0) {
        PinEntry* dueEntry = _analogEntries[dueSlot];
        if (LIKELY(dueEntry->adc.startAsyncBurst())) {
            _activeAdcSlot = dueSlot;
            _activeAdcStartCycle = uniuno::asm_opt::get_cpu_cycle_count();
            return;
        }
    }

    _nextAnalogSampleTime = earliestNext;
    _hasAnalogSchedule = hasNext;
    _lastAnalogGateCycle = uniuno::asm_opt::get_cpu_cycle_count();
#else
    // Deterministic synchronous path for native host unit tests
    const unsigned long currentMillis = millis();
    bool hasNext = false;
    unsigned long earliestNext = 0;

    for (uint8_t i = 0; i < _numAnalogInputs; ++i) {
        PinEntry* entry = _analogEntries[i];
        if (UNLIKELY(!entry || !entry->active || !entry->hasAdc)) continue;

        const AdcSampleResult res = entry->adc.sample(currentMillis);
        const unsigned long nextDue = entry->adc.getLastSampleTime() + entry->adc.getSampleIntervalMs();
        if (!hasNext || static_cast<long>(nextDue - earliestNext) < 0) {
            earliestNext = nextDue;
            hasNext = true;
        }

        emitAnalogResult(entry, res, currentMillis);
    }

    _nextAnalogSampleTime = earliestNext;
    _hasAnalogSchedule = hasNext;
#endif
}
