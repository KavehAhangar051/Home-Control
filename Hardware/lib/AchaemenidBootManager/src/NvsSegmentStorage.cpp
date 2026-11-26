#include "NvsSegmentStorage.h"
#include <Arduino.h>
#include <cstdio>
#include <cstring>

namespace uniuno {
namespace {
constexpr uint8_t STORAGE_VERSION_V2 = 2;
constexpr uint8_t STORAGE_VERSION_V3 = 3;
constexpr uint8_t STORAGE_VERSION_V4 = 4;
constexpr uint8_t STORAGE_VERSION_V5 = 5;
constexpr uint8_t STORAGE_VERSION_V6 = 6;
constexpr uint8_t STORAGE_VERSION = 7;
constexpr char NVS_NAMESPACE[] = "AchaemenidSeg";

#pragma pack(push, 1)
struct StoredRuleActionV2 {
  int32_t requiredHoldTime;
  int8_t targetPin;
  uint8_t actionState;
  uint8_t actionType;
  int32_t delay;
};
struct StoredSegmentV2 {
  char id[32];
  char type[16];
  int16_t pin;
  uint16_t autoOffDelay;
  uint8_t highActionCount;
  uint8_t lowActionCount;
  uint8_t ruleActive;
  StoredRuleActionV2 highActions[4];
  StoredRuleActionV2 lowActions[4];
};
struct StoredRuleAction {
  int32_t requiredHoldTime;
  int8_t targetPin;
  uint8_t actionState;
  uint8_t actionType;
  int32_t delay;
  int16_t targetValue; // -1 = boolean actionState mode, 0..4095 = explicit PWM duty
};
struct StoredSegmentV3 {
  char id[32];
  char type[16];
  int16_t pin;
  uint16_t autoOffDelay;
  uint8_t pwmResolution;
  uint16_t pwmFrequency;
  uint8_t highActionCount;
  uint8_t lowActionCount;
  uint8_t ruleActive;
  StoredRuleAction highActions[4];
  StoredRuleAction lowActions[4];
};
struct StoredSegmentV4 {
  char id[32];
  char type[16];
  int16_t pin;
  uint16_t autoOffDelay;
  uint8_t pwmResolution;
  uint16_t pwmFrequency;
  uint8_t adcResolution;
  uint16_t adcSampleIntervalMs;
  uint16_t adcDeltaThreshold;
  uint16_t adcHighThreshold;
  uint16_t adcLowThreshold;
  uint8_t highActionCount;
  uint8_t lowActionCount;
  uint8_t ruleActive;
  StoredRuleAction highActions[4];
  StoredRuleAction lowActions[4];
};
struct StoredAnalogRangeRule {
  uint16_t minValue;
  uint16_t maxValue;
  uint16_t hysteresis;
  int16_t targetValue;
  int8_t targetPin;
  uint8_t delay;
  uint8_t flags; // bit0=actionState, bits1..2=actionType, bit3=triggerMode, bit4=enabled
  uint8_t reserved;
};
struct StoredSegmentV5 {
  char id[32];
  char type[16];
  int16_t pin;
  uint16_t autoOffDelay;
  uint8_t pwmResolution;
  uint16_t pwmFrequency;
  uint8_t adcResolution;
  uint16_t adcSampleIntervalMs;
  uint16_t adcDeltaThreshold;
  uint16_t adcHighThreshold;
  uint16_t adcLowThreshold;
  uint8_t highActionCount;
  uint8_t lowActionCount;
  uint8_t ruleActive;
  StoredRuleAction highActions[4];
  StoredRuleAction lowActions[4];
  uint8_t analogRangeCount;
  StoredAnalogRangeRule analogRanges[MAX_ANALOG_RANGE_RULES];
};
/**
 * @brief Compact variable-length V6 header (70 bytes).
 * Followed immediately by only the active rule payloads:
 *   highActionCount * StoredRuleAction (13B)
 * + lowActionCount  * StoredRuleAction (13B)
 * + analogRangeCount * StoredAnalogRangeRule (12B)
 * This shrinks no-rule segments from 244B to 70B so 48 segments x 2 banks fit comfortably in min_spiffs NVS.
 */
struct StoredSegmentHeaderV6 {
  char id[32];
  char type[16];
  int16_t pin;
  uint16_t autoOffDelay;
  uint8_t pwmResolution;
  uint16_t pwmFrequency;
  uint8_t adcResolution;
  uint16_t adcSampleIntervalMs;
  uint16_t adcDeltaThreshold;
  uint16_t adcHighThreshold;
  uint16_t adcLowThreshold;
  uint8_t flags;     // bit0=isVirtual, bit1=ruleActive
  uint8_t nodeId;    // 0=local, 1..16=aux node
  uint8_t remotePin; // REMOTE_PIN_UNSET for local, 0..39 for remote
  uint8_t highActionCount;
  uint8_t lowActionCount;
  uint8_t analogRangeCount;
};
#pragma pack(pop)

#pragma pack(push, 1)
struct StoredRuleCondition {
  uint16_t value;
  uint16_t maxValue;
  int8_t sourcePin;
  uint8_t op;
};
#pragma pack(pop)

constexpr size_t MAX_V6_BLOB_SIZE = sizeof(StoredSegmentHeaderV6) + (4U * sizeof(StoredRuleAction)) +
                                    (4U * sizeof(StoredRuleAction)) +
                                    (MAX_ANALOG_RANGE_RULES * sizeof(StoredAnalogRangeRule));

constexpr size_t MAX_V7_BLOB_SIZE =
    sizeof(StoredSegmentHeaderV6) +
    (2U * MAX_RULE_ACTIONS_PER_SIDE *
     (sizeof(StoredRuleAction) + 1U + (MAX_RULE_CONDITIONS_PER_ACTION * sizeof(StoredRuleCondition)))) +
    (MAX_ANALOG_RANGE_RULES *
     (sizeof(StoredAnalogRangeRule) + (MAX_RULE_CONDITIONS_PER_ACTION * sizeof(StoredRuleCondition))));

static_assert(sizeof(StoredRuleActionV2) == 11, "Unexpected stored RuleActionV2 layout");
static_assert(sizeof(StoredRuleAction) == 13, "Unexpected stored RuleAction layout");
static_assert(sizeof(StoredAnalogRangeRule) == 12, "Unexpected stored AnalogRangeRule layout");
static_assert(sizeof(StoredRuleCondition) == 6, "Unexpected stored RuleCondition layout");
static_assert(sizeof(StoredSegmentHeaderV6) == 70, "Unexpected stored StoredSegmentHeaderV6 layout");

void copyActionToStorage(const RuleAction& source, StoredRuleAction& target) {
  target.requiredHoldTime = source.requiredHoldTime;
  target.targetPin = static_cast<int8_t>(source.targetPin);
  target.actionState = source.actionState ? 1 : 0;
  target.actionType = static_cast<uint8_t>(source.actionType);
  target.delay = source.delay;
  target.targetValue = source.targetValue;
}

bool copyActionFromStorageV2(const StoredRuleActionV2& source, RuleAction& target) {
  if (!isValidManagedPin(source.targetPin) || source.actionState > 1 || source.actionType > ACTION_FOR_DURATION ||
      source.delay < 0 || source.delay > 60)
    return false;
  if (source.requiredHoldTime != 0 && source.requiredHoldTime != 3 && source.requiredHoldTime != 5 &&
      source.requiredHoldTime != 10)
    return false;

  target.requiredHoldTime = source.requiredHoldTime;
  target.targetPin = source.targetPin;
  target.actionState = source.actionState != 0;
  target.actionType = static_cast<RuleActionType>(source.actionType);
  target.delay = source.delay;
  target.targetValue = RULE_ANALOG_VALUE_UNSET;
  return true;
}

bool copyActionFromStorage(const StoredRuleAction& source, RuleAction& target) {
  if (!isValidManagedPin(source.targetPin) || source.actionState > 1 || source.actionType > ACTION_FOR_DURATION ||
      source.delay < 0 || source.delay > 60)
    return false;
  if (!isValidDigitalHoldTime(source.requiredHoldTime)) return false;
  if (source.targetValue != RULE_ANALOG_VALUE_UNSET &&
      (source.targetValue < 0 || source.targetValue > MAX_ANALOG_OUTPUT_VALUE))
    return false;

  target.reset();
  target.requiredHoldTime = source.requiredHoldTime;
  target.targetPin = source.targetPin;
  target.actionState = source.actionState != 0;
  target.actionType = static_cast<RuleActionType>(source.actionType);
  target.delay = source.delay;
  target.targetValue = source.targetValue;
  return true;
}

void copyRangeToStorage(const AnalogRangeRule& source, uint16_t maxAdcVal, StoredAnalogRangeRule& target) {
  uint16_t lo = source.minValue > maxAdcVal ? maxAdcVal : source.minValue;
  uint16_t hi = source.maxValue > maxAdcVal ? maxAdcVal : source.maxValue;
  if (lo > hi) {
    const uint16_t tmp = lo;
    lo = hi;
    hi = tmp;
  }
  const uint16_t maxHyst = static_cast<uint16_t>(maxAdcVal / 2U);
  target.minValue = lo;
  target.maxValue = hi;
  target.hysteresis = source.hysteresis > maxHyst ? maxHyst : source.hysteresis;
  target.targetValue = source.targetValue;
  target.targetPin = source.targetPin;
  target.delay = source.delay > 60 ? 60 : source.delay;
  target.flags = static_cast<uint8_t>(
      (source.actionState ? 0x01U : 0x00U) | ((static_cast<uint8_t>(source.actionType) & 0x03U) << 1) |
      ((static_cast<uint8_t>(source.triggerMode) & 0x01U) << 3) | (source.enabled ? 0x10U : 0x00U));
  target.reserved = 0;
}

bool copyRangeFromStorage(const StoredAnalogRangeRule& source, uint16_t maxAdcVal, AnalogRangeRule& target) {
  const uint8_t actionType = static_cast<uint8_t>((source.flags >> 1) & 0x03U);
  const uint8_t triggerMode = static_cast<uint8_t>((source.flags >> 3) & 0x01U);
  if (!isValidManagedPin(source.targetPin) || actionType > ACTION_FOR_DURATION || source.delay > 60 ||
      source.minValue > maxAdcVal || source.maxValue > maxAdcVal || source.minValue > source.maxValue ||
      source.hysteresis > static_cast<uint16_t>(maxAdcVal / 2U)) {
    return false;
  }
  if (source.targetValue != RULE_ANALOG_VALUE_UNSET &&
      (source.targetValue < 0 || source.targetValue > MAX_ANALOG_OUTPUT_VALUE)) {
    return false;
  }

  target.reset();
  target.minValue = source.minValue;
  target.maxValue = source.maxValue;
  target.hysteresis = source.hysteresis;
  target.targetValue = source.targetValue;
  target.targetPin = source.targetPin;
  target.delay = source.delay;
  target.actionType = static_cast<RuleActionType>(actionType);
  target.triggerMode = static_cast<AnalogRangeTriggerMode>(triggerMode);
  target.actionState = (source.flags & 0x01U) != 0U;
  target.enabled = (source.flags & 0x10U) != 0U;
  return true;
}

uint8_t encodeConditionMeta(uint8_t count, uint8_t logic) {
  const uint8_t safeCount = count <= MAX_RULE_CONDITIONS_PER_ACTION ? count : MAX_RULE_CONDITIONS_PER_ACTION;
  const uint8_t safeLogic = (logic == COND_LOGIC_OR) ? 1U : 0U;
  return static_cast<uint8_t>((safeCount & 0x0FU) | (safeLogic << 4));
}

size_t writeConditionsToBlob(const RuleCondition* conditions, uint8_t count, uint8_t* dst, size_t offset) {
  const uint8_t safeCount = count <= MAX_RULE_CONDITIONS_PER_ACTION ? count : MAX_RULE_CONDITIONS_PER_ACTION;
  for (uint8_t i = 0; i < safeCount; ++i) {
    StoredRuleCondition sc{};
    sc.value = conditions[i].value;
    sc.maxValue = conditions[i].maxValue;
    sc.sourcePin = conditions[i].sourcePin;
    sc.op = conditions[i].op;
    memcpy(dst + offset, &sc, sizeof(sc));
    offset += sizeof(sc);
  }
  return offset;
}

bool readConditionsFromBlob(const uint8_t* src, size_t blobLen, size_t& offset, uint8_t condMeta,
                            RuleCondition* outConds, uint8_t& outCount, uint8_t& outLogic) {
  const uint8_t count = static_cast<uint8_t>(condMeta & 0x0FU);
  const uint8_t logic = static_cast<uint8_t>((condMeta >> 4) & 0x01U);
  if (count > MAX_RULE_CONDITIONS_PER_ACTION) return false;
  if (offset + (static_cast<size_t>(count) * sizeof(StoredRuleCondition)) > blobLen) return false;
  outCount = count;
  outLogic = (logic == COND_LOGIC_OR) ? COND_LOGIC_OR : COND_LOGIC_AND;
  for (uint8_t i = 0; i < count; ++i) {
    StoredRuleCondition sc{};
    memcpy(&sc, src + offset, sizeof(sc));
    offset += sizeof(sc);
    RuleCondition cond;
    cond.value = sc.value;
    cond.maxValue = sc.maxValue;
    cond.sourcePin = sc.sourcePin;
    cond.op = sc.op;
    if (!isValidRuleCondition(cond)) return false;
    outConds[i] = cond;
  }
  return true;
}

bool loadBank(Preferences& prefs, char bank, ParseResult& out) {
  // Preserve any already-loaded auxNodes in out while resetting segments.
  for (int i = 0; i < MAX_SEGMENTS; ++i) {
    out.segments[i].reset();
  }
  out.count = 0;
  out.segmentsProvided = false;

  char countKey[8];
  char versionKey[8];
  snprintf(countKey, sizeof(countKey), "%cCount", bank);
  snprintf(versionKey, sizeof(versionKey), "%cVer", bank);

  const int count = prefs.getInt(countKey, -1);
  const uint8_t version = prefs.getUChar(versionKey, 0);
  if ((version != STORAGE_VERSION && version != STORAGE_VERSION_V6 && version != STORAGE_VERSION_V5 &&
       version != STORAGE_VERSION_V4 && version != STORAGE_VERSION_V3 && version != STORAGE_VERSION_V2) ||
      count < 0 || count > MAX_SEGMENTS) {
    return false;
  }

  union {
    StoredSegmentV2 v2;
    StoredSegmentV3 v3;
    StoredSegmentV4 v4;
    StoredSegmentV5 v5;
    uint8_t v7Buf[MAX_V7_BLOB_SIZE];
  } recordBuf;

  char key[16];
  for (int i = 0; i < count; ++i) {
    snprintf(key, sizeof(key), "%c%d", bank, i);

    if (version == STORAGE_VERSION_V2) {
      if (prefs.getBytesLength(key) != sizeof(StoredSegmentV2)) {
        Serial.printf("[SegStorage] Bank %c (v2) rejected: invalid record size for %s\n", bank, key);
        return false;
      }

      StoredSegmentV2& record = recordBuf.v2;
      memset(&record, 0, sizeof(record));
      if (prefs.getBytes(key, &record, sizeof(record)) != sizeof(record)) {
        Serial.printf("[SegStorage] Bank %c (v2) rejected: failed reading %s\n", bank, key);
        return false;
      }

      const bool idTerminated = memchr(record.id, '\0', sizeof(record.id)) != nullptr;
      const bool typeTerminated = memchr(record.type, '\0', sizeof(record.type)) != nullptr;
      if (!idTerminated || !typeTerminated || record.id[0] == '\0' || record.type[0] == '\0' ||
          !isLocalGpioPin(record.pin) || record.highActionCount > 4 || record.lowActionCount > 4 ||
          record.ruleActive > 1) {
        Serial.printf("[SegStorage] Bank %c (v2) rejected: invalid segment record %s\n", bank, key);
        return false;
      }

      for (int previous = 0; previous < out.count; ++previous) {
        if (out.segments[previous].pin == record.pin || strcmp(out.segments[previous].id, record.id) == 0) {
          Serial.printf("[SegStorage] Bank %c (v2) rejected: duplicate ID or GPIO in %s\n", bank, key);
          return false;
        }
      }

      SegmentConfig& segment = out.segments[out.count];
      segment.reset();
      strlcpy(segment.id, record.id, sizeof(segment.id));
      strlcpy(segment.type, record.type, sizeof(segment.type));
      segment.pin = record.pin;
      segment.autoOffDelay = record.autoOffDelay;
      segment.valid = true;
      segment.rule.active = record.ruleActive != 0;

      for (int a = 0; a < record.highActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorageV2(record.highActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v2) rejected: invalid HIGH action in %s\n", bank, key);
          return false;
        }
        segment.rule.highActions[segment.rule.highActionCount++] = action;
      }
      for (int a = 0; a < record.lowActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorageV2(record.lowActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v2) rejected: invalid LOW action in %s\n", bank, key);
          return false;
        }
        segment.rule.lowActions[segment.rule.lowActionCount++] = action;
      }

      if (segment.rule.highActionCount == 0 && segment.rule.lowActionCount == 0) {
        segment.rule.active = false;
      }
      ++out.count;
      continue;
    }

    if (version == STORAGE_VERSION_V3) {
      if (prefs.getBytesLength(key) != sizeof(StoredSegmentV3)) {
        Serial.printf("[SegStorage] Bank %c (v3) rejected: invalid record size for %s\n", bank, key);
        return false;
      }

      StoredSegmentV3& record = recordBuf.v3;
      memset(&record, 0, sizeof(record));
      if (prefs.getBytes(key, &record, sizeof(record)) != sizeof(record)) {
        Serial.printf("[SegStorage] Bank %c (v3) rejected: failed reading %s\n", bank, key);
        return false;
      }

      const bool idTerminated = memchr(record.id, '\0', sizeof(record.id)) != nullptr;
      const bool typeTerminated = memchr(record.type, '\0', sizeof(record.type)) != nullptr;
      if (!idTerminated || !typeTerminated || record.id[0] == '\0' || record.type[0] == '\0' ||
          !isLocalGpioPin(record.pin) || record.pwmResolution < MIN_PWM_RESOLUTION ||
          record.pwmResolution > MAX_PWM_RESOLUTION || record.pwmFrequency < MIN_PWM_FREQUENCY ||
          record.pwmFrequency > MAX_PWM_FREQUENCY || record.highActionCount > 4 || record.lowActionCount > 4 ||
          record.ruleActive > 1) {
        Serial.printf("[SegStorage] Bank %c (v3) rejected: invalid segment record %s\n", bank, key);
        return false;
      }

      for (int previous = 0; previous < out.count; ++previous) {
        if (out.segments[previous].pin == record.pin || strcmp(out.segments[previous].id, record.id) == 0) {
          Serial.printf("[SegStorage] Bank %c (v3) rejected: duplicate ID or GPIO in %s\n", bank, key);
          return false;
        }
      }

      SegmentConfig& segment = out.segments[out.count];
      segment.reset();
      strlcpy(segment.id, record.id, sizeof(segment.id));
      strlcpy(segment.type, record.type, sizeof(segment.type));
      segment.pin = record.pin;
      segment.autoOffDelay = record.autoOffDelay;
      segment.pwmResolution = record.pwmResolution;
      segment.pwmFrequency = record.pwmFrequency;
      segment.valid = true;
      segment.rule.active = record.ruleActive != 0;

      for (int a = 0; a < record.highActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorage(record.highActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v3) rejected: invalid HIGH action in %s\n", bank, key);
          return false;
        }
        segment.rule.highActions[segment.rule.highActionCount++] = action;
      }
      for (int a = 0; a < record.lowActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorage(record.lowActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v3) rejected: invalid LOW action in %s\n", bank, key);
          return false;
        }
        segment.rule.lowActions[segment.rule.lowActionCount++] = action;
      }

      if (segment.rule.highActionCount == 0 && segment.rule.lowActionCount == 0) {
        segment.rule.active = false;
      }
      ++out.count;
      continue;
    }

    if (version == STORAGE_VERSION_V4) {
      if (prefs.getBytesLength(key) != sizeof(StoredSegmentV4)) {
        Serial.printf("[SegStorage] Bank %c (v4) rejected: invalid record size for %s\n", bank, key);
        return false;
      }

      StoredSegmentV4& record = recordBuf.v4;
      memset(&record, 0, sizeof(record));
      if (prefs.getBytes(key, &record, sizeof(record)) != sizeof(record)) {
        Serial.printf("[SegStorage] Bank %c (v4) rejected: failed reading %s\n", bank, key);
        return false;
      }

      const bool idTerminated = memchr(record.id, '\0', sizeof(record.id)) != nullptr;
      const bool typeTerminated = memchr(record.type, '\0', sizeof(record.type)) != nullptr;
      const uint16_t maxAdcVal =
          (record.adcResolution >= MIN_ADC_RESOLUTION && record.adcResolution <= MAX_ADC_RESOLUTION)
              ? static_cast<uint16_t>((1UL << record.adcResolution) - 1UL)
              : MAX_ANALOG_INPUT_VALUE;
      if (!idTerminated || !typeTerminated || record.id[0] == '\0' || record.type[0] == '\0' ||
          !isLocalGpioPin(record.pin) || record.pwmResolution < MIN_PWM_RESOLUTION ||
          record.pwmResolution > MAX_PWM_RESOLUTION || record.pwmFrequency < MIN_PWM_FREQUENCY ||
          record.pwmFrequency > MAX_PWM_FREQUENCY || record.adcResolution < MIN_ADC_RESOLUTION ||
          record.adcResolution > MAX_ADC_RESOLUTION || record.adcSampleIntervalMs < MIN_ADC_SAMPLE_INTERVAL_MS ||
          record.adcSampleIntervalMs > MAX_ADC_SAMPLE_INTERVAL_MS ||
          record.adcDeltaThreshold < MIN_ADC_DELTA_THRESHOLD || record.adcDeltaThreshold > maxAdcVal ||
          record.adcHighThreshold > maxAdcVal || record.adcLowThreshold > record.adcHighThreshold ||
          record.highActionCount > 4 || record.lowActionCount > 4 || record.ruleActive > 1) {
        Serial.printf("[SegStorage] Bank %c (v4) rejected: invalid segment record %s\n", bank, key);
        return false;
      }

      for (int previous = 0; previous < out.count; ++previous) {
        if (out.segments[previous].pin == record.pin || strcmp(out.segments[previous].id, record.id) == 0) {
          Serial.printf("[SegStorage] Bank %c (v4) rejected: duplicate ID or GPIO in %s\n", bank, key);
          return false;
        }
      }

      SegmentConfig& segment = out.segments[out.count];
      segment.reset();
      strlcpy(segment.id, record.id, sizeof(segment.id));
      strlcpy(segment.type, record.type, sizeof(segment.type));
      segment.pin = record.pin;
      segment.autoOffDelay = record.autoOffDelay;
      segment.pwmResolution = record.pwmResolution;
      segment.pwmFrequency = record.pwmFrequency;
      segment.adcResolution = record.adcResolution;
      segment.adcSampleIntervalMs = record.adcSampleIntervalMs;
      segment.adcDeltaThreshold = record.adcDeltaThreshold;
      segment.adcHighThreshold = record.adcHighThreshold;
      segment.adcLowThreshold = record.adcLowThreshold;
      segment.valid = true;
      segment.rule.active = record.ruleActive != 0;

      for (int a = 0; a < record.highActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorage(record.highActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v4) rejected: invalid HIGH action in %s\n", bank, key);
          return false;
        }
        segment.rule.highActions[segment.rule.highActionCount++] = action;
      }
      for (int a = 0; a < record.lowActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorage(record.lowActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v4) rejected: invalid LOW action in %s\n", bank, key);
          return false;
        }
        segment.rule.lowActions[segment.rule.lowActionCount++] = action;
      }

      if (segment.rule.highActionCount == 0 && segment.rule.lowActionCount == 0) {
        segment.rule.active = false;
      }
      ++out.count;
      continue;
    }

    if (version == STORAGE_VERSION_V5) {
      if (prefs.getBytesLength(key) != sizeof(StoredSegmentV5)) {
        Serial.printf("[SegStorage] Bank %c (v5) rejected: invalid record size for %s\n", bank, key);
        return false;
      }

      StoredSegmentV5& record = recordBuf.v5;
      memset(&record, 0, sizeof(record));
      if (prefs.getBytes(key, &record, sizeof(record)) != sizeof(record)) {
        Serial.printf("[SegStorage] Bank %c (v5) rejected: failed reading %s\n", bank, key);
        return false;
      }

      const bool idTerminated = memchr(record.id, '\0', sizeof(record.id)) != nullptr;
      const bool typeTerminated = memchr(record.type, '\0', sizeof(record.type)) != nullptr;
      const uint16_t maxAdcVal =
          (record.adcResolution >= MIN_ADC_RESOLUTION && record.adcResolution <= MAX_ADC_RESOLUTION)
              ? static_cast<uint16_t>((1UL << record.adcResolution) - 1UL)
              : MAX_ANALOG_INPUT_VALUE;
      if (!idTerminated || !typeTerminated || record.id[0] == '\0' || record.type[0] == '\0' ||
          !isLocalGpioPin(record.pin) || record.pwmResolution < MIN_PWM_RESOLUTION ||
          record.pwmResolution > MAX_PWM_RESOLUTION || record.pwmFrequency < MIN_PWM_FREQUENCY ||
          record.pwmFrequency > MAX_PWM_FREQUENCY || record.adcResolution < MIN_ADC_RESOLUTION ||
          record.adcResolution > MAX_ADC_RESOLUTION || record.adcSampleIntervalMs < MIN_ADC_SAMPLE_INTERVAL_MS ||
          record.adcSampleIntervalMs > MAX_ADC_SAMPLE_INTERVAL_MS ||
          record.adcDeltaThreshold < MIN_ADC_DELTA_THRESHOLD || record.adcDeltaThreshold > maxAdcVal ||
          record.adcHighThreshold > maxAdcVal || record.adcLowThreshold > record.adcHighThreshold ||
          record.highActionCount > 4 || record.lowActionCount > 4 || record.analogRangeCount > MAX_ANALOG_RANGE_RULES ||
          record.ruleActive > 1) {
        Serial.printf("[SegStorage] Bank %c (v5) rejected: invalid segment record %s\n", bank, key);
        return false;
      }

      for (int previous = 0; previous < out.count; ++previous) {
        if (out.segments[previous].pin == record.pin || strcmp(out.segments[previous].id, record.id) == 0) {
          Serial.printf("[SegStorage] Bank %c (v5) rejected: duplicate ID or GPIO in %s\n", bank, key);
          return false;
        }
      }

      SegmentConfig& segment = out.segments[out.count];
      segment.reset();
      strlcpy(segment.id, record.id, sizeof(segment.id));
      strlcpy(segment.type, record.type, sizeof(segment.type));
      segment.pin = record.pin;
      segment.autoOffDelay = record.autoOffDelay;
      segment.pwmResolution = record.pwmResolution;
      segment.pwmFrequency = record.pwmFrequency;
      segment.adcResolution = record.adcResolution;
      segment.adcSampleIntervalMs = record.adcSampleIntervalMs;
      segment.adcDeltaThreshold = record.adcDeltaThreshold;
      segment.adcHighThreshold = record.adcHighThreshold;
      segment.adcLowThreshold = record.adcLowThreshold;
      segment.valid = true;
      segment.rule.active = record.ruleActive != 0;

      for (int a = 0; a < record.highActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorage(record.highActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v5) rejected: invalid HIGH action in %s\n", bank, key);
          return false;
        }
        segment.rule.highActions[segment.rule.highActionCount++] = action;
      }
      for (int a = 0; a < record.lowActionCount; ++a) {
        RuleAction action;
        if (!copyActionFromStorage(record.lowActions[a], action)) {
          Serial.printf("[SegStorage] Bank %c (v5) rejected: invalid LOW action in %s\n", bank, key);
          return false;
        }
        segment.rule.lowActions[segment.rule.lowActionCount++] = action;
      }
      for (uint8_t r = 0; r < record.analogRangeCount; ++r) {
        AnalogRangeRule rr;
        if (!copyRangeFromStorage(record.analogRanges[r], maxAdcVal, rr)) {
          Serial.printf("[SegStorage] Bank %c (v5) rejected: invalid analog range rule in %s\n", bank, key);
          return false;
        }
        segment.rule.analogRanges[segment.rule.analogRangeCount++] = rr;
      }

      if (segment.rule.highActionCount == 0 && segment.rule.lowActionCount == 0 && segment.rule.analogRangeCount == 0) {
        segment.rule.active = false;
      }
      ++out.count;
      continue;
    }

    // V6 / V7 compact variable-length record
    const bool isV6 = (version == STORAGE_VERSION_V6);
    const size_t maxBlob = isV6 ? MAX_V6_BLOB_SIZE : MAX_V7_BLOB_SIZE;
    const size_t blobLen = prefs.getBytesLength(key);
    if (blobLen < sizeof(StoredSegmentHeaderV6) || blobLen > maxBlob) {
      Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid blob size %u for %s\n", bank,
                    static_cast<unsigned int>(version), static_cast<unsigned int>(blobLen), key);
      return false;
    }

    memset(recordBuf.v7Buf, 0, blobLen);
    if (prefs.getBytes(key, recordBuf.v7Buf, blobLen) != blobLen) {
      Serial.printf("[SegStorage] Bank %c (v%u) rejected: failed reading %s\n", bank,
                    static_cast<unsigned int>(version), key);
      return false;
    }

    StoredSegmentHeaderV6 hdr{};
    memcpy(&hdr, recordBuf.v7Buf, sizeof(hdr));

    const uint8_t maxActionsPerSide = isV6 ? 4U : MAX_RULE_ACTIONS_PER_SIDE;
    const size_t expectedV6Len = sizeof(StoredSegmentHeaderV6) +
                                 (static_cast<size_t>(hdr.highActionCount) * sizeof(StoredRuleAction)) +
                                 (static_cast<size_t>(hdr.lowActionCount) * sizeof(StoredRuleAction)) +
                                 (static_cast<size_t>(hdr.analogRangeCount) * sizeof(StoredAnalogRangeRule));

    const bool isVirtual = (hdr.flags & 0x01U) != 0U;
    const bool ruleActive = (hdr.flags & 0x02U) != 0U;
    const bool idTerminated = memchr(hdr.id, '\0', sizeof(hdr.id)) != nullptr;
    const bool typeTerminated = memchr(hdr.type, '\0', sizeof(hdr.type)) != nullptr;
    const uint16_t maxAdcVal = (hdr.adcResolution >= MIN_ADC_RESOLUTION && hdr.adcResolution <= MAX_ADC_RESOLUTION)
                                   ? static_cast<uint16_t>((1UL << hdr.adcResolution) - 1UL)
                                   : MAX_ANALOG_INPUT_VALUE;

    const bool pinValid = isVirtual ? isVirtualPin(hdr.pin) : isLocalGpioPin(hdr.pin);
    const bool bindingValid = isVirtual ? (isValidAuxNodeId(hdr.nodeId) && isValidAuxRemotePin(hdr.remotePin))
                                        : (hdr.nodeId == AUX_NODE_ID_LOCAL);

    if ((isV6 && blobLen != expectedV6Len) || !idTerminated || !typeTerminated || hdr.id[0] == '\0' ||
        hdr.type[0] == '\0' || !pinValid || !bindingValid || hdr.pwmResolution < MIN_PWM_RESOLUTION ||
        hdr.pwmResolution > MAX_PWM_RESOLUTION || hdr.pwmFrequency < MIN_PWM_FREQUENCY ||
        hdr.pwmFrequency > MAX_PWM_FREQUENCY || hdr.adcResolution < MIN_ADC_RESOLUTION ||
        hdr.adcResolution > MAX_ADC_RESOLUTION || hdr.adcSampleIntervalMs < MIN_ADC_SAMPLE_INTERVAL_MS ||
        hdr.adcSampleIntervalMs > MAX_ADC_SAMPLE_INTERVAL_MS || hdr.adcDeltaThreshold < MIN_ADC_DELTA_THRESHOLD ||
        hdr.adcDeltaThreshold > maxAdcVal || hdr.adcHighThreshold > maxAdcVal ||
        hdr.adcLowThreshold > hdr.adcHighThreshold || hdr.highActionCount > maxActionsPerSide ||
        hdr.lowActionCount > maxActionsPerSide || hdr.analogRangeCount > MAX_ANALOG_RANGE_RULES) {
      Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid segment record %s\n", bank,
                    static_cast<unsigned int>(version), key);
      return false;
    }

    for (int previous = 0; previous < out.count; ++previous) {
      if (out.segments[previous].pin == hdr.pin || strcmp(out.segments[previous].id, hdr.id) == 0) {
        Serial.printf("[SegStorage] Bank %c (v%u) rejected: duplicate ID or pin in %s\n", bank,
                      static_cast<unsigned int>(version), key);
        return false;
      }
      if (isVirtual && out.segments[previous].isVirtual && out.segments[previous].nodeId == hdr.nodeId &&
          out.segments[previous].remotePin == hdr.remotePin) {
        Serial.printf("[SegStorage] Bank %c (v%u) rejected: duplicate remote binding in %s\n", bank,
                      static_cast<unsigned int>(version), key);
        return false;
      }
    }

    SegmentConfig& segment = out.segments[out.count];
    segment.reset();
    strlcpy(segment.id, hdr.id, sizeof(segment.id));
    strlcpy(segment.type, hdr.type, sizeof(segment.type));
    segment.pin = hdr.pin;
    segment.autoOffDelay = hdr.autoOffDelay;
    segment.pwmResolution = hdr.pwmResolution;
    segment.pwmFrequency = hdr.pwmFrequency;
    segment.adcResolution = hdr.adcResolution;
    segment.adcSampleIntervalMs = hdr.adcSampleIntervalMs;
    segment.adcDeltaThreshold = hdr.adcDeltaThreshold;
    segment.adcHighThreshold = hdr.adcHighThreshold;
    segment.adcLowThreshold = hdr.adcLowThreshold;
    segment.isVirtual = isVirtual;
    segment.nodeId = isVirtual ? hdr.nodeId : AUX_NODE_ID_LOCAL;
    segment.remotePin = isVirtual ? hdr.remotePin : REMOTE_PIN_UNSET;
    segment.valid = true;
    segment.rule.active = ruleActive;

    size_t offset = sizeof(StoredSegmentHeaderV6);
    for (int a = 0; a < hdr.highActionCount; ++a) {
      if (offset + sizeof(StoredRuleAction) + (isV6 ? 0U : 1U) > blobLen) return false;
      StoredRuleAction rawAction{};
      memcpy(&rawAction, recordBuf.v7Buf + offset, sizeof(rawAction));
      offset += sizeof(rawAction);
      RuleAction action;
      if (!copyActionFromStorage(rawAction, action)) {
        Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid HIGH action in %s\n", bank,
                      static_cast<unsigned int>(version), key);
        return false;
      }
      if (!isV6) {
        const uint8_t condMeta = recordBuf.v7Buf[offset++];
        if (!readConditionsFromBlob(recordBuf.v7Buf, blobLen, offset, condMeta, action.conditions,
                                    action.conditionCount, action.conditionLogic)) {
          Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid HIGH conditions in %s\n", bank,
                        static_cast<unsigned int>(version), key);
          return false;
        }
      }
      segment.rule.highActions[segment.rule.highActionCount++] = action;
    }
    for (int a = 0; a < hdr.lowActionCount; ++a) {
      if (offset + sizeof(StoredRuleAction) + (isV6 ? 0U : 1U) > blobLen) return false;
      StoredRuleAction rawAction{};
      memcpy(&rawAction, recordBuf.v7Buf + offset, sizeof(rawAction));
      offset += sizeof(rawAction);
      RuleAction action;
      if (!copyActionFromStorage(rawAction, action)) {
        Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid LOW action in %s\n", bank,
                      static_cast<unsigned int>(version), key);
        return false;
      }
      if (!isV6) {
        const uint8_t condMeta = recordBuf.v7Buf[offset++];
        if (!readConditionsFromBlob(recordBuf.v7Buf, blobLen, offset, condMeta, action.conditions,
                                    action.conditionCount, action.conditionLogic)) {
          Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid LOW conditions in %s\n", bank,
                        static_cast<unsigned int>(version), key);
          return false;
        }
      }
      segment.rule.lowActions[segment.rule.lowActionCount++] = action;
    }
    for (uint8_t r = 0; r < hdr.analogRangeCount; ++r) {
      if (offset + sizeof(StoredAnalogRangeRule) > blobLen) return false;
      StoredAnalogRangeRule rawRange{};
      memcpy(&rawRange, recordBuf.v7Buf + offset, sizeof(rawRange));
      offset += sizeof(rawRange);
      AnalogRangeRule rr;
      if (!copyRangeFromStorage(rawRange, maxAdcVal, rr)) {
        Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid analog range rule in %s\n", bank,
                      static_cast<unsigned int>(version), key);
        return false;
      }
      if (!isV6 && !readConditionsFromBlob(recordBuf.v7Buf, blobLen, offset, rawRange.reserved, rr.conditions,
                                           rr.conditionCount, rr.conditionLogic)) {
        Serial.printf("[SegStorage] Bank %c (v%u) rejected: invalid range conditions in %s\n", bank,
                      static_cast<unsigned int>(version), key);
        return false;
      }
      segment.rule.analogRanges[segment.rule.analogRangeCount++] = rr;
    }
    if (!isV6 && offset != blobLen) {
      Serial.printf("[SegStorage] Bank %c (v7) rejected: trailing bytes in %s\n", bank, key);
      return false;
    }

    if (segment.rule.highActionCount == 0 && segment.rule.lowActionCount == 0 && segment.rule.analogRangeCount == 0) {
      segment.rule.active = false;
    }
    ++out.count;
  }

  out.success = true;
  out.segmentsProvided = true;
  return true;
}

bool loadLegacyConfig(Preferences& prefs, ParseResult& out) {
  const int count = prefs.getInt("count", 0);
  if (count <= 0 || count > MAX_SEGMENTS) return false;

  char key[16];
  for (int i = 0; i < MAX_SEGMENTS; ++i) {
    out.segments[i].reset();
  }
  out.count = 0;
  for (int i = 0; i < count; ++i) {
    snprintf(key, sizeof(key), "s%did", i);
    String id = prefs.getString(key, "");
    snprintf(key, sizeof(key), "s%dtp", i);
    String type = prefs.getString(key, "");
    snprintf(key, sizeof(key), "s%dpn", i);
    const int pin = prefs.getInt(key, -1);
    snprintf(key, sizeof(key), "s%dao", i);
    const int autoOff = prefs.getInt(key, 0);

    if (id.length() == 0 || id.length() >= sizeof(out.segments[0].id) || type.length() == 0 ||
        type.length() >= sizeof(out.segments[0].type) || !isLocalGpioPin(pin) || out.count >= MAX_SEGMENTS) {
      Serial.printf("[SegStorage] Invalid legacy segment at index %d\n", i);
      return false;
    }

    for (int previous = 0; previous < out.count; ++previous) {
      if (out.segments[previous].pin == pin || strcmp(out.segments[previous].id, id.c_str()) == 0) return false;
    }

    SegmentConfig& segment = out.segments[out.count++];
    segment.reset();
    strlcpy(segment.id, id.c_str(), sizeof(segment.id));
    strlcpy(segment.type, type.c_str(), sizeof(segment.type));
    segment.pin = pin;
    segment.autoOffDelay = autoOff < 0 ? 0 : autoOff;
    segment.valid = true;
  }

  out.success = true;
  out.segmentsProvided = true;
  Serial.printf("[SegStorage] Loaded %d legacy segments; legacy format did not contain rules\n", out.count);
  return true;
}
} // namespace

/**
 * Persist the complete segment registry using two banks. The active-bank
 * pointer changes only after all records and metadata in the inactive bank exist.
 */
void NvsSegmentStorage::saveSegmentConfig(const ParseResult& parsed) {
  Preferences prefs;
  if (!prefs.begin(NVS_NAMESPACE, false)) {
    Serial.println("[SegStorage] Failed to open Segment Preferences for writing");
    return;
  }

  const String currentBank = prefs.getString("active", "");
  const char targetBank = currentBank == "a" ? 'b' : 'a';
  const char* bankName = targetBank == 'a' ? "a" : "b";
  char key[16];
  int savedCount = 0;
  bool writeOk = true;
  uint8_t blob[MAX_V7_BLOB_SIZE];

  for (int i = 0; i < MAX_SEGMENTS; ++i) {
    if (!parsed.segments[i].valid) continue;
    if (savedCount >= MAX_SEGMENTS) {
      writeOk = false;
      break;
    }

    const SegmentConfig& segment = parsed.segments[i];
    const bool isVirtual = segment.isVirtual;
    const bool pinValid = isVirtual ? isVirtualPin(segment.pin) : isLocalGpioPin(segment.pin);
    const bool bindingValid =
        !isVirtual || (isValidAuxNodeId(segment.nodeId) && isValidAuxRemotePin(segment.remotePin));

    if (segment.id[0] == '\0' || !pinValid || !bindingValid ||
        segment.rule.highActionCount > MAX_RULE_ACTIONS_PER_SIDE ||
        segment.rule.lowActionCount > MAX_RULE_ACTIONS_PER_SIDE ||
        segment.rule.analogRangeCount > MAX_ANALOG_RANGE_RULES) {
      writeOk = false;
      Serial.printf("[SegStorage] Refusing invalid segment at slot %d\n", i);
      break;
    }

    StoredSegmentHeaderV6 hdr{};
    strlcpy(hdr.id, segment.id, sizeof(hdr.id));
    strlcpy(hdr.type, segment.type, sizeof(hdr.type));
    hdr.pin = static_cast<int16_t>(segment.pin);
    hdr.autoOffDelay = static_cast<uint16_t>(segment.autoOffDelay < 0 ? 0 : segment.autoOffDelay);

    const uint8_t res =
        (segment.pwmResolution < MIN_PWM_RESOLUTION)
            ? MIN_PWM_RESOLUTION
            : ((segment.pwmResolution > MAX_PWM_RESOLUTION) ? MAX_PWM_RESOLUTION : segment.pwmResolution);
    const uint16_t freq = (segment.pwmFrequency < MIN_PWM_FREQUENCY)
                              ? MIN_PWM_FREQUENCY
                              : ((segment.pwmFrequency > MAX_PWM_FREQUENCY) ? MAX_PWM_FREQUENCY : segment.pwmFrequency);
    hdr.pwmResolution = res;
    hdr.pwmFrequency = freq;

    const uint8_t adcRes =
        (segment.adcResolution < MIN_ADC_RESOLUTION)
            ? MIN_ADC_RESOLUTION
            : ((segment.adcResolution > MAX_ADC_RESOLUTION) ? MAX_ADC_RESOLUTION : segment.adcResolution);
    const uint16_t maxAdcVal = static_cast<uint16_t>((1UL << adcRes) - 1UL);
    const uint16_t adcSint =
        (segment.adcSampleIntervalMs < MIN_ADC_SAMPLE_INTERVAL_MS)
            ? MIN_ADC_SAMPLE_INTERVAL_MS
            : ((segment.adcSampleIntervalMs > MAX_ADC_SAMPLE_INTERVAL_MS) ? MAX_ADC_SAMPLE_INTERVAL_MS
                                                                          : segment.adcSampleIntervalMs);
    const uint16_t adcDelta = (segment.adcDeltaThreshold < MIN_ADC_DELTA_THRESHOLD)
                                  ? MIN_ADC_DELTA_THRESHOLD
                                  : ((segment.adcDeltaThreshold > maxAdcVal) ? maxAdcVal : segment.adcDeltaThreshold);
    const uint16_t adcAth = (segment.adcHighThreshold > maxAdcVal) ? maxAdcVal : segment.adcHighThreshold;
    const uint16_t adcAtl = (adcAth == 0) ? 0 : ((segment.adcLowThreshold > adcAth) ? adcAth : segment.adcLowThreshold);

    hdr.adcResolution = adcRes;
    hdr.adcSampleIntervalMs = adcSint;
    hdr.adcDeltaThreshold = adcDelta;
    hdr.adcHighThreshold = adcAth;
    hdr.adcLowThreshold = adcAtl;

    hdr.flags = static_cast<uint8_t>((isVirtual ? 0x01U : 0x00U) | (segment.rule.active ? 0x02U : 0x00U));
    hdr.nodeId = isVirtual ? segment.nodeId : AUX_NODE_ID_LOCAL;
    hdr.remotePin = isVirtual ? segment.remotePin : REMOTE_PIN_UNSET;
    hdr.highActionCount = static_cast<uint8_t>(segment.rule.highActionCount);
    hdr.lowActionCount = static_cast<uint8_t>(segment.rule.lowActionCount);
    hdr.analogRangeCount = segment.rule.analogRangeCount;

    size_t offset = 0;
    memcpy(blob + offset, &hdr, sizeof(hdr));
    offset += sizeof(hdr);

    for (int a = 0; a < hdr.highActionCount; ++a) {
      const RuleAction& srcAct = segment.rule.highActions[a];
      StoredRuleAction act{};
      copyActionToStorage(srcAct, act);
      memcpy(blob + offset, &act, sizeof(act));
      offset += sizeof(act);
      blob[offset++] = encodeConditionMeta(srcAct.conditionCount, srcAct.conditionLogic);
      offset = writeConditionsToBlob(srcAct.conditions, srcAct.conditionCount, blob, offset);
    }
    for (int a = 0; a < hdr.lowActionCount; ++a) {
      const RuleAction& srcAct = segment.rule.lowActions[a];
      StoredRuleAction act{};
      copyActionToStorage(srcAct, act);
      memcpy(blob + offset, &act, sizeof(act));
      offset += sizeof(act);
      blob[offset++] = encodeConditionMeta(srcAct.conditionCount, srcAct.conditionLogic);
      offset = writeConditionsToBlob(srcAct.conditions, srcAct.conditionCount, blob, offset);
    }
    for (uint8_t r = 0; r < hdr.analogRangeCount; ++r) {
      const AnalogRangeRule& srcRange = segment.rule.analogRanges[r];
      StoredAnalogRangeRule rr{};
      copyRangeToStorage(srcRange, maxAdcVal, rr);
      rr.reserved = encodeConditionMeta(srcRange.conditionCount, srcRange.conditionLogic);
      memcpy(blob + offset, &rr, sizeof(rr));
      offset += sizeof(rr);
      offset = writeConditionsToBlob(srcRange.conditions, srcRange.conditionCount, blob, offset);
    }

    snprintf(key, sizeof(key), "%c%d", targetBank, savedCount);
    if (prefs.putBytes(key, blob, offset) != offset) {
      writeOk = false;
      Serial.printf("[SegStorage] Failed writing record %s\n", key);
      break;
    }
    ++savedCount;
  }

  if (writeOk) {
    char countKey[8];
    char versionKey[8];
    snprintf(countKey, sizeof(countKey), "%cCount", targetBank);
    snprintf(versionKey, sizeof(versionKey), "%cVer", targetBank);
    const int previousBankCount = prefs.getInt(countKey, 0);
    const int cleanupLimit =
        (previousBankCount > savedCount && previousBankCount <= MAX_SEGMENTS) ? previousBankCount : savedCount;
    for (int i = savedCount; i < cleanupLimit; ++i) {
      snprintf(key, sizeof(key), "%c%d", targetBank, i);
      prefs.remove(key);
    }

    writeOk = prefs.putInt(countKey, savedCount) == sizeof(int) &&
              prefs.putUChar(versionKey, STORAGE_VERSION) == sizeof(uint8_t);
  }

  if (writeOk) {
    // Commit point: a failed write leaves the previous active bank untouched.
    writeOk = prefs.putString("active", bankName) > 0;
  }

  prefs.end();
  if (writeOk) {
    Serial.printf("[SegStorage] Saved %d segments (v7) to NVS bank %c\n", savedCount, targetBank);
  } else {
    Serial.println("[SegStorage] Save failed; previous active NVS bank was preserved");
  }
}

/**
 * Load the active bank as an all-or-nothing snapshot. If it is damaged, try
 * the previous bank before considering the legacy flat-key format. A valid
 * zero-record bank is an intentional empty configuration, not a cache miss.
 */
bool NvsSegmentStorage::loadSegmentConfig(ParseResult& out) {
  out.reset();
  Preferences prefs;
  if (!prefs.begin(NVS_NAMESPACE, true)) {
    Serial.println("[SegStorage] No segment config in NVS");
    return false;
  }

  const String activeBank = prefs.getString("active", "");
  if (activeBank == "a" || activeBank == "b") {
    const char active = activeBank[0];
    const char backup = active == 'a' ? 'b' : 'a';

    if (loadBank(prefs, active, out)) {
      prefs.end();
      Serial.printf("[SegStorage] Loaded %d segments with rules from active NVS bank %c\n", out.count, active);
      return true;
    }

    Serial.printf("[SegStorage] Active bank %c is invalid; checking backup bank %c\n", active, backup);
    if (loadBank(prefs, backup, out)) {
      prefs.end();
      Serial.printf("[SegStorage] Recovered %d segments with rules from backup NVS bank %c\n", out.count, backup);
      return true;
    }

    prefs.end();
    out.reset();
    Serial.println("[SegStorage] Both versioned NVS banks are invalid; refusing stale legacy fallback");
    return false;
  }

  // Backward compatibility only when no versioned bank has ever been activated.
  const bool legacyLoaded = loadLegacyConfig(prefs, out);
  prefs.end();
  return legacyLoaded;
}

} // namespace uniuno
