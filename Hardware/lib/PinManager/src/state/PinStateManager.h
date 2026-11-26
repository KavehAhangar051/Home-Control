#ifndef PIN_STATE_MANAGER_H
#define PIN_STATE_MANAGER_H

#include "../PinRegistry.h"
#include <ProjectConfig.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticFunction.h>
#include <Optimization/XtensaAnalogAsm.h>
#include <Timer/Optimization/TimerAsm.h>

#ifdef ESP32
#include <soc/gpio_struct.h>
#endif

/**
 * @brief Manages GPIO digital/analog input and output states with hardware-accelerated
 * bitmask scanning, CCOUNT cycle gating, and non-blocking SAR1 ADC1 pipelining.
 */
class PinStateManager {
public:
  // ESP32 has 6 WiFi-safe ADC1 channels (GPIO 32,33,34,35,36,39); configured via ProjectConfig.h.
  static constexpr uint8_t MAX_ANALOG_SLOTS = ACHAEMENID_MAX_ANALOG_SLOTS;

  PinStateManager(PinRegistry& registry)
      : _registry(registry), _inputMask0_31(0), _inputMask32_39(0), _lastInputs0_31(0), _lastInputs32_39(0),
        _nextAnalogSampleTime(0), _lastAnalogGateCycle(0), _activeAdcStartCycle(0), _numInputs(0), _numAnalogInputs(0),
        _activeAdcSlot(-1), _analogRoundRobin(0), _hasAnalogSchedule(false) {
    for (int i = 0; i < MAX_PINS; ++i) {
      _inputIndices[i] = 0;
    }
    for (uint8_t i = 0; i < MAX_ANALOG_SLOTS; ++i) {
      _analogEntries[i] = nullptr;
      for (uint8_t j = 0; j < MAX_ANALOG_SLOTS; ++j) {
        _analogSlotOrder[i][j] = 0;
      }
    }
  }

  bool setPinState(int pin, bool state);
  bool setStateById(const char* id, bool state);
  bool setPinAnalogValue(int pin, uint16_t value);
  bool setAnalogValueById(const char* id, uint16_t value);
  bool readAnalogInputNow(int pin, AdcSampleResult& outResult);
  bool injectVirtualInputState(int pin, bool state, unsigned long& outDurationSec, RuleConfig& outRule);
  bool injectVirtualAnalogInput(int pin, uint16_t rawValue, AnalogInputChange& outChange, RuleConfig& outRule);

  HOT_PATH FORCE_INLINE bool getPinState(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return false;
    if (entry->isVirtual) {
      if (entry->type == SegmentType::Input || entry->type == SegmentType::AnalogInput) {
        return entry->lastInputState;
      }
      if (entry->type == SegmentType::AnalogOutput) {
        return entry->virt.analogValue > 0;
      }
      return entry->virtualState;
    }
    if (entry->type == SegmentType::Input) {
      return entry->lastInputState;
    }
    if (entry->type == SegmentType::AnalogInput) {
      return entry->hasAdc ? entry->adc.getThresholdState() : entry->lastInputState;
    }
    if (entry->type == SegmentType::AnalogOutput) {
      return entry->hasPwm ? entry->pwm.getState() : false;
    }
    if (!entry->hasGpio) return false;
    return entry->gpio.getState();
  }

  HOT_PATH FORCE_INLINE int16_t getPinAnalogValue(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return RULE_ANALOG_VALUE_UNSET;
    if (entry->isVirtual) {
      if (entry->type == SegmentType::AnalogOutput || entry->type == SegmentType::AnalogInput) {
        return static_cast<int16_t>(entry->virt.analogValue);
      }
      return RULE_ANALOG_VALUE_UNSET;
    }
    if (entry->hasPwm) {
      return static_cast<int16_t>(entry->pwm.getValue());
    }
    if (entry->hasAdc) {
      return static_cast<int16_t>(entry->adc.getValue());
    }
    return RULE_ANALOG_VALUE_UNSET;
  }

  HOT_PATH FORCE_INLINE uint16_t getPinLastNonZeroValue(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogOutput) ? entry->virt.lastNonZeroValue : 0;
    }
    if (!entry->hasPwm) return 0;
    return entry->pwm.getLastNonZeroValue();
  }

  HOT_PATH FORCE_INLINE uint8_t getPinAnalogResolution(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      if (entry->type == SegmentType::AnalogOutput) return entry->virt.pwmResolution;
      if (entry->type == SegmentType::AnalogInput) return entry->virt.adcResolution;
      return 0;
    }
    if (entry->hasPwm) return entry->pwm.getResolution();
    if (entry->hasAdc) return entry->adc.getResolution();
    return 0;
  }

  HOT_PATH FORCE_INLINE uint8_t getPinPwmResolution(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogOutput) ? entry->virt.pwmResolution : 0;
    }
    if (!entry->hasPwm) return 0;
    return entry->pwm.getResolution();
  }

  HOT_PATH FORCE_INLINE uint16_t getPinPwmFrequency(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogOutput) ? entry->virt.pwmFrequency : 0;
    }
    if (!entry->hasPwm) return 0;
    return entry->pwm.getFrequency();
  }

  HOT_PATH FORCE_INLINE uint8_t getPinAdcResolution(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogInput) ? entry->virt.adcResolution : 0;
    }
    if (!entry->hasAdc) return 0;
    return entry->adc.getResolution();
  }

  HOT_PATH FORCE_INLINE uint16_t getPinAdcSampleInterval(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogInput) ? entry->virt.adcSampleIntervalMs : 0;
    }
    if (!entry->hasAdc) return 0;
    return entry->adc.getSampleIntervalMs();
  }

  HOT_PATH FORCE_INLINE uint16_t getPinAdcDeltaThreshold(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogInput) ? entry->virt.adcDeltaThreshold : 0;
    }
    if (!entry->hasAdc) return 0;
    return entry->adc.getDeltaThreshold();
  }

  HOT_PATH FORCE_INLINE uint16_t getPinAdcHighThreshold(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogInput) ? entry->virt.adcHighThreshold : 0;
    }
    if (!entry->hasAdc) return 0;
    return entry->adc.getHighThreshold();
  }

  HOT_PATH FORCE_INLINE uint16_t getPinAdcLowThreshold(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (!entry || !entry->active) return 0;
    if (entry->isVirtual) {
      return (entry->type == SegmentType::AnalogInput) ? entry->virt.adcLowThreshold : 0;
    }
    if (!entry->hasAdc) return 0;
    return entry->adc.getLowThreshold();
  }

  HOT_PATH FORCE_INLINE bool isAnalogOutputPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (entry == nullptr || !entry->active || entry->type != SegmentType::AnalogOutput) return false;
    return entry->isVirtual || entry->hasPwm;
  }

  HOT_PATH FORCE_INLINE bool isAnalogInputPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    if (entry == nullptr || !entry->active || entry->type != SegmentType::AnalogInput) return false;
    return entry->isVirtual || entry->hasAdc;
  }

  /**
   * @brief Single-pass pipeline-interleaved Xtensa assembly GPIO edge check.
   * Captures current register snapshots and diff masks in ~5 cycles so the transition
   * handler never re-reads the slow APB GPIO.in / GPIO.in1.val registers a second time.
   */
  HOT_PATH FORCE_INLINE bool pollInputsChanged(uint32_t& outCur0, uint32_t& outCur1, uint32_t& outDiff0,
                                               uint32_t& outDiff1) const {
#if defined(__XTENSA__) || defined(ESP32)
    const uint32_t in0 = GPIO.in;
    const uint32_t in1 = GPIO.in1.val;
    uint32_t diff0;
    uint32_t diff1;
    uint32_t any;
    asm volatile("xor    %[d0], %[in0], %[last0] \n"
                 "xor    %[d1], %[in1], %[last1] \n"
                 "and    %[d0], %[d0],  %[mask0] \n"
                 "and    %[d1], %[d1],  %[mask1] \n"
                 "or     %[any], %[d0], %[d1]    \n"
                 : [d0] "=&r"(diff0), [d1] "=&r"(diff1), [any] "=&r"(any)
                 : [in0] "r"(in0), [last0] "r"(_lastInputs0_31), [mask0] "r"(_inputMask0_31), [in1] "r"(in1),
                   [last1] "r"(_lastInputs32_39), [mask1] "r"(_inputMask32_39));
    outCur0 = in0;
    outCur1 = in1;
    outDiff0 = diff0;
    outDiff1 = diff1;
    return any != 0;
#else
    outCur0 = 0;
    outCur1 = 0;
    outDiff0 = 0;
    outDiff1 = 0;
    return true;
#endif
  }

  HOT_PATH FORCE_INLINE bool hasInputsChanged() const {
    uint32_t cur0, cur1, diff0, diff1;
    return pollInputsChanged(cur0, cur1, diff0, diff1);
  }

  /**
   * @brief Zero-millis() ultra-fast hardware gate for analog input polling:
   * - No analog inputs -> 1 cycle
   * - SAR1 conversion in flight -> 3-cycle direct hardware ready bit check (zero millis!)
   * - Idle between sample deadlines -> 3-cycle Xtensa CCOUNT 1ms gate (zero millis() on 99.9%+ ticks!)
   */
  HOT_PATH FORCE_INLINE bool hasAnalogInputsDue() const {
    if (LIKELY(_numAnalogInputs == 0)) return false;

    if (_activeAdcSlot >= 0) {
#ifdef ESP32
      if (LIKELY(GpioAdc::isSar1HardwareReady())) return true;
      // Safety fallback: wake up if a hardware conversion somehow exceeds 2ms
      const uint32_t elapsed = uniuno::asm_opt::get_cpu_cycle_count() - _activeAdcStartCycle;
      return UNLIKELY(elapsed >= uniuno::asm_opt::ms_to_cycles(2));
#else
      return true;
#endif
    }

    if (UNLIKELY(!_hasAnalogSchedule)) return true;

#ifdef ESP32
    // 3-cycle CCOUNT hardware throttle: check millis() deadline at most once per 1ms
    // (50x finer than the 50ms minimum sample interval, eliminates ~100-cycle millis() per loop!)
    const uint32_t nowCycles = uniuno::asm_opt::get_cpu_cycle_count();
    if (LIKELY(static_cast<uint32_t>(nowCycles - _lastAnalogGateCycle) < uniuno::asm_opt::ms_to_cycles(1))) {
      return false;
    }
    _lastAnalogGateCycle = nowCycles;
#endif
    return uniuno::asm_opt::is_timer_expired(millis(), _nextAnalogSampleTime);
  }

  HOT_PATH void
  processInputs(const uniuno::StaticFunction<void, int, bool, unsigned long, const RuleConfig&>& onInputChanged);
  HOT_PATH void
  processInputsChanged(uint32_t current0_31, uint32_t current32_39, uint32_t changed0_31, uint32_t changed32_39,
                       const uniuno::StaticFunction<void, int, bool, unsigned long, const RuleConfig&>& onInputChanged);
  HOT_PATH void
  processAnalogInputs(const uniuno::StaticFunction<void, const AnalogInputChange&, const RuleConfig&>& onAnalogChanged);
  void rebuildInputCache();

  HOT_PATH FORCE_INLINE RuleConfig getRuleByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->getRuleRef() : RuleConfig();
  }

  HOT_PATH FORCE_INLINE const RuleConfig* getRuleByPinPtr(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->rule : nullptr;
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

  HOT_PATH FORCE_INLINE int16_t getPendingRuleActionAnalogValue(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->pendingRuleActionAnalogValue : RULE_ANALOG_VALUE_UNSET;
  }

  HOT_PATH FORCE_INLINE void setPendingRuleActionAnalogValue(int pin, int16_t value) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->pendingRuleActionAnalogValue = value;
  }

  HOT_PATH FORCE_INLINE RuleAction getPendingHoldAction(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->pendingHoldAction : RuleAction();
  }

  HOT_PATH FORCE_INLINE void setPendingHoldAction(int pin, const RuleAction& action) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->pendingHoldAction = action;
  }

  HOT_PATH FORCE_INLINE uint8_t getClickCountByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->clickCount : 0;
  }

  HOT_PATH FORCE_INLINE void setClickCountByPin(int pin, uint8_t count) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->clickCount = count;
  }

  HOT_PATH FORCE_INLINE bool getClickPolarityByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->clickPolarity : false;
  }

  HOT_PATH FORCE_INLINE void setClickPolarityByPin(int pin, bool polarity) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->clickPolarity = polarity;
  }

  HOT_PATH FORCE_INLINE unsigned long getLastClickTimeByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->lastClickTimeMs : 0;
  }

  HOT_PATH FORCE_INLINE void setLastClickTimeByPin(int pin, unsigned long ts) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->lastClickTimeMs = ts;
  }

  HOT_PATH FORCE_INLINE uint8_t getAnalogRangeMaskByPin(int pin) const {
    const PinEntry* entry = _registry.getEntryByPinConst(pin);
    return entry ? entry->analogRangeActiveMask : 0;
  }

  HOT_PATH FORCE_INLINE void setAnalogRangeMaskByPin(int pin, uint8_t mask) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (entry) entry->analogRangeActiveMask = mask;
  }

private:
  PinRegistry& _registry;
  uint32_t _inputMask0_31;
  uint32_t _inputMask32_39;
  uint32_t _lastInputs0_31;
  uint32_t _lastInputs32_39;
  unsigned long _nextAnalogSampleTime;
  mutable uint32_t _lastAnalogGateCycle;
  uint32_t _activeAdcStartCycle;
  uint8_t _inputIndices[MAX_PINS];
  // Space-for-Time direct pointer cache & LUT sized to ESP32 ADC1 hardware (8 slots -> 2 L1 cache lines!)
  PinEntry* _analogEntries[MAX_ANALOG_SLOTS];
  uint8_t _numInputs;
  uint8_t _numAnalogInputs;
  int8_t _activeAdcSlot; // Index into _analogEntries[] owning SAR1 right now, or -1 if idle
  uint8_t _analogRoundRobin;
  uint8_t _analogSlotOrder[MAX_ANALOG_SLOTS][MAX_ANALOG_SLOTS];
  bool _hasAnalogSchedule;
};

#endif // PIN_STATE_MANAGER_H
