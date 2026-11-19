#include "PinStateManager.h"
#include <Utilities/logging.h>
#include <Timer/Optimization/TimerAsm.h>

#if defined(ESP32)
#include <soc/gpio_struct.h>
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
    if (!entry || !entry->active || !entry->hasPwm) {
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
    if (!entry || !entry->active || !entry->hasPwm) {
        return false;
    }

    entry->pwm.setValue(value);
    INFOF("[PinManager] '%s' (pin %d) PWM -> %u/%u (%u-bit)",
          id, entry->pinNumber, entry->pwm.getValue(), entry->pwm.getMaxDuty(), entry->pwm.getResolution());
    return true;
}

void PinStateManager::rebuildInputCache() {
    _numInputs = 0;
    _inputMask0_31 = 0;
    _inputMask32_39 = 0;
    _lastInputs0_31 = 0;
    _lastInputs32_39 = 0;

    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (entry && entry->active && entry->type == SegmentType::Input) {
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
        }
    }
}

/**
 * @brief Hardware bit-scan input processor (O(changed_pins)).
 * Triggered only after PinManager::processInputs() detects a hardware GPIO bit flip.
 * Uses Xtensa hardware ctz (nsau) to visit strictly the changed pins instead of scanning all inputs.
 */
HOT_PATH IRAM_ATTR void PinStateManager::processInputs(
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

        // Compute hold duration of the preceding stable state in seconds
        unsigned long durationSec = 0;
        if (entry->stateStartTime > 0 && currentMillis > entry->stateStartTime) {
            durationSec = (currentMillis - entry->stateStartTime) / 1000;
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
                durationSec = (currentMillis - entry->stateStartTime) / 1000;
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
