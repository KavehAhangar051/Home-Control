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

bool PinStateManager::setPinState(int pin, bool state) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->active) {
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
    if (UNLIKELY(!entry || !entry->active || !entry->hasPwm)) {
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
    if (UNLIKELY(!entry || !entry->active || !entry->hasPwm)) {
        return false;
    }

    entry->pwm.setValue(value);
    INFOF("[PinManager] '%s' (pin %d) PWM -> %u/%u (%u-bit)",
          id, entry->pinNumber, entry->pwm.getValue(), entry->pwm.getMaxDuty(), entry->pwm.getResolution());
    return true;
}

bool PinStateManager::readAnalogInputNow(int pin, AdcSampleResult& outResult) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (UNLIKELY(!entry || !entry->active || entry->type != SegmentType::AnalogInput || !entry->hasAdc)) {
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
        if (!entry || !entry->active) continue;

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
            onInputChanged(pin, currentState, durationSec, entry->rule);
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
                onInputChanged(pin, currentState, durationSec, entry->rule);
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

        if ((res.valueChanged || res.thresholdChanged) && onAnalogChanged) {
            AnalogInputChange change;
            change.pin = entry->pinNumber;
            change.durationSec = durationSec;
            change.value = res.value;
            change.resolution = entry->adc.getResolution();
            change.valueChanged = res.valueChanged;
            change.thresholdChanged = res.thresholdChanged;
            change.thresholdState = res.thresholdState;
            onAnalogChanged(change, entry->rule);
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
        const uint8_t slot = static_cast<uint8_t>((_analogRoundRobin + step) % _numAnalogInputs);
        PinEntry* entry = _analogEntries[slot];
        if (UNLIKELY(!entry || !entry->active || !entry->hasAdc)) continue;

        const unsigned long nextDue = entry->adc.getLastSampleTime() + entry->adc.getSampleIntervalMs();
        if (dueSlot < 0 && uniuno::asm_opt::is_timer_expired(currentMillis, nextDue)) {
            dueSlot = static_cast<int8_t>(slot);
            _analogRoundRobin = static_cast<uint8_t>((slot + 1U) % _numAnalogInputs);
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
