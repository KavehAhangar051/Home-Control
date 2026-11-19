#ifndef PIN_REGISTRY_H
#define PIN_REGISTRY_H

#include "PinEntry.h"
#include <Optimization/CompilerTraits.h>
#include <Timer/Optimization/TimerAsm.h>
#include <cstring>

static const int MAX_PINS = 16;

/**
 * @brief High-performance registry for pin entries with O(1) bitmask operations.
 */
class PinRegistry {
public:
    PinRegistry() : _activeMask(0) {
        for (int i = 0; i < MAX_PINS; i++) {
            _entries[i].active = false;
            _entries[i].hasGpio = false;
            _entries[i].hasPwm = false;
            _entries[i].segmentId[0] = '\0';
            _entries[i].pinNumber = -1;
            _entries[i].type = SegmentType::Output;
            _entries[i].autoOffDelay = 0;
            _entries[i].pendingRuleActionAnalogValue = RULE_ANALOG_VALUE_UNSET;
            _entries[i].lastInputState = false;
            _entries[i].pendingRuleActionState = false;
            _entries[i].pendingHoldAction = RuleAction();
            _entries[i].isHandled = false;
            _entries[i].stateStartTime = 0;
            _entries[i].lastDebounceTime = 0;
        }
        for (int i = 0; i < 40; i++) {
            _pinToIndex[i] = -1;
        }
    }

    HOT_PATH FORCE_INLINE PinEntry* getEntryByPin(int pin) {
        if (UNLIKELY(pin < 0 || pin >= 40)) return nullptr;
        const int8_t idx = _pinToIndex[pin];
        return (idx < 0) ? nullptr : &_entries[idx];
    }

    HOT_PATH FORCE_INLINE const PinEntry* getEntryByPinConst(int pin) const {
        if (UNLIKELY(pin < 0 || pin >= 40)) return nullptr;
        const int8_t idx = _pinToIndex[pin];
        return (idx < 0) ? nullptr : &_entries[idx];
    }

    HOT_PATH FORCE_INLINE PinEntry* getEntryByIndex(int index) {
        if (UNLIKELY(index < 0 || index >= MAX_PINS)) return nullptr;
        return &_entries[index];
    }

    HOT_PATH FORCE_INLINE const PinEntry* getEntryByIndexConst(int index) const {
        if (UNLIKELY(index < 0 || index >= MAX_PINS)) return nullptr;
        return &_entries[index];
    }

    /**
     * @brief Finds an empty slot in 1 CPU cycle using hardware bit scan.
     */
    HOT_PATH FORCE_INLINE int findEmptySlot() const {
        const uint16_t inactive = ~static_cast<uint16_t>(_activeMask);
        if (inactive == 0) return -1;
        return __builtin_ctz(inactive);
    }

    /**
     * @brief Returns active pin count in 1 CPU cycle using hardware popcount.
     */
    HOT_PATH FORCE_INLINE int getActiveCount() const {
        return __builtin_popcount(_activeMask);
    }

    HOT_PATH int findById(const char* id) const {
        if (UNLIKELY(id == nullptr || id[0] == '\0')) return -1;
        for (int i = 0; i < MAX_PINS; i++) {
            if (uniuno::asm_opt::test_bitmap_bit(_activeMask, i) && strcmp(_entries[i].segmentId, id) == 0) {
                return i;
            }
        }
        return -1;
    }

    HOT_PATH FORCE_INLINE void mapPin(int pin, int index) {
        if (pin >= 0 && pin < 40 && index >= 0 && index < MAX_PINS) {
            _pinToIndex[pin] = static_cast<int8_t>(index);
            uniuno::asm_opt::set_bitmap_bit(_activeMask, index);
        }
    }

    HOT_PATH FORCE_INLINE void unmapPin(int pin) {
        if (pin >= 0 && pin < 40) {
            const int8_t idx = _pinToIndex[pin];
            if (idx >= 0 && idx < MAX_PINS) {
                uniuno::asm_opt::clear_bitmap_bit(_activeMask, idx);
            }
            _pinToIndex[pin] = -1;
        }
    }

private:
    PinEntry _entries[MAX_PINS];
    int8_t _pinToIndex[40];
    uint32_t _activeMask;
};

#endif // PIN_REGISTRY_H
