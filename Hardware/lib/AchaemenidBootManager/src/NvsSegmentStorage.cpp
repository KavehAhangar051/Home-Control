#include "NvsSegmentStorage.h"
#include <Arduino.h>
#include <cstdio>
#include <cstring>

namespace uniuno {
namespace {
static constexpr uint8_t STORAGE_VERSION_V2 = 2;
static constexpr uint8_t STORAGE_VERSION = 3;
static constexpr char NVS_NAMESPACE[] = "AchaemenidSeg";

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
struct StoredSegment {
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
#pragma pack(pop)

static_assert(sizeof(StoredRuleActionV2) == 11, "Unexpected stored RuleActionV2 layout");
static_assert(sizeof(StoredRuleAction) == 13, "Unexpected stored RuleAction layout");

void copyActionToStorage(const RuleAction& source, StoredRuleAction& target) {
    target.requiredHoldTime = source.requiredHoldTime;
    target.targetPin = static_cast<int8_t>(source.targetPin);
    target.actionState = source.actionState ? 1 : 0;
    target.actionType = static_cast<uint8_t>(source.actionType);
    target.delay = source.delay;
    target.targetValue = source.targetValue;
}

bool copyActionFromStorageV2(const StoredRuleActionV2& source, RuleAction& target) {
    if (source.targetPin < 0 || source.targetPin > 39 ||
        source.actionState > 1 ||
        source.actionType > ACTION_FOR_DURATION ||
        source.delay < 0 || source.delay > 60) return false;
    if (source.requiredHoldTime != 0 && source.requiredHoldTime != 3 &&
        source.requiredHoldTime != 5 && source.requiredHoldTime != 10) return false;

    target.requiredHoldTime = source.requiredHoldTime;
    target.targetPin = source.targetPin;
    target.actionState = source.actionState != 0;
    target.actionType = static_cast<RuleActionType>(source.actionType);
    target.delay = source.delay;
    target.targetValue = RULE_ANALOG_VALUE_UNSET;
    return true;
}

bool copyActionFromStorage(const StoredRuleAction& source, RuleAction& target) {
    if (source.targetPin < 0 || source.targetPin > 39 ||
        source.actionState > 1 ||
        source.actionType > ACTION_FOR_DURATION ||
        source.delay < 0 || source.delay > 60) return false;
    if (source.requiredHoldTime != 0 && source.requiredHoldTime != 3 &&
        source.requiredHoldTime != 5 && source.requiredHoldTime != 10) return false;
    if (source.targetValue != RULE_ANALOG_VALUE_UNSET &&
        (source.targetValue < 0 || source.targetValue > MAX_ANALOG_OUTPUT_VALUE)) return false;

    target.requiredHoldTime = source.requiredHoldTime;
    target.targetPin = source.targetPin;
    target.actionState = source.actionState != 0;
    target.actionType = static_cast<RuleActionType>(source.actionType);
    target.delay = source.delay;
    target.targetValue = source.targetValue;
    return true;
}

bool loadBank(Preferences& prefs, char bank, ParseResult& out) {
    out = ParseResult();

    char countKey[8];
    char versionKey[8];
    snprintf(countKey, sizeof(countKey), "%cCount", bank);
    snprintf(versionKey, sizeof(versionKey), "%cVer", bank);

    const int count = prefs.getInt(countKey, -1);
    const uint8_t version = prefs.getUChar(versionKey, 0);
    if ((version != STORAGE_VERSION && version != STORAGE_VERSION_V2) ||
        count < 0 || count > MAX_SEGMENTS) {
        return false;
    }

    char key[16];
    for (int i = 0; i < count; ++i) {
        snprintf(key, sizeof(key), "%c%d", bank, i);

        if (version == STORAGE_VERSION_V2) {
            if (prefs.getBytesLength(key) != sizeof(StoredSegmentV2)) {
                Serial.printf("[SegStorage] Bank %c (v2) rejected: invalid record size for %s\n", bank, key);
                return false;
            }

            StoredSegmentV2 record{};
            if (prefs.getBytes(key, &record, sizeof(record)) != sizeof(record)) {
                Serial.printf("[SegStorage] Bank %c (v2) rejected: failed reading %s\n", bank, key);
                return false;
            }

            const bool idTerminated = memchr(record.id, '\0', sizeof(record.id)) != nullptr;
            const bool typeTerminated = memchr(record.type, '\0', sizeof(record.type)) != nullptr;
            if (!idTerminated || !typeTerminated || record.id[0] == '\0' ||
                record.type[0] == '\0' || record.pin < 0 || record.pin > 39 ||
                record.highActionCount > 4 || record.lowActionCount > 4 ||
                record.ruleActive > 1) {
                Serial.printf("[SegStorage] Bank %c (v2) rejected: invalid segment record %s\n", bank, key);
                return false;
            }

            for (int previous = 0; previous < out.count; ++previous) {
                if (out.segments[previous].pin == record.pin ||
                    strcmp(out.segments[previous].id, record.id) == 0) {
                    Serial.printf("[SegStorage] Bank %c (v2) rejected: duplicate ID or GPIO in %s\n", bank, key);
                    return false;
                }
            }

            SegmentConfig& segment = out.segments[out.count];
            strlcpy(segment.id, record.id, sizeof(segment.id));
            strlcpy(segment.type, record.type, sizeof(segment.type));
            segment.pin = record.pin;
            segment.autoOffDelay = record.autoOffDelay;
            segment.pwmResolution = DEFAULT_PWM_RESOLUTION;
            segment.pwmFrequency = DEFAULT_PWM_FREQUENCY;
            segment.analogValue = 0;
            segment.value = false;
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

        if (prefs.getBytesLength(key) != sizeof(StoredSegment)) {
            Serial.printf("[SegStorage] Bank %c rejected: invalid record size for %s\n", bank, key);
            return false;
        }

        StoredSegment record{};
        if (prefs.getBytes(key, &record, sizeof(record)) != sizeof(record)) {
            Serial.printf("[SegStorage] Bank %c rejected: failed reading %s\n", bank, key);
            return false;
        }

        const bool idTerminated = memchr(record.id, '\0', sizeof(record.id)) != nullptr;
        const bool typeTerminated = memchr(record.type, '\0', sizeof(record.type)) != nullptr;
        if (!idTerminated || !typeTerminated || record.id[0] == '\0' ||
            record.type[0] == '\0' || record.pin < 0 || record.pin > 39 ||
            record.pwmResolution < MIN_PWM_RESOLUTION || record.pwmResolution > MAX_PWM_RESOLUTION ||
            record.pwmFrequency < MIN_PWM_FREQUENCY || record.pwmFrequency > MAX_PWM_FREQUENCY ||
            record.highActionCount > 4 || record.lowActionCount > 4 ||
            record.ruleActive > 1) {
            Serial.printf("[SegStorage] Bank %c rejected: invalid segment record %s\n", bank, key);
            return false;
        }

        // A pin and segment ID must each identify exactly one registry entry.
        for (int previous = 0; previous < out.count; ++previous) {
            if (out.segments[previous].pin == record.pin ||
                strcmp(out.segments[previous].id, record.id) == 0) {
                Serial.printf("[SegStorage] Bank %c rejected: duplicate ID or GPIO in %s\n", bank, key);
                return false;
            }
        }

        SegmentConfig& segment = out.segments[out.count];
        strlcpy(segment.id, record.id, sizeof(segment.id));
        strlcpy(segment.type, record.type, sizeof(segment.type));
        segment.pin = record.pin;
        segment.autoOffDelay = record.autoOffDelay;
        segment.pwmResolution = record.pwmResolution;
        segment.pwmFrequency = record.pwmFrequency;
        segment.analogValue = 0;
        segment.value = false;
        segment.valid = true;
        segment.rule.active = record.ruleActive != 0;

        for (int a = 0; a < record.highActionCount; ++a) {
            RuleAction action;
            if (!copyActionFromStorage(record.highActions[a], action)) {
                Serial.printf("[SegStorage] Bank %c rejected: invalid HIGH action in %s\n", bank, key);
                return false;
            }
            segment.rule.highActions[segment.rule.highActionCount++] = action;
        }
        for (int a = 0; a < record.lowActionCount; ++a) {
            RuleAction action;
            if (!copyActionFromStorage(record.lowActions[a], action)) {
                Serial.printf("[SegStorage] Bank %c rejected: invalid LOW action in %s\n", bank, key);
                return false;
            }
            segment.rule.lowActions[segment.rule.lowActionCount++] = action;
        }

        if (segment.rule.highActionCount == 0 && segment.rule.lowActionCount == 0) {
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
    out = ParseResult();
    for (int i = 0; i < count; ++i) {
        snprintf(key, sizeof(key), "s%did", i);
        String id = prefs.getString(key, "");
        snprintf(key, sizeof(key), "s%dtp", i);
        String type = prefs.getString(key, "");
        snprintf(key, sizeof(key), "s%dpn", i);
        const int pin = prefs.getInt(key, -1);
        snprintf(key, sizeof(key), "s%dao", i);
        const int autoOff = prefs.getInt(key, 0);

        if (id.length() == 0 || id.length() >= sizeof(out.segments[0].id) ||
            type.length() == 0 || type.length() >= sizeof(out.segments[0].type) ||
            pin < 0 || pin > 39 || out.count >= MAX_SEGMENTS) {
            Serial.printf("[SegStorage] Invalid legacy segment at index %d\n", i);
            return false;
        }

        for (int previous = 0; previous < out.count; ++previous) {
            if (out.segments[previous].pin == pin ||
                strcmp(out.segments[previous].id, id.c_str()) == 0) return false;
        }

        SegmentConfig& segment = out.segments[out.count++];
        strlcpy(segment.id, id.c_str(), sizeof(segment.id));
        strlcpy(segment.type, type.c_str(), sizeof(segment.type));
        segment.pin = pin;
        segment.autoOffDelay = autoOff < 0 ? 0 : autoOff;
        segment.pwmResolution = DEFAULT_PWM_RESOLUTION;
        segment.pwmFrequency = DEFAULT_PWM_FREQUENCY;
        segment.analogValue = 0;
        segment.value = false;
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

    for (int i = 0; i < MAX_SEGMENTS; ++i) {
        if (!parsed.segments[i].valid) continue;
        if (savedCount >= MAX_SEGMENTS) {
            writeOk = false;
            break;
        }

        const SegmentConfig& segment = parsed.segments[i];
        if (segment.id[0] == '\0' || segment.pin < 0 || segment.pin > 39 ||
            segment.rule.highActionCount > 4 || segment.rule.lowActionCount > 4) {
            writeOk = false;
            Serial.printf("[SegStorage] Refusing invalid segment at slot %d\n", i);
            break;
        }

        StoredSegment record{};
        strlcpy(record.id, segment.id, sizeof(record.id));
        strlcpy(record.type, segment.type, sizeof(record.type));
        record.pin = static_cast<int16_t>(segment.pin);
        record.autoOffDelay = static_cast<uint16_t>(segment.autoOffDelay < 0 ? 0 : segment.autoOffDelay);
        const uint8_t res = (segment.pwmResolution < MIN_PWM_RESOLUTION)
            ? MIN_PWM_RESOLUTION
            : ((segment.pwmResolution > MAX_PWM_RESOLUTION) ? MAX_PWM_RESOLUTION : segment.pwmResolution);
        const uint16_t freq = (segment.pwmFrequency < MIN_PWM_FREQUENCY)
            ? MIN_PWM_FREQUENCY
            : ((segment.pwmFrequency > MAX_PWM_FREQUENCY) ? MAX_PWM_FREQUENCY : segment.pwmFrequency);
        record.pwmResolution = res;
        record.pwmFrequency = freq;
        record.highActionCount = segment.rule.highActionCount;
        record.lowActionCount = segment.rule.lowActionCount;
        record.ruleActive = segment.rule.active ? 1 : 0;

        for (int a = 0; a < record.highActionCount; ++a) {
            copyActionToStorage(segment.rule.highActions[a], record.highActions[a]);
        }
        for (int a = 0; a < record.lowActionCount; ++a) {
            copyActionToStorage(segment.rule.lowActions[a], record.lowActions[a]);
        }

        snprintf(key, sizeof(key), "%c%d", targetBank, savedCount);
        if (prefs.putBytes(key, &record, sizeof(record)) != sizeof(record)) {
            writeOk = false;
            Serial.printf("[SegStorage] Failed writing record %s\n", key);
            break;
        }
        ++savedCount;
    }

    if (writeOk) {
        for (int i = savedCount; i < MAX_SEGMENTS; ++i) {
            snprintf(key, sizeof(key), "%c%d", targetBank, i);
            prefs.remove(key);
        }

        char countKey[8];
        char versionKey[8];
        snprintf(countKey, sizeof(countKey), "%cCount", targetBank);
        snprintf(versionKey, sizeof(versionKey), "%cVer", targetBank);
        writeOk = prefs.putInt(countKey, savedCount) == sizeof(int) &&
                  prefs.putUChar(versionKey, STORAGE_VERSION) == sizeof(uint8_t);
    }

    if (writeOk) {
        // Commit point: a failed write leaves the previous active bank untouched.
        writeOk = prefs.putString("active", bankName) > 0;
    }

    prefs.end();
    if (writeOk) {
        Serial.printf("[SegStorage] Saved %d segments with rules to NVS bank %c\n", savedCount, targetBank);
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
    out = ParseResult();
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
        out = ParseResult();
        Serial.println("[SegStorage] Both versioned NVS banks are invalid; refusing stale legacy fallback");
        return false;
    }

    // Backward compatibility only when no versioned bank has ever been activated.
    const bool legacyLoaded = loadLegacyConfig(prefs, out);
    prefs.end();
    return legacyLoaded;
}

} // namespace uniuno
