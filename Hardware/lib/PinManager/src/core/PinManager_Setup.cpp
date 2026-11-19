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
    uint16_t pwmFrequency
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

    if (type == SegmentType::AnalogOutput) {
        entry->pwm.configure(static_cast<int8_t>(pin), pwmResolution, pwmFrequency);
        if (!entry->pwm.begin()) {
            WARNINGF("[PinManager] Failed to attach LEDC PWM on pin %d (no free channel or invalid pin).", pin);
            return false;
        }
        entry->hasPwm = true;
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
    entry->pendingRuleActionState = false;
    entry->pendingRuleActionAnalogValue = RULE_ANALOG_VALUE_UNSET;
    entry->pendingHoldAction = RuleAction();
    entry->isHandled = false;
    entry->rule = rule;
    entry->stateStartTime = millis();
    entry->lastDebounceTime = millis();

    _registry.mapPin(pin, slot);
    entry->active = true;

    if (type == SegmentType::AnalogOutput) {
        INFOF("[PinManager] Added segment '%s' on pin %d (Type: analog_output, %u-bit @ %uHz)",
              id, pin, entry->pwm.getResolution(), entry->pwm.getFrequency());
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
    entry->autoOffTimer.cancel();
    entry->cloudSyncTimer.cancel();
    entry->ruleActionTimer.cancel();
    entry->holdTimer.cancel();

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
    entry->lastInputState = false;
    entry->pendingRuleActionState = false;
    entry->pendingRuleActionAnalogValue = RULE_ANALOG_VALUE_UNSET;
    entry->pendingHoldAction = RuleAction();
    entry->isHandled = false;
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
    if (!entry || entry->type != SegmentType::Input) return false;
    entry->rule = rule;
    return true;
}

bool PinManager::updateSegmentRuleByPin(int pin, const RuleConfig& rule) {
    PinEntry* entry = _registry.getEntryByPin(pin);
    if (!entry || !entry->active || entry->type != SegmentType::Input) return false;
    entry->rule = rule;
    return true;
}
