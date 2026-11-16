#ifndef PIN_STATE_MANAGER_H
#define PIN_STATE_MANAGER_H

#include "../PinRegistry.h"
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticFunction.h>

/**
 * @brief Manages GPIO input and output states with hardware-accelerated bitmask scanning.
 */
class PinStateManager {
public:
    PinStateManager(PinRegistry& registry)
        : _registry(registry),
          _inputMask0_31(0),
          _inputMask32_39(0),
          _lastInputs0_31(0),
          _lastInputs32_39(0),
          _numInputs(0) {}

    bool setPinState(int pin, bool state);
    bool setStateById(const char* id, bool state);

    HOT_PATH FORCE_INLINE bool getPinState(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry) return false;
        if (entry->type == SegmentType::Input) {
            return entry->lastInputState;
        }
        if (!entry->hasGpio) return false;
        return entry->gpio.getState();
    }

    HOT_PATH void processInputs(uniuno::StaticFunction<void, int, bool, unsigned long, const RuleConfig&> onInputChanged);
    void rebuildInputCache();

    HOT_PATH FORCE_INLINE RuleConfig getRuleByPin(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        return entry ? entry->rule : RuleConfig();
    }

    HOT_PATH FORCE_INLINE bool getIsHandledByPin(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        return entry ? entry->isHandled : false;
    }

    HOT_PATH FORCE_INLINE void setIsHandledByPin(int pin, bool handled) {
        PinEntry* entry = _registry.getEntryByPin(pin);
        if (entry) entry->isHandled = handled;
    }

    HOT_PATH FORCE_INLINE bool getPendingRuleActionState(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        return entry ? entry->pendingRuleActionState : false;
    }

    HOT_PATH FORCE_INLINE void setPendingRuleActionState(int pin, bool state) {
        PinEntry* entry = _registry.getEntryByPin(pin);
        if (entry) entry->pendingRuleActionState = state;
    }

    HOT_PATH FORCE_INLINE RuleAction getPendingHoldAction(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        return entry ? entry->pendingHoldAction : RuleAction();
    }

    HOT_PATH FORCE_INLINE void setPendingHoldAction(int pin, const RuleAction& action) {
        PinEntry* entry = _registry.getEntryByPin(pin);
        if (entry) entry->pendingHoldAction = action;
    }

private:
    PinRegistry& _registry;
    uint32_t _inputMask0_31;
    uint32_t _inputMask32_39;
    uint32_t _lastInputs0_31;
    uint32_t _lastInputs32_39;
    uint8_t _inputIndices[MAX_PINS];
    uint8_t _numInputs;
};

#endif // PIN_STATE_MANAGER_H
