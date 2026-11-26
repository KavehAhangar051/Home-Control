#ifndef PIN_REGISTRY_H
#define PIN_REGISTRY_H

#include "PinEntry.h"
#include <Optimization/CompilerTraits.h>
#include <Timer/Optimization/TimerAsm.h>
#include <cstring>

static const int MAX_PINS = MAX_SEGMENTS;

/**
 * @brief High-performance registry for pin entries with O(1) bitmask operations
 * and pre-computed djb2 string hashes for accelerated ID lookup.
 * Supports local ESP32 GPIOs (0..39) and virtual auxiliary ESP pins (40..127).
 */
class PinRegistry {
public:
    PinRegistry() : _activeMask(0ULL) {
        for (int i = 0; i < MAX_PINS; i++) {
            _segmentIdHashes[i] = 0;
            _entries[i].active = false;
            _entries[i].isVirtual = false;
            _entries[i].virtualState = false;
            _entries[i].hasGpio = false;
            _entries[i].hasPwm = false;
            _entries[i].hasAdc = false;
            _entries[i].segmentId[0] = '\0';
            _entries[i].pinNumber = -1;
            _entries[i].nodeId = AUX_NODE_ID_LOCAL;
            _entries[i].remotePin = REMOTE_PIN_UNSET;
            _entries[i].type = SegmentType::Output;
            _entries[i].autoOffDelay = 0;
            _entries[i].pendingRuleActionAnalogValue = RULE_ANALOG_VALUE_UNSET;
            _entries[i].virtualAnalogValue = 0;
            _entries[i].virtualLastNonZeroValue = 0;
            _entries[i].virtualPwmFrequency = DEFAULT_PWM_FREQUENCY;
            _entries[i].virtualAdcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
            _entries[i].virtualAdcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
            _entries[i].virtualAdcHighThreshold = 0;
            _entries[i].virtualAdcLowThreshold = 0;
            _entries[i].virtualPwmResolution = DEFAULT_PWM_RESOLUTION;
            _entries[i].virtualAdcResolution = DEFAULT_ADC_RESOLUTION;
            _entries[i].lastInputState = false;
            _entries[i].pendingRuleActionState = false;
            _entries[i].pendingHoldAction = RuleAction();
            _entries[i].isHandled = false;
            _entries[i].clickCount = 0;
            _entries[i].clickPolarity = false;
            _entries[i].analogRangeActiveMask = 0;
            _entries[i].stateStartTime = 0;
            _entries[i].lastDebounceTime = 0;
            _entries[i].lastClickTimeMs = 0;
            _entries[i].rule = nullptr;
        }
        for (int i = 0; i < TOTAL_PIN_SLOTS; i++) {
            _pinToIndex[i] = -1;
        }
    }

    ~PinRegistry() {
        for (int i = 0; i < MAX_PINS; i++) {
            _entries[i].clearRule();
        }
    }

    HOT_PATH FORCE_INLINE PinEntry* getEntryByPin(int pin) {
        if (UNLIKELY(!isValidManagedPin(pin))) return nullptr;
        const int8_t idx = _pinToIndex[pin];
        return (idx < 0) ? nullptr : &_entries[idx];
    }

    HOT_PATH FORCE_INLINE const PinEntry* getEntryByPinConst(int pin) const {
        if (UNLIKELY(!isValidManagedPin(pin))) return nullptr;
        const int8_t idx = _pinToIndex[pin];
        return (idx < 0) ? nullptr : &_entries[idx];
    }

    HOT_PATH FORCE_INLINE int findIndexByPin(int pin) const {
        if (UNLIKELY(!isValidManagedPin(pin))) return -1;
        return static_cast<int>(_pinToIndex[pin]);
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
     * @brief Finds an empty slot in O(1) using 64-bit trailing-zero scan.
     */
    HOT_PATH FORCE_INLINE int findEmptySlot() const {
        static constexpr uint64_t kValidMask =
            (MAX_PINS >= 64) ? ~0ULL : ((1ULL << MAX_PINS) - 1ULL);
        const uint64_t inactive = (~_activeMask) & kValidMask;
        if (inactive == 0ULL) return -1;
        return __builtin_ctzll(inactive);
    }

    /**
     * @brief Returns active pin count using 64-bit hardware popcount.
     */
    HOT_PATH FORCE_INLINE int getActiveCount() const {
        return __builtin_popcountll(_activeMask);
    }

    HOT_PATH FORCE_INLINE bool isSlotActive(int index) const {
        if (UNLIKELY(index < 0 || index >= MAX_PINS)) return false;
        return (_activeMask & (1ULL << static_cast<unsigned int>(index))) != 0ULL;
    }

    /**
     * @brief O(1) hash-accelerated segment lookup, avoiding strcmp across non-matching slots.
     */
    HOT_PATH int findById(const char* id) const {
        if (UNLIKELY(id == nullptr || id[0] == '\0')) return -1;
        uint32_t targetHash = 5381;
        const char* s = id;
        while (*s) targetHash = ((targetHash << 5) + targetHash) + static_cast<uint8_t>(*s++);

        for (int i = 0; i < MAX_PINS; i++) {
            if (isSlotActive(i) && _segmentIdHashes[i] == targetHash) {
                if (strcmp(_entries[i].segmentId, id) == 0) {
                    return i;
                }
            }
        }
        return -1;
    }

    /**
     * @brief Finds an active virtual segment bound to the given (nodeId, remotePin) pair.
     */
    int findVirtualByNodeAndRemotePin(uint8_t nodeId, uint8_t remotePin) const {
        if (!isValidAuxNodeId(nodeId) || !isValidAuxRemotePin(remotePin)) return -1;
        for (int i = 0; i < MAX_PINS; ++i) {
            if (isSlotActive(i) && _entries[i].isVirtual &&
                _entries[i].nodeId == nodeId && _entries[i].remotePin == remotePin) {
                return i;
            }
        }
        return -1;
    }

    HOT_PATH FORCE_INLINE void mapPin(int pin, int index) {
        if (isValidManagedPin(pin) && index >= 0 && index < MAX_PINS) {
            _pinToIndex[pin] = static_cast<int8_t>(index);
            _activeMask |= (1ULL << static_cast<unsigned int>(index));
            uint32_t h = 5381;
            const char* s = _entries[index].segmentId;
            while (*s) h = ((h << 5) + h) + static_cast<uint8_t>(*s++);
            _segmentIdHashes[index] = h;
        }
    }

    HOT_PATH FORCE_INLINE void unmapPin(int pin) {
        if (isValidManagedPin(pin)) {
            const int8_t idx = _pinToIndex[pin];
            if (idx >= 0 && idx < MAX_PINS) {
                _activeMask &= ~(1ULL << static_cast<unsigned int>(idx));
                _segmentIdHashes[idx] = 0;
            }
            _pinToIndex[pin] = -1;
        }
    }

private:
    PinEntry _entries[MAX_PINS];
    uint32_t _segmentIdHashes[MAX_PINS];
    int8_t _pinToIndex[TOTAL_PIN_SLOTS];
    uint64_t _activeMask;
};

#endif // PIN_REGISTRY_H
