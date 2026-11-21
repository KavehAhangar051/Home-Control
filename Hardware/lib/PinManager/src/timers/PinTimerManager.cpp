#include "PinTimerManager.h"

int PinTimerManager::findPinByRuleActionTimerId(uniuno::TimerId timerId) const {
    if (timerId == uniuno::INVALID_TIMER_ID) return -1;
    
    // O(1) direct reverse LUT check
    const uint16_t idx = timerId.getIndex();
    if (idx < MAX_TIMER_MAP_ENTRIES && _ruleTimerMap[idx].id == timerId) {
        return _ruleTimerMap[idx].pin;
    }

    // Safety fallback
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (entry && entry->active && entry->ruleActionTimer.getId() == timerId) {
            return entry->pinNumber;
        }
    }
    return -1;
}

int PinTimerManager::findPinByHoldTimerId(uniuno::TimerId timerId) const {
    if (timerId == uniuno::INVALID_TIMER_ID) return -1;

    // O(1) direct reverse LUT check
    const uint16_t idx = timerId.getIndex();
    if (idx < MAX_TIMER_MAP_ENTRIES && _holdTimerMap[idx].id == timerId) {
        return _holdTimerMap[idx].pin;
    }

    // Safety fallback
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (entry && entry->active && entry->holdTimer.getId() == timerId) {
            return entry->pinNumber;
        }
    }
    return -1;
}
