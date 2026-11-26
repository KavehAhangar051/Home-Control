#include "../PinManager.h"
#include <Utilities/logging.h>
#include <Timer/Timer.h>

bool PinManager::addSegment(const char* id, SegmentType type, int pin, int autoOffDelay, RuleConfig rule,
                            uint8_t pwmResolution, uint16_t pwmFrequency, uint8_t adcResolution,
                            uint16_t adcSampleIntervalMs, uint16_t adcDeltaThreshold, uint16_t adcHighThreshold,
                            uint16_t adcLowThreshold) {
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
  entry->isVirtual = false;
  entry->virtualState = false;
  entry->nodeId = AUX_NODE_ID_LOCAL;
  entry->remotePin = REMOTE_PIN_UNSET;
  entry->virtualAnalogValue = 0;
  entry->virtualLastNonZeroValue = 0;
  entry->virtualPwmResolution = DEFAULT_PWM_RESOLUTION;
  entry->virtualPwmFrequency = DEFAULT_PWM_FREQUENCY;
  entry->virtualAdcResolution = DEFAULT_ADC_RESOLUTION;
  entry->virtualAdcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
  entry->virtualAdcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
  entry->virtualAdcHighThreshold = 0;
  entry->virtualAdcLowThreshold = 0;
  entry->lastInputState = false;

  if (type == SegmentType::AnalogOutput) {
    entry->pwm.configure(static_cast<int8_t>(pin), pwmResolution, pwmFrequency);
    if (!entry->pwm.begin()) {
      WARNINGF("[PinManager] Failed to attach LEDC PWM on pin %d (no free channel or invalid pin).", pin);
      return false;
    }
    entry->hasPwm = true;
  } else if (type == SegmentType::AnalogInput) {
    entry->adc.configure(static_cast<int8_t>(pin), adcResolution, adcSampleIntervalMs, adcDeltaThreshold,
                         adcHighThreshold, adcLowThreshold);
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
  entry->setRule(rule);
  if (type == SegmentType::AnalogInput && entry->hasAdc && rule.active && rule.analogRangeCount > 0) {
    // Seed initial range membership from boot baseline so power-on never fires spurious enter events
    const uint16_t baseline = entry->adc.getValue();
    const uint16_t maxScale = entry->adc.getMaxValue();
    const uint8_t count =
        rule.analogRangeCount <= MAX_ANALOG_RANGE_RULES ? rule.analogRangeCount : MAX_ANALOG_RANGE_RULES;
    uint8_t mask = 0;
    for (uint8_t r = 0; r < count; ++r) {
      const AnalogRangeRule& rr = rule.analogRanges[r];
      if (rr.enabled &&
          uniuno::xtensa_asm::asm_range_eval(baseline, rr.minValue, rr.maxValue, rr.hysteresis, maxScale, false)) {
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
    INFOF("[PinManager] Added segment '%s' on pin %d (Type: analog_output, %u-bit @ %uHz)", id, pin,
          entry->pwm.getResolution(), entry->pwm.getFrequency());
  } else if (type == SegmentType::AnalogInput) {
    INFOF("[PinManager] Added segment '%s' on pin %d (Type: analog_input, %u-bit sint=%ums delta=%u ath=%u atl=%u "
          "ranges=%u)",
          id, pin, entry->adc.getResolution(), entry->adc.getSampleIntervalMs(), entry->adc.getDeltaThreshold(),
          entry->adc.getHighThreshold(), entry->adc.getLowThreshold(),
          static_cast<unsigned int>(entry->getRuleRef().analogRangeCount));
  } else {
    INFOF("[PinManager] Added segment '%s' on pin %d (Type: %s)", id, pin,
          (type == SegmentType::Input ? "input" : "output"));
  }
  _stateManager.rebuildInputCache();
  return true;
}

bool PinManager::upsertSegment(const char* id, SegmentType type, int pin, int autoOffDelay, RuleConfig rule,
                               uint8_t pwmResolution, uint16_t pwmFrequency, uint8_t adcResolution,
                               uint16_t adcSampleIntervalMs, uint16_t adcDeltaThreshold, uint16_t adcHighThreshold,
                               uint16_t adcLowThreshold) {
  // Validate incoming parameters BEFORE removing any existing segment so invalid
  // commands can never destroy a valid live registration.
  if (id == nullptr || id[0] == '\0') {
    WARNING("[PinManager] Segment ID is empty.");
    return false;
  }
  if (!isLocalGpioPin(pin)) {
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

  const int existingPinIdx = _registry.findIndexByPin(pin);
  const int existingIdIdx = _registry.findById(id);

  if (existingPinIdx < 0 && existingIdIdx < 0 && _registry.findEmptySlot() < 0) {
    WARNING("[PinManager] No empty slot for new segment.");
    return false;
  }

  if (existingPinIdx >= 0) {
    const PinEntry* existing = _registry.getEntryByIndexConst(existingPinIdx);
    if (existing) {
      INFOF("[PinManager] Replacing existing segment '%s' on pin %d with id '%s'", existing->segmentId, pin, id);
    }
    removeSegmentByIndex(existingPinIdx);
  }

  if (existingIdIdx >= 0 && existingIdIdx != existingPinIdx) {
    const PinEntry* moved = _registry.getEntryByIndexConst(existingIdIdx);
    if (moved && moved->active) {
      INFOF("[PinManager] Moving segment '%s' from pin %d to pin %d", id, moved->pinNumber, pin);
      removeSegmentByIndex(existingIdIdx);
    }
  }

  return addSegment(id, type, pin, autoOffDelay, rule, pwmResolution, pwmFrequency, adcResolution, adcSampleIntervalMs,
                    adcDeltaThreshold, adcHighThreshold, adcLowThreshold);
}

bool PinManager::addVirtualSegment(const char* id, SegmentType type, int virtualPin, uint8_t nodeId, uint8_t remotePin,
                                   int autoOffDelay, RuleConfig rule, uint8_t pwmResolution, uint16_t pwmFrequency,
                                   uint8_t adcResolution, uint16_t adcSampleIntervalMs, uint16_t adcDeltaThreshold,
                                   uint16_t adcHighThreshold, uint16_t adcLowThreshold) {
  if (id == nullptr || id[0] == '\0') {
    WARNING("[PinManager] Virtual segment ID is empty.");
    return false;
  }
  if (!isVirtualPin(virtualPin)) {
    WARNINGF("[PinManager] Virtual pin %d out of range (%d..%d).", virtualPin, VIRTUAL_PIN_MIN, VIRTUAL_PIN_MAX);
    return false;
  }
  if (!isValidAuxNodeId(nodeId)) {
    WARNINGF("[PinManager] Invalid auxiliary nodeId %u for virtual segment '%s'.", nodeId, id);
    return false;
  }
  if (!isValidAuxRemotePin(remotePin)) {
    WARNINGF("[PinManager] Invalid remote GPIO %u for virtual segment '%s'.", remotePin, id);
    return false;
  }
  if (_registry.findById(id) >= 0) {
    WARNINGF("[PinManager] Virtual segment '%s' already exists.", id);
    return false;
  }
  if (_registry.getEntryByPin(virtualPin) != nullptr) {
    WARNINGF("[PinManager] Virtual pin %d already in use.", virtualPin);
    return false;
  }
  if (_registry.findVirtualByNodeAndRemotePin(nodeId, remotePin) >= 0) {
    WARNINGF("[PinManager] Remote pin %u on node #%u already bound to another virtual segment.", remotePin, nodeId);
    return false;
  }

  const int slot = _registry.findEmptySlot();
  if (slot < 0) {
    WARNING("[PinManager] No empty slot for new virtual segment.");
    return false;
  }

  PinEntry* entry = _registry.getEntryByIndex(slot);
  if (!entry) return false;

  const uint8_t clampedPwmRes = (pwmResolution < MIN_PWM_RESOLUTION)
                                    ? MIN_PWM_RESOLUTION
                                    : ((pwmResolution > MAX_PWM_RESOLUTION) ? MAX_PWM_RESOLUTION : pwmResolution);
  const uint16_t clampedPwmFreq = (pwmFrequency < MIN_PWM_FREQUENCY)
                                      ? MIN_PWM_FREQUENCY
                                      : ((pwmFrequency > MAX_PWM_FREQUENCY) ? MAX_PWM_FREQUENCY : pwmFrequency);
  const uint8_t clampedAdcRes = (adcResolution < MIN_ADC_RESOLUTION)
                                    ? MIN_ADC_RESOLUTION
                                    : ((adcResolution > MAX_ADC_RESOLUTION) ? MAX_ADC_RESOLUTION : adcResolution);
  const uint16_t maxAdcVal = static_cast<uint16_t>((1UL << clampedAdcRes) - 1UL);
  const uint16_t clampedSint =
      (adcSampleIntervalMs < MIN_ADC_SAMPLE_INTERVAL_MS)
          ? MIN_ADC_SAMPLE_INTERVAL_MS
          : ((adcSampleIntervalMs > MAX_ADC_SAMPLE_INTERVAL_MS) ? MAX_ADC_SAMPLE_INTERVAL_MS : adcSampleIntervalMs);
  const uint16_t clampedDelta = (adcDeltaThreshold < MIN_ADC_DELTA_THRESHOLD)
                                    ? MIN_ADC_DELTA_THRESHOLD
                                    : ((adcDeltaThreshold > maxAdcVal) ? maxAdcVal : adcDeltaThreshold);
  const uint16_t clampedAth = (adcHighThreshold > maxAdcVal) ? maxAdcVal : adcHighThreshold;
  const uint16_t clampedAtl = (clampedAth == 0) ? 0 : ((adcLowThreshold > clampedAth) ? clampedAth : adcLowThreshold);

  // Virtual segments NEVER touch local ESP32 GPIO, LEDC, or SAR1 ADC hardware registers.
  entry->hasGpio = false;
  entry->hasPwm = false;
  entry->hasAdc = false;
  entry->isVirtual = true;
  entry->virtualState = false;
  entry->lastInputState = false;
  entry->nodeId = nodeId;
  entry->remotePin = remotePin;
  entry->virtualAnalogValue = 0;
  entry->virtualLastNonZeroValue = static_cast<uint16_t>((1UL << clampedPwmRes) - 1UL);
  entry->virtualPwmResolution = clampedPwmRes;
  entry->virtualPwmFrequency = clampedPwmFreq;
  entry->virtualAdcResolution = clampedAdcRes;
  entry->virtualAdcSampleIntervalMs = clampedSint;
  entry->virtualAdcDeltaThreshold = clampedDelta;
  entry->virtualAdcHighThreshold = clampedAth;
  entry->virtualAdcLowThreshold = clampedAtl;

  strncpy(entry->segmentId, id, sizeof(entry->segmentId) - 1);
  entry->segmentId[sizeof(entry->segmentId) - 1] = '\0';
  entry->type = type;
  entry->pinNumber = static_cast<int8_t>(virtualPin);
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
  entry->setRule(rule);
  entry->stateStartTime = millis();
  entry->lastDebounceTime = millis();

  _registry.mapPin(virtualPin, slot);
  entry->active = true;

  INFOF("[PinManager] Added VIRTUAL segment '%s' vpin=%d -> node#%u rpin=%u (type=%s)", id, virtualPin, nodeId,
        remotePin, segmentTypeToString(type));
  return true;
}

bool PinManager::upsertVirtualSegment(const char* id, SegmentType type, int virtualPin, uint8_t nodeId,
                                      uint8_t remotePin, int autoOffDelay, RuleConfig rule, uint8_t pwmResolution,
                                      uint16_t pwmFrequency, uint8_t adcResolution, uint16_t adcSampleIntervalMs,
                                      uint16_t adcDeltaThreshold, uint16_t adcHighThreshold, uint16_t adcLowThreshold) {
  if (id == nullptr || id[0] == '\0' || !isVirtualPin(virtualPin) || !isValidAuxNodeId(nodeId) ||
      !isValidAuxRemotePin(remotePin)) {
    WARNINGF("[PinManager] Rejected virtual segment upsert (vpin=%d node=%u rpin=%u).", virtualPin, nodeId, remotePin);
    return false;
  }

  const int existingPinIdx = _registry.findIndexByPin(virtualPin);
  const int existingIdIdx = _registry.findById(id);
  const int existingRemoteIdx = _registry.findVirtualByNodeAndRemotePin(nodeId, remotePin);

  if (existingPinIdx < 0 && existingIdIdx < 0 && existingRemoteIdx < 0 && _registry.findEmptySlot() < 0) {
    WARNING("[PinManager] No empty slot for new virtual segment.");
    return false;
  }

  if (existingPinIdx >= 0) {
    removeSegmentByIndex(existingPinIdx);
  }
  if (existingIdIdx >= 0 && existingIdIdx != existingPinIdx) {
    const PinEntry* moved = _registry.getEntryByIndexConst(existingIdIdx);
    if (moved && moved->active) {
      removeSegmentByIndex(existingIdIdx);
    }
  }
  if (existingRemoteIdx >= 0 && existingRemoteIdx != existingPinIdx && existingRemoteIdx != existingIdIdx) {
    const PinEntry* dupRemote = _registry.getEntryByIndexConst(existingRemoteIdx);
    if (dupRemote && dupRemote->active) {
      removeSegmentByIndex(existingRemoteIdx);
    }
  }

  return addVirtualSegment(id, type, virtualPin, nodeId, remotePin, autoOffDelay, rule, pwmResolution, pwmFrequency,
                           adcResolution, adcSampleIntervalMs, adcDeltaThreshold, adcHighThreshold, adcLowThreshold);
}

int PinManager::extractPinFromCanonicalId(const char* id) {
  if (id == nullptr || id[0] == '\0') {
    return -1;
  }

  bool requireVirtual = false;
  bool requireLocal = false;
  const char* digits = nullptr;
  if ((id[0] == 'v' || id[0] == 'V') && (id[1] == 'p' || id[1] == 'P') && (id[2] == 'i' || id[2] == 'I') &&
      (id[3] == 'n' || id[3] == 'N') && id[4] == '_') {
    digits = id + 5;
    requireVirtual = true;
  } else if ((id[0] == 'g' || id[0] == 'G') && (id[1] == 'p' || id[1] == 'P') && (id[2] == 'i' || id[2] == 'I') &&
             (id[3] == 'o' || id[3] == 'O') && id[4] == '_') {
    digits = id + 5;
    requireLocal = true;
  } else if ((id[0] == 'p' || id[0] == 'P') && (id[1] == 'i' || id[1] == 'I') && (id[2] == 'n' || id[2] == 'N') &&
             id[3] == '_') {
    digits = id + 4;
  } else if (id[0] >= '0' && id[0] <= '9') {
    digits = id;
  } else {
    return -1;
  }

  if (digits[0] < '0' || digits[0] > '9') {
    return -1;
  }

  int value = 0;
  int digitCount = 0;
  for (const char* p = digits; *p != '\0'; ++p) {
    if (*p < '0' || *p > '9') {
      return -1;
    }
    digitCount++;
    if (digitCount > 3) {
      return -1;
    }
    value = (value * 10) + (*p - '0');
  }

  if (requireVirtual) return isVirtualPin(value) ? value : -1;
  if (requireLocal) return isLocalGpioPin(value) ? value : -1;
  return isValidManagedPin(value) ? value : -1;
}

bool PinManager::removeSegmentByIndex(int idx) {
  PinEntry* entry = _registry.getEntryByIndex(idx);
  if (!entry || !entry->active) return false;

  char removedId[sizeof(entry->segmentId)];
  strncpy(removedId, entry->segmentId, sizeof(removedId) - 1);
  removedId[sizeof(removedId) - 1] = '\0';
  const int removedPin = entry->pinNumber;
  const bool wasVirtual = entry->isVirtual;

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
  entry->isVirtual = false;
  entry->virtualState = false;
  entry->pinNumber = -1;
  entry->nodeId = AUX_NODE_ID_LOCAL;
  entry->remotePin = REMOTE_PIN_UNSET;
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
  entry->virtualAnalogValue = 0;
  entry->virtualLastNonZeroValue = 0;
  entry->virtualPwmResolution = DEFAULT_PWM_RESOLUTION;
  entry->virtualPwmFrequency = DEFAULT_PWM_FREQUENCY;
  entry->virtualAdcResolution = DEFAULT_ADC_RESOLUTION;
  entry->virtualAdcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
  entry->virtualAdcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
  entry->virtualAdcHighThreshold = 0;
  entry->virtualAdcLowThreshold = 0;
  entry->pendingHoldAction = RuleAction();
  entry->isHandled = false;
  entry->clickCount = 0;
  entry->clickPolarity = false;
  entry->lastClickTimeMs = 0;
  entry->analogRangeActiveMask = 0;
  entry->clearRule();
  entry->stateStartTime = 0;
  entry->lastDebounceTime = 0;

  INFOF("[PinManager] Removed %ssegment '%s' (pin %d)", wasVirtual ? "virtual " : "", removedId, removedPin);
  if (!wasVirtual) {
    _stateManager.rebuildInputCache();
  }
  return true;
}

bool PinManager::removeSegment(const char* id) {
  const int idx = _registry.findById(id);
  if (idx < 0) {
    WARNINGF("[PinManager] Segment '%s' not found.", id ? id : "");
    return false;
  }
  return removeSegmentByIndex(idx);
}

bool PinManager::removeSegmentByPin(int pin) {
  const int idx = _registry.findIndexByPin(pin);
  if (idx < 0) {
    WARNINGF("[PinManager] No segment registered on pin %d.", pin);
    return false;
  }
  return removeSegmentByIndex(idx);
}

bool PinManager::removeSegmentByIdOrPin(const char* id, int fallbackPin) {
  if (id != nullptr && id[0] != '\0') {
    const int idx = _registry.findById(id);
    if (idx >= 0) {
      return removeSegmentByIndex(idx);
    }
  }

  if (isValidManagedPin(fallbackPin)) {
    const int pinIdx = _registry.findIndexByPin(fallbackPin);
    if (pinIdx >= 0) {
      const PinEntry* entry = _registry.getEntryByIndexConst(pinIdx);
      WARNINGF("[PinManager] Segment '%s' not found; resolved via fallback pin %d (stored id='%s').", id ? id : "",
               fallbackPin, entry ? entry->segmentId : "");
      return removeSegmentByIndex(pinIdx);
    }
  }

  if (fallbackPin < 0 && id != nullptr && id[0] != '\0') {
    const int canonicalPin = extractPinFromCanonicalId(id);
    if (canonicalPin >= 0) {
      const int pinIdx = _registry.findIndexByPin(canonicalPin);
      if (pinIdx >= 0) {
        const PinEntry* entry = _registry.getEntryByIndexConst(pinIdx);
        WARNINGF("[PinManager] Canonical segment '%s' not found; resolved via pin %d (stored id='%s').", id,
                 canonicalPin, entry ? entry->segmentId : "");
        return removeSegmentByIndex(pinIdx);
      }
    }
  }

  if (fallbackPin >= 0) {
    WARNINGF("[PinManager] Segment '%s' (fallback pin %d) not found.", id ? id : "", fallbackPin);
  } else {
    WARNINGF("[PinManager] Segment '%s' not found.", id ? id : "");
  }
  return false;
}

int PinManager::removeSegmentsByNodeId(uint8_t nodeId) {
  if (!isValidAuxNodeId(nodeId)) return 0;
  int removed = 0;
  for (int i = 0; i < MAX_PINS; ++i) {
    const PinEntry* entry = _registry.getEntryByIndexConst(i);
    if (entry && entry->active && entry->isVirtual && entry->nodeId == nodeId && removeSegmentByIndex(i)) {
      ++removed;
    }
  }
  if (removed > 0) {
    INFOF("[PinManager] Cascade-removed %d virtual segment(s) bound to aux node #%u", removed, nodeId);
  }
  return removed;
}

void PinManager::clearAllSegments() {
  for (int i = 0; i < MAX_PINS; ++i) {
    const PinEntry* entry = _registry.getEntryByIndexConst(i);
    if (entry && entry->active) {
      removeSegmentByIndex(i);
    }
  }
}

bool PinManager::hasPin(int pin) const {
  return _registry.findIndexByPin(pin) >= 0;
}

bool PinManager::hasId(const char* id) const {
  return _registry.findById(id) >= 0;
}

bool PinManager::isVirtualPinRegistered(int pin) const {
  const PinEntry* entry = _registry.getEntryByPinConst(pin);
  return entry != nullptr && entry->active && entry->isVirtual;
}

bool PinManager::getVirtualBinding(int pin, uint8_t& outNodeId, uint8_t& outRemotePin) const {
  const PinEntry* entry = _registry.getEntryByPinConst(pin);
  if (!entry || !entry->active || !entry->isVirtual) {
    outNodeId = AUX_NODE_ID_LOCAL;
    outRemotePin = REMOTE_PIN_UNSET;
    return false;
  }
  outNodeId = entry->nodeId;
  outRemotePin = entry->remotePin;
  return true;
}

SegmentType PinManager::getSegmentTypeByPin(int pin) const {
  const PinEntry* entry = _registry.getEntryByPinConst(pin);
  return (entry && entry->active) ? entry->type : SegmentType::Output;
}

const char* PinManager::getSegmentIdByPin(int pin) const {
  const PinEntry* entry = _registry.getEntryByPinConst(pin);
  return (entry && entry->active) ? entry->segmentId : nullptr;
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
  entry->setRule(rule);
  return true;
}

bool PinManager::updateSegmentRuleByPin(int pin, const RuleConfig& rule) {
  PinEntry* entry = _registry.getEntryByPin(pin);
  if (!entry || !entry->active || (entry->type != SegmentType::Input && entry->type != SegmentType::AnalogInput)) {
    return false;
  }
  entry->doubleClickTimer.cancel();
  entry->doubleClickTimer = uniuno::TimerHandle();
  entry->clickCount = 0;
  entry->analogRangeActiveMask = 0;
  entry->setRule(rule);
  return true;
}

bool PinManager::updateAnalogInputConfigByPin(int pin, uint16_t sampleIntervalMs, uint16_t deltaThreshold,
                                              uint16_t highThreshold, uint16_t lowThreshold, uint8_t resolution) {
  PinEntry* entry = _registry.getEntryByPin(pin);
  if (!entry || !entry->active || entry->type != SegmentType::AnalogInput) {
    return false;
  }

  if (entry->isVirtual) {
    if (resolution >= MIN_ADC_RESOLUTION && resolution <= MAX_ADC_RESOLUTION) {
      entry->virtualAdcResolution = resolution;
    }
    const uint16_t maxAdcVal = static_cast<uint16_t>((1UL << entry->virtualAdcResolution) - 1UL);
    entry->virtualAdcSampleIntervalMs =
        (sampleIntervalMs < MIN_ADC_SAMPLE_INTERVAL_MS)
            ? MIN_ADC_SAMPLE_INTERVAL_MS
            : ((sampleIntervalMs > MAX_ADC_SAMPLE_INTERVAL_MS) ? MAX_ADC_SAMPLE_INTERVAL_MS : sampleIntervalMs);
    entry->virtualAdcDeltaThreshold = (deltaThreshold < MIN_ADC_DELTA_THRESHOLD)
                                          ? MIN_ADC_DELTA_THRESHOLD
                                          : ((deltaThreshold > maxAdcVal) ? maxAdcVal : deltaThreshold);
    entry->virtualAdcHighThreshold = (highThreshold > maxAdcVal) ? maxAdcVal : highThreshold;
    entry->virtualAdcLowThreshold =
        (entry->virtualAdcHighThreshold == 0)
            ? 0
            : ((lowThreshold > entry->virtualAdcHighThreshold) ? entry->virtualAdcHighThreshold : lowThreshold);
    INFOF("[PinManager] Updated virtual analog_input pin=%d (%u-bit sint=%ums delta=%u ath=%u atl=%u)", pin,
          entry->virtualAdcResolution, entry->virtualAdcSampleIntervalMs, entry->virtualAdcDeltaThreshold,
          entry->virtualAdcHighThreshold, entry->virtualAdcLowThreshold);
    return true;
  }

  if (!entry->hasAdc) {
    return false;
  }
  entry->adc.updateParameters(sampleIntervalMs, deltaThreshold, highThreshold, lowThreshold, resolution);
  entry->lastInputState = entry->adc.getThresholdState();
  _stateManager.rebuildInputCache();
  INFOF("[PinManager] Updated analog_input GPIO%d (%u-bit sint=%ums delta=%u ath=%u atl=%u)", pin,
        entry->adc.getResolution(), entry->adc.getSampleIntervalMs(), entry->adc.getDeltaThreshold(),
        entry->adc.getHighThreshold(), entry->adc.getLowThreshold());
  return true;
}
