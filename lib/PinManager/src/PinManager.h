#ifndef PIN_MANAGER_H
#define PIN_MANAGER_H

#include <Arduino.h>
#include <AchaemenidConfigProtocol.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticFunction.h>

#include "PinRegistry.h"
#include "timers/PinTimerManager.h"
#include "state/PinStateManager.h"

class PinManager {
public:
    PinManager();
    ~PinManager();

    bool addSegment(
        const char* id,
        SegmentType type,
        int pin,
        int autoOffDelay = 0,
        RuleConfig rule = RuleConfig(),
        uint8_t pwmResolution = DEFAULT_PWM_RESOLUTION,
        uint16_t pwmFrequency = DEFAULT_PWM_FREQUENCY,
        uint8_t adcResolution = DEFAULT_ADC_RESOLUTION,
        uint16_t adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS,
        uint16_t adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD,
        uint16_t adcHighThreshold = 0,
        uint16_t adcLowThreshold = 0
    );
    bool removeSegment(const char* id);
    bool updateSegmentRule(const char* id, const RuleConfig& rule);
    bool updateSegmentRuleByPin(int pin, const RuleConfig& rule);
    bool updateAnalogInputConfigByPin(
        int pin,
        uint16_t sampleIntervalMs,
        uint16_t deltaThreshold,
        uint16_t highThreshold,
        uint16_t lowThreshold,
        uint8_t resolution = 0
    );

    int getActiveCount() const;
    void printStatus() const;
    void exportConfig(ParseResult& out) const;
    String exportStateJson() const;

    // --- State Delegation ---
    HOT_PATH FORCE_INLINE bool setPinState(int pin, bool state) {
        return _stateManager.setPinState(pin, state);
    }

    HOT_PATH FORCE_INLINE bool setStateById(const char* id, bool state) {
        return _stateManager.setStateById(id, state);
    }

    HOT_PATH FORCE_INLINE bool setPinAnalogValue(int pin, uint16_t value) {
        return _stateManager.setPinAnalogValue(pin, value);
    }

    HOT_PATH FORCE_INLINE bool setAnalogValueById(const char* id, uint16_t value) {
        return _stateManager.setAnalogValueById(id, value);
    }

    HOT_PATH FORCE_INLINE bool readAnalogInputNow(int pin, AdcSampleResult& outResult) {
        return _stateManager.readAnalogInputNow(pin, outResult);
    }

    HOT_PATH FORCE_INLINE bool getPinState(int pin) const {
        return _stateManager.getPinState(pin);
    }

    HOT_PATH FORCE_INLINE int16_t getPinAnalogValue(int pin) const {
        return _stateManager.getPinAnalogValue(pin);
    }

    HOT_PATH FORCE_INLINE uint16_t getPinLastNonZeroValue(int pin) const {
        return _stateManager.getPinLastNonZeroValue(pin);
    }

    HOT_PATH FORCE_INLINE uint8_t getPinAnalogResolution(int pin) const {
        return _stateManager.getPinAnalogResolution(pin);
    }

    HOT_PATH FORCE_INLINE uint8_t getPinPwmResolution(int pin) const {
        return _stateManager.getPinPwmResolution(pin);
    }

    HOT_PATH FORCE_INLINE uint16_t getPinPwmFrequency(int pin) const {
        return _stateManager.getPinPwmFrequency(pin);
    }

    HOT_PATH FORCE_INLINE uint8_t getPinAdcResolution(int pin) const {
        return _stateManager.getPinAdcResolution(pin);
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcSampleInterval(int pin) const {
        return _stateManager.getPinAdcSampleInterval(pin);
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcDeltaThreshold(int pin) const {
        return _stateManager.getPinAdcDeltaThreshold(pin);
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcHighThreshold(int pin) const {
        return _stateManager.getPinAdcHighThreshold(pin);
    }

    HOT_PATH FORCE_INLINE uint16_t getPinAdcLowThreshold(int pin) const {
        return _stateManager.getPinAdcLowThreshold(pin);
    }

    HOT_PATH FORCE_INLINE bool isAnalogOutputPin(int pin) const {
        return _stateManager.isAnalogOutputPin(pin);
    }

    HOT_PATH FORCE_INLINE bool isAnalogInputPin(int pin) const {
        return _stateManager.isAnalogInputPin(pin);
    }

    template <typename Callback>
    HOT_PATH FORCE_INLINE void processInputs(Callback&& onInputChanged) {
        // Fast-path: skip StaticFunction binding and call overhead unless a GPIO bit flipped
        if (UNLIKELY(_stateManager.hasInputsChanged())) {
            auto cb = uniuno::StaticFunction<void, int, bool, unsigned long, const RuleConfig&>::bind(&onInputChanged);
            _stateManager.processInputs(cb);
        }
    }

    template <typename Callback>
    HOT_PATH FORCE_INLINE void processAnalogInputs(Callback&& onAnalogChanged) {
        // Fast-path: 1-cycle skip when no analog inputs exist or before next sample deadline
        if (UNLIKELY(_stateManager.hasAnalogInputsDue())) {
            auto cb = uniuno::StaticFunction<void, const AnalogInputChange&, const RuleConfig&>::bind(&onAnalogChanged);
            _stateManager.processAnalogInputs(cb);
        }
    }

    HOT_PATH FORCE_INLINE RuleConfig getRuleByPin(int pin) const {
        return _stateManager.getRuleByPin(pin);
    }

    HOT_PATH FORCE_INLINE bool getIsHandledByPin(int pin) const {
        return _stateManager.getIsHandledByPin(pin);
    }

    HOT_PATH FORCE_INLINE void setIsHandledByPin(int pin, bool handled) {
        _stateManager.setIsHandledByPin(pin, handled);
    }

    HOT_PATH FORCE_INLINE bool getPendingRuleActionState(int pin) const {
        return _stateManager.getPendingRuleActionState(pin);
    }

    HOT_PATH FORCE_INLINE void setPendingRuleActionState(int pin, bool state) {
        _stateManager.setPendingRuleActionState(pin, state);
    }

    HOT_PATH FORCE_INLINE int16_t getPendingRuleActionAnalogValue(int pin) const {
        return _stateManager.getPendingRuleActionAnalogValue(pin);
    }

    HOT_PATH FORCE_INLINE void setPendingRuleActionAnalogValue(int pin, int16_t value) {
        _stateManager.setPendingRuleActionAnalogValue(pin, value);
    }

    HOT_PATH FORCE_INLINE RuleAction getPendingHoldAction(int pin) const {
        return _stateManager.getPendingHoldAction(pin);
    }

    HOT_PATH FORCE_INLINE void setPendingHoldAction(int pin, const RuleAction& action) {
        _stateManager.setPendingHoldAction(pin, action);
    }

    // --- Timer Delegation ---
    HOT_PATH FORCE_INLINE int getAutoOffDelayByPin(int pin) const {
        return _timerManager.getAutoOffDelayByPin(pin);
    }

    HOT_PATH FORCE_INLINE void setAutoOffDelayByPin(int pin, int delay) {
        _timerManager.setAutoOffDelayByPin(pin, delay);
    }

    HOT_PATH FORCE_INLINE uniuno::TimerHandle getTimerIdByPin(int pin) const {
        return _timerManager.getTimerIdByPin(pin);
    }

    HOT_PATH FORCE_INLINE void setTimerIdByPin(int pin, uniuno::TimerHandle timer) {
        _timerManager.setTimerIdByPin(pin, timer);
    }

    unsigned long getAutoOffRemainingMsByPin(int pin) const;

    HOT_PATH FORCE_INLINE uniuno::TimerHandle getCloudSyncTimerIdByPin(int pin) const {
        return _timerManager.getCloudSyncTimerIdByPin(pin);
    }

    HOT_PATH FORCE_INLINE void setCloudSyncTimerIdByPin(int pin, uniuno::TimerHandle timer) {
        _timerManager.setCloudSyncTimerIdByPin(pin, timer);
    }

    HOT_PATH FORCE_INLINE uniuno::TimerHandle getRuleActionTimerIdByPin(int pin) const {
        return _timerManager.getRuleActionTimerIdByPin(pin);
    }

    HOT_PATH FORCE_INLINE void setRuleActionTimerIdByPin(int pin, uniuno::TimerHandle timer) {
        _timerManager.setRuleActionTimerIdByPin(pin, timer);
    }

    HOT_PATH FORCE_INLINE uniuno::TimerHandle getHoldTimerIdByPin(int pin) const {
        return _timerManager.getHoldTimerIdByPin(pin);
    }

    HOT_PATH FORCE_INLINE void setHoldTimerIdByPin(int pin, uniuno::TimerHandle timer) {
        _timerManager.setHoldTimerIdByPin(pin, timer);
    }

    HOT_PATH FORCE_INLINE int findPinByRuleActionTimerId(uniuno::TimerId timerId) const {
        return _timerManager.findPinByRuleActionTimerId(timerId);
    }

    HOT_PATH FORCE_INLINE int findPinByHoldTimerId(uniuno::TimerId timerId) const {
        return _timerManager.findPinByHoldTimerId(timerId);
    }

private:
    PinRegistry _registry;
    PinTimerManager _timerManager;
    PinStateManager _stateManager;
};

#endif
