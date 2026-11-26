#ifndef PIN_TIMER_MANAGER_H
#define PIN_TIMER_MANAGER_H

#include "../PinRegistry.h"
#include <Optimization/CompilerTraits.h>
#include <Timer/TimerHandle.h>

static constexpr size_t MAX_TIMER_MAP_ENTRIES = 64;

struct TimerPinMapEntry {
  uniuno::TimerId id;
  int8_t pin;
};

/**
 * @brief Manages timer handles associated with each hardware pin.
 * Includes O(1) reverse lookup tables (Timer ID -> Pin).
 */
class PinTimerManager {
public:
  PinTimerManager(PinRegistry& registry) : _registry(registry) {
    for (size_t i = 0; i < MAX_TIMER_MAP_ENTRIES; ++i) {
      _ruleTimerMap[i] = {uniuno::INVALID_TIMER_ID, -1};
      _holdTimerMap[i] = {uniuno::INVALID_TIMER_ID, -1};
    }
  }

  HOT_PATH FORCE_INLINE int getAutoOffDelayByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->autoOffDelay : 0;
  }

  HOT_PATH FORCE_INLINE void setAutoOffDelayByPin(int pin, int delay) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->autoOffDelay = static_cast<uint16_t>(delay);
  }

  HOT_PATH FORCE_INLINE uniuno::TimerHandle getTimerIdByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->autoOffTimer : uniuno::TimerHandle();
  }

  HOT_PATH FORCE_INLINE void setTimerIdByPin(int pin, uniuno::TimerHandle timer) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->autoOffTimer = timer;
  }

  HOT_PATH FORCE_INLINE uniuno::TimerHandle getCloudSyncTimerIdByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->cloudSyncTimer : uniuno::TimerHandle();
  }

  HOT_PATH FORCE_INLINE void setCloudSyncTimerIdByPin(int pin, uniuno::TimerHandle timer) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->cloudSyncTimer = timer;
  }

  HOT_PATH FORCE_INLINE uniuno::TimerHandle getRuleActionTimerIdByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->ruleActionTimer : uniuno::TimerHandle();
  }

  HOT_PATH FORCE_INLINE void setRuleActionTimerIdByPin(int pin, uniuno::TimerHandle timer) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) {
      if (entry->ruleActionTimer.getId() != uniuno::INVALID_TIMER_ID) {
        const uint16_t oldIdx = entry->ruleActionTimer.getId().getIndex();
        if (oldIdx < MAX_TIMER_MAP_ENTRIES) {
          _ruleTimerMap[oldIdx].id = uniuno::INVALID_TIMER_ID;
          _ruleTimerMap[oldIdx].pin = -1;
        }
      }
      entry->ruleActionTimer = timer;
      if (timer.getId() != uniuno::INVALID_TIMER_ID) {
        const uint16_t newIdx = timer.getId().getIndex();
        if (newIdx < MAX_TIMER_MAP_ENTRIES) {
          _ruleTimerMap[newIdx].id = timer.getId();
          _ruleTimerMap[newIdx].pin = static_cast<int8_t>(pin);
        }
      }
    }
  }

  HOT_PATH FORCE_INLINE uniuno::TimerHandle getHoldTimerIdByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->holdTimer : uniuno::TimerHandle();
  }

  HOT_PATH FORCE_INLINE void setHoldTimerIdByPin(int pin, uniuno::TimerHandle timer) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) {
      if (entry->holdTimer.getId() != uniuno::INVALID_TIMER_ID) {
        const uint16_t oldIdx = entry->holdTimer.getId().getIndex();
        if (oldIdx < MAX_TIMER_MAP_ENTRIES) {
          _holdTimerMap[oldIdx].id = uniuno::INVALID_TIMER_ID;
          _holdTimerMap[oldIdx].pin = -1;
        }
      }
      entry->holdTimer = timer;
      if (timer.getId() != uniuno::INVALID_TIMER_ID) {
        const uint16_t newIdx = timer.getId().getIndex();
        if (newIdx < MAX_TIMER_MAP_ENTRIES) {
          _holdTimerMap[newIdx].id = timer.getId();
          _holdTimerMap[newIdx].pin = static_cast<int8_t>(pin);
        }
      }
    }
  }

  HOT_PATH FORCE_INLINE uniuno::TimerHandle getDoubleClickTimerIdByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->doubleClickTimer : uniuno::TimerHandle();
  }

  HOT_PATH FORCE_INLINE void setDoubleClickTimerIdByPin(int pin, uniuno::TimerHandle timer) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->doubleClickTimer = timer;
  }

  int findPinByRuleActionTimerId(uniuno::TimerId timerId) const;
  int findPinByHoldTimerId(uniuno::TimerId timerId) const;

private:
  PinRegistry& _registry;
  TimerPinMapEntry _ruleTimerMap[MAX_TIMER_MAP_ENTRIES];
  TimerPinMapEntry _holdTimerMap[MAX_TIMER_MAP_ENTRIES];
};

#endif // PIN_TIMER_MANAGER_H
