#include "../PinManager.h"
#include <Utilities/logging.h>
#include <Timer/Timer.h>

bool PinManager::addSegment(
    const char* id,
    SegmentType type,
    int pin,
    int autoOffDelay,
    RuleConfig rule,
    uint8_t pwmResolution,
    uint16_t pwmFrequency,
    uint8_t adcResolution,
    uint16_t adcSampleIntervalMs,
    uint16_t adcDeltaThreshold,
    uint16_t adcHighThreshold,
    uint16_t adcLowThreshold
) {
    if (id == nullptr || id[0] == '\0') {
        WARNING("[PinManager] Segment ID is empty.");
        return false;
    }
    if (pin < 0 || pin >= 40) {
        WARNINGF("[PinManager] Pin %d out of ESP32 GPIO range (0..39).", pin);
        return false;
    }
    if (type == SegmentType::AnalogOutput && !GpioPwm::isValidPwmPin(pin)) {
        WARNINGF("[PinManager] Pin %d is not a valid PWM output pin (flash or input-only).", pin);
        return false;
    }
    if (type == SegmentType::AnalogInput && !GpioAdc::isValidAdcPin(pin)) {
        WARNINGF("[PinManager] Pin %d is not a valid WiFi-safe ADC1 pin (allowed: 32,33,34,35,36,39).", pin);
        return false;
    }
    if (_registry.findById(id) >= 0) {
        WARNINGF("[PinManager] Segment '%s' already exists.", id);
        return false;
    }
    if (_registry.getEntryByPin(pin) != nullptr) {
        WARNINGF("[PinManager] Pin %d already in use.", pin);
        return false;
    }
    const int slot = _registry.findEmptySlot();
    if (slot < 0) {
        WARNING("[PinManager] No empty slot for new segment.");
        return false;
    }

    PinEntry* entry = _registry.getEntryByIndex(slot);
    if (!entry) return false;

    entry->hasGpio = false;
    entry->hasPwm = false;
    entry->hasAdc = false;
    entry->lastInputState = false;

    if (type == SegmentType::AnalogOutput) {
        entry->pwm.configure(static_cast<int8_t>(pin), pwmResolution, pwmFrequency);
        if (!entry->pwm.begin()) {
            WARNINGF("[PinManager] Failed to attach LEDC PWM on pin %d (no free channel or invalid pin).", pin);
            return false;
        }
        entry->hasPwm = true;
    } else if (type == SegmentType::AnalogInput) {
        entry->adc.configure(
            static_cast<int8_t>(pin),
            adcResolution,
            adcSampleIntervalMs,
            adcDeltaThreshold,
            adcHighThreshold,
            adcLowThreshold
        );
        if (!entry->adc.begin()) {
            WARNINGF("[PinManager] Failed to initialize ADC1 on pin %d.", pin);
            return false;
        }
        entry->hasAdc = true;
        entry->lastInputState = entry->adc.getThresholdState();
    } else if (type == SegmentType::Input) {
        pinMode(pin, INPUT_PULLUP);
        entry->lastInputState = digitalRead(pin) == HIGH;
    } else {
        entry->gpio.setPin(pin);
        // GpioSwitch starts in a known OFF state; live output state is not restored from NVS.
        entry->gpio.begin();
        entry->hasGpio = true;
    }

    strncpy(entry->segmentId, id, sizeof(entry->segmentId) - 1);
    entry->segmentId[sizeof(entry->segmentId) - 1] = '\0';
    entry->type = type;
    entry->pinNumber = static_cast<int8_t>(pin);
    entry->autoOffDelay = static_cast<uint16_t>(autoOffDelay < 0 ? 0 : autoOffDelay);
    entry->autoOffTimer = uniuno::TimerHandle();
    entry->cloudSyncTimer = uniuno::TimerHandle();
    entry->ruleActionTimer = uniuno::TimerHandle();
    entry->holdTimer = uniuno::TimerHandle();
    entry->doubleClickTimer = uniuno::TimerHandle();
    entry->pendingRuleActionState = false;
    entry->pendingRuleActionAnalogValue = RULE_ANALOG_VALUE_UNSET;
    entry->pendingHoldAction = RuleAction();
    entry->isHandled = false;
    entry->clickCount = 0;
    entry->clickPolarity = false;
    entry->lastClickTimeMs = 0;
    entry->analogRangeActiveMask = 0;
    entry->rule = rule;
    if (type == SegmentType::AnalogInput && entry->hasAdc && rule.active && rule.analogRangeCount > 0) {
        // Seed initial range membership from boot baseline so power-on never fires spurious enter events
        const uint16_t baseline = entry->adc.getValue();
        const uint16_t maxScale = entry->adc.getMaxValue();
        const uint8_t count = rule.analogRangeCount <= MAX_ANALOG_RANGE_RULES
            ? rule.analogRangeCount
            : MAX_ANALOG_RANGE_RULES;
        uint8_t mask = 0;
        for (uint8_t r = 0; r < count; ++r) {
            const AnalogRangeRule& rr = rule.analogRanges[r];
            if (rr.enabled && uniuno::xtensa_asm::asm_range_eval(
                    baseline, rr.minValue, rr.maxValue, rr.hysteresis, maxScale, false)) {
                mask |= static_cast<uint8_t>(1U << r);
            }
        }
        entry->analogRangeActiveMask = mask;
    }
    entry->stateStartTime = millis();
    entry->lastDebounceTime = millis();

    _registry.mapPin(pin, slot);
    entry->active = true;

    if (type == SegmentType::AnalogOutput) {
        INFOF("[PinManager] Added segment '%s' on pin %d (Type: analog_output, %u-bit @ %uHz)",
              id, pin, entry->pwm.getResolution(), entry->pwm.getFrequency());
    } else if (type == SegmentType::AnalogInput) {
        INFOF("[PinManager] Added segment '%s' on pin %d (Type: analog_input, %u-bit sint=%ums delta=%u ath=%u atl=%u ranges=%u)",
              id, pin, entry->adc.getResolution(), entry->adc.getSampleIntervalMs(),
              entry->adc.getDeltaThreshold(), entry->adc.getHighThreshold(), entry->adc.getLowThreshold(),
              static_cast<unsigned int>(entry->rule.analogRangeCount));
    } else {
        INFOF("[PinManager] Added segment '%s' on pin %d (Type: %s)",
              id, pin, (type == SegmentType::Input ? "input" : "output"));
    }
    _stateManager.rebuildInputCache();
    return true;
}

bool PinManager::removeSegment(const char* id) {
    const int idx = _registry.findById(id);
    if (idx < 0) {
        WARNINGF("[PinManager] Segment '%s' not found.", id);
        return false;
    }

    PinEntry* entry = _registry.getEntryByIndex(idx);
    if (!entry) return false;

    if (entry->hasGpio) {
        entry->gpio.turnOff();
        entry->hasGpio = false;
    }
    if (entry->hasPwm) {
        entry->pwm.end();
        entry->hasPwm = false;
    }
    if (entry->hasAdc) {
        entry->adc.end();
        entry->hasAdc = false;
    }
    entry->autoOffTimer.cancel();
    entry->cloudSyncTimer.cancel();
    entry->ruleActionTimer.cancel();
    entry->holdTimer.cancel();
    entry->doubleClickTimer.cancel();

    _registry.unmapPin(entry->pinNumber);

    entry->active = false;
    entry->pinNumber = -1;
    entry->type = SegmentType::Output;
    entry->segmentId[0] = '\0';
    entry->autoOffDelay = 0;
    entry->autoOffTimer = uniuno::TimerHandle();
    entry->cloudSyncTimer = uniuno::TimerHandle();
    entry->ruleActionTimer = uniuno::TimerHandle();
    entry->holdTimer = uniuno::TimerHandle();
    entry->doubleClickTimer = uniuno::TimerHandle();
    entry->lastInputState = false;
    entry->pendingRuleActionState = false;
    entry->pendingRuleActionAnalogValue = RULE_ANALOG_VALUE_UNSET;
    entry->pendingHoldAction = RuleAction();
    entry->isHandled = false;
    entry->clickCount = 0;
    entry->clickPolarity = false;
    entry->lastClickTimeMs = 0;
    entry->analogRangeActiveMask = 0;
    entry->stateStartTime = 0;
    entry->lastDebounceTime = 0;

    INFOF("[PinManager] Removed segment '%s'", id);
    _stateManager.rebuildInputCache();
    return true;
}

bool PinManager::updateSegmentRule(const char* id, const RuleConfig& rule) {
    const int idx = _registry.findById(id);
    if (idx < 0) return false;
    PinEntry* entry = _registry.getEntryByIndex(idx);
    if (!entry || (entry->type != SegmentType::Input && entry->type != SegmentType::AnalogInput)) return false;
    entry->doubleClickTimer.cancel();
    entry->doubleClickTimer = uniuno::TimerHandle();
    entry->clickCount = 0;
    entry->analogRangeActiveMask = 0;
    entry->rule = rule;
    return true;
}

bool PinManager::updateSegmentRuleByPin(int pin, const RuleConfig& rule) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->active ||
        (entry->type != SegmentType::Input && entry->type != SegmentType::AnalogInput)) {
        return false;
    }
    entry->doubleClickTimer.cancel();
    entry->doubleClickTimer = uniuno::TimerHandle();
    entry->clickCount = 0;
    entry->analogRangeActiveMask = 0;
    entry->rule = rule;
    return true;
}

bool PinManager::updateAnalogInputConfigByPin(
    int pin,
    uint16_t sampleIntervalMs,
    uint16_t deltaThreshold,
    uint16_t highThreshold,
    uint16_t lowThreshold,
    uint8_t resolution
) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->active || entry->type != SegmentType::AnalogInput || !entry->hasAdc) {
        return false;
    }
    entry->adc.updateParameters(sampleIntervalMs, deltaThreshold, highThreshold, lowThreshold, resolution);
    entry->lastInputState = entry->adc.getThresholdState();
    _stateManager.rebuildInputCache();
    INFOF("[PinManager] Updated analog_input GPIO%d (%u-bit sint=%ums delta=%u ath=%u atl=%u)",
          pin, entry->adc.getResolution(), entry->adc.getSampleIntervalMs(),
          entry->adc.getDeltaThreshold(), entry->adc.getHighThreshold(), entry->adc.getLowThreshold());
    return true;
}
