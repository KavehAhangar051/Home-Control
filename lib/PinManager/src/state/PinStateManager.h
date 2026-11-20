#ifndef PIN_STATE_MANAGER_H
#define PIN_STATE_MANAGER_H

#include "../PinRegistry.h"
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticFunction.h>
#include <Optimization/XtensaAnalogAsm.h>
#include <Timer/Optimization/TimerAsm.h>

#if defined(ESP32)
#include <soc/gpio_struct.h>
#endif

/**
 * @brief Manages GPIO digital/analog input and output states with hardware-accelerated
 * bitmask scanning, CCOUNT cycle gating, and non-blocking SAR1 ADC1 pipelining.
 */
class PinStateManager {
public:
    PinStateManager(PinRegistry& registry)
        : _registry(registry),
          _inputMask0_31(0),
          _inputMask32_39(0),
          _lastInputs0_31(0),
          _lastInputs32_39(0),
          _nextAnalogSampleTime(0),
          _lastAnalogGateCycle(0),
          _activeAdcStartCycle(0),
          _numInputs(0),
          _numAnalogInputs(0),
          _activeAdcSlot(-1),
          _analogRoundRobin(0),
          _hasAnalogSchedule(false) {
        for (int i = 0; i < MAX_PINS; ++i) {
            _inputIndices[i] = 0;
            _analogEntries[i] = nullptr;
        }
    }

    bool setPinState(int pin, bool state);
    bool setStateById(const char* id, bool state);
    bool setPinAnalogValue(int pin, uint16_t value);
    bool setAnalogValueById(const char* id, uint16_t value);
    bool readAnalogInputNow(int pin, AdcSampleResult& outResult);

    HOT_PATH FORCE_INLINE bool getPinState(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active) return false;
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
        if (!entry || !entry->active || !entry->hasPwm) return 0;
        return entry->pwm.getLastNonZeroValue();
    }

    HOT_PATH FORCE_INLINE uint8_t getPinAnalogResolution(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active) return 0;
        if (entry->hasPwm) return entry->pwm.getResolution();
        if (entry->hasAdc) return entry->adc.getResolution();
        return 0;
    }

    HOT_PATH FORCE_INLINE uint8_t getPinPwmResolution(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active || !entry->hasPwm) return 0;
        return entry->pwm.getResolution();
    }

    HOT_PATH FORCE_INLINE uint16_t getPinPwmFrequency(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active || !entry->hasPwm) return 0;
        return entry->pwm.getFrequency();
    }

    HOT_PATH FORCE_INLINE uint8_t getPinAdcResolution(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active || !entry->hasAdc) return 0;
        return entry->adc.getResolution();
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcSampleInterval(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active || !entry->hasAdc) return 0;
        return entry->adc.getSampleIntervalMs();
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcDeltaThreshold(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active || !entry->hasAdc) return 0;
        return entry->adc.getDeltaThreshold();
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcHighThreshold(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active || !entry->hasAdc) return 0;
        return entry->adc.getHighThreshold();
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcLowThreshold(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        if (!entry || !entry->active || !entry->hasAdc) return 0;
        return entry->adc.getLowThreshold();
    }

    HOT_PATH FORCE_INLINE bool isAnalogOutputPin(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        return entry != nullptr && entry->active && entry->type == SegmentType::AnalogOutput && entry->hasPwm;
    }

    HOT_PATH FORCE_INLINE bool isAnalogInputPin(int pin) const {
        const PinEntry* entry = _registry.getEntryByPinConst(pin);
        return entry != nullptr && entry->active && entry->type == SegmentType::AnalogInput && entry->hasAdc;
    }

    /**
     * @brief Ultra-fast pipeline-interleaved Xtensa assembly bitmask change check.
     * Interleaves Bank 0 (GPIO 0-31) and Bank 1 (GPIO 32-39) ALU ops to avoid
     * Read-After-Write pipeline bubbles. Returns false in ~5 cycles with zero branches
     * when no inputs changed (also handles _numInputs == 0 naturally since masks are 0).
     */
    HOT_PATH FORCE_INLINE bool hasInputsChanged() const {
#if defined(__XTENSA__) || defined(ESP32)
        const uint32_t in0 = GPIO.in;
        const uint32_t in1 = GPIO.in1.val;
        uint32_t diff;
        uint32_t tmp;
        asm volatile (
            "xor    %[d], %[in0], %[last0]  \n"
            "xor    %[t], %[in1], %[last1]  \n"
            "and    %[d], %[d],   %[mask0]  \n"
            "and    %[t], %[t],   %[mask1]  \n"
            "or     %[d], %[d],   %[t]      \n"
            : [d] "=&r" (diff), [t] "=&r" (tmp)
            : [in0]   "r" (in0),   [last0] "r" (_lastInputs0_31),  [mask0] "r" (_inputMask0_31),
              [in1]   "r" (in1),   [last1] "r" (_lastInputs32_39), [mask1] "r" (_inputMask32_39)
        );
        return diff != 0;
#else
        return true;
#endif
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
#if defined(ESP32)
            if (LIKELY(GpioAdc::isSar1HardwareReady())) return true;
            // Safety fallback: wake up if a hardware conversion somehow exceeds 2ms
            const uint32_t elapsed = uniuno::asm_opt::get_cpu_cycle_count() - _activeAdcStartCycle;
            return UNLIKELY(elapsed >= uniuno::asm_opt::ms_to_cycles(2));
#else
            return true;
#endif
        }

        if (UNLIKELY(!_hasAnalogSchedule)) return true;

#if defined(ESP32)
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

    HOT_PATH void processInputs(const uniuno::StaticFunction<void, int, bool, unsigned long, const RuleConfig&>& onInputChanged);
    HOT_PATH void processAnalogInputs(const uniuno::StaticFunction<void, const AnalogInputChange&, const RuleConfig&>& onAnalogChanged);
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
    // Space-for-Time direct pointer cache: zero index lookup or bounds checking in hot loop
    PinEntry* _analogEntries[MAX_PINS];
    uint8_t _numInputs;
    uint8_t _numAnalogInputs;
    int8_t _activeAdcSlot;    // Index into _analogEntries[] owning SAR1 right now, or -1 if idle
    uint8_t _analogRoundRobin;
    bool _hasAnalogSchedule;
};

#endif // PIN_STATE_MANAGER_H
