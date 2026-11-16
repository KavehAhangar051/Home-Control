#include "PinStateManager.h"
#include <Utilities/logging.h>

#if defined(ESP32)
#include <soc/gpio_struct.h>
#endif

// Minimum duration in milliseconds to filter mechanical button contact bounce
static constexpr unsigned long DEBOUNCE_THRESHOLD_MS = 35;

bool PinStateManager::setPinState(int pin, bool state) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->hasGpio) {
        return false;
    }

    entry->gpio.setState(state);
    INFOF("[PinManager] Pin %d -> %s", pin, state ? "ON" : "OFF");
    return true;
}

bool PinStateManager::setStateById(const char* id, bool state) {
    const int idx = _registry.findById(id);
    PinEntry* entry = _registry.getEntryByIndex(idx);
    if (!entry || !entry->hasGpio) {
        return false;
    }

    entry->gpio.setState(state);
    INFOF("[PinManager] '%s' (pin %d) -> %s", id, entry->pinNumber, state ? "ON" : "OFF");
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
 * @brief Ultra-fast input processor with 2-cycle hardware bitmask change detection.
 * Executes on every loop() iteration. In 99.99% of cycles when no inputs change,
 * exits in ~12ns without invoking millis() or traversing arrays.
 */
HOT_PATH IRAM_ATTR void PinStateManager::processInputs(
    uniuno::StaticFunction<void, int, bool, unsigned long, const RuleConfig&> onInputChanged) {
    if (UNLIKELY(_numInputs == 0)) return;

#if defined(ESP32)
    const uint32_t current0_31 = GPIO.in;
    const uint32_t current32_39 = GPIO.in1.val;

    // FAST-PATH: Detect any input pin transition in ~2 CPU cycles using bitwise logic
    const uint32_t changed0_31 = (current0_31 ^ _lastInputs0_31) & _inputMask0_31;
    const uint32_t changed32_39 = (current32_39 ^ _lastInputs32_39) & _inputMask32_39;

    if (LIKELY((changed0_31 | changed32_39) == 0)) {
        return; // Zero pins changed state; immediate return to main loop
    }
#endif

    const unsigned long currentMillis = millis();

    for (uint8_t i = 0; i < _numInputs; i++) {
        const uint8_t idx = _inputIndices[i];
        PinEntry* entry = _registry.getEntryByIndex(idx);
        if (UNLIKELY(!entry)) continue;

        const int pin = entry->pinNumber;
        bool currentState = false;
#if defined(ESP32)
        if (pin < 32) {
            currentState = (current0_31 & (1UL << pin)) != 0;
        } else if (pin < 40) {
            currentState = (current32_39 & (1UL << (pin - 32))) != 0;
        }
#else
        currentState = digitalRead(pin) == HIGH;
#endif

        if (currentState != entry->lastInputState) {
            // Software Debounce: Ignore mechanical bounces under threshold
            if ((currentMillis - entry->lastDebounceTime) < DEBOUNCE_THRESHOLD_MS) {
                continue;
            }

            entry->lastDebounceTime = currentMillis;

            // Compute hold duration of the preceding stable state in seconds
            unsigned long durationSec = 0;
            if (entry->stateStartTime > 0 && currentMillis > entry->stateStartTime) {
                durationSec = (currentMillis - entry->stateStartTime) / 1000;
            }
            entry->stateStartTime = currentMillis;
            entry->lastInputState = currentState;

#if defined(ESP32)
            // Update shadow bitmasks for fast-path comparison
            if (pin < 32) {
                const uint32_t bit = (1UL << pin);
                if (currentState) _lastInputs0_31 |= bit;
                else _lastInputs0_31 &= ~bit;
            } else if (pin < 40) {
                const uint32_t bit = (1UL << (pin - 32));
                if (currentState) _lastInputs32_39 |= bit;
                else _lastInputs32_39 &= ~bit;
            }
#endif

            if (onInputChanged) {
                onInputChanged(pin, currentState, durationSec, entry->rule);
            }
        }
    }
}
