#include "NvsSegmentStorage.h"
#include <Arduino.h>
#include <cstdio>

namespace uniuno {

/**
 * @brief Save segment configuration to NVS with zero dynamic heap string allocations.
 */
void NvsSegmentStorage::saveSegmentConfig(const ParseResult& parsed) {
    Preferences segPrefs;
    if (!segPrefs.begin("AchaemenidSeg", false)) {
        Serial.println("[SegStorage] Failed to open Segment Preferences");
        return;
    }

    char key[16];
    int savedCount = 0;
    for (int i = 0; i < MAX_SEGMENTS; i++) {
        if (!parsed.segments[i].valid) continue;

        snprintf(key, sizeof(key), "s%did", savedCount);
        segPrefs.putString(key, parsed.segments[i].id);

        snprintf(key, sizeof(key), "s%dtp", savedCount);
        segPrefs.putString(key, parsed.segments[i].type);

        snprintf(key, sizeof(key), "s%dpn", savedCount);
        segPrefs.putInt(key, parsed.segments[i].pin);

        snprintf(key, sizeof(key), "s%dao", savedCount);
        segPrefs.putInt(key, parsed.segments[i].autoOffDelay);

        savedCount++;
        if (savedCount >= MAX_SEGMENTS) break;
    }
    segPrefs.putInt("count", savedCount);

    segPrefs.end();
    Serial.printf("[SegStorage] Saved %d segments to NVS\n", savedCount);
}

/**
 * @brief Load segment configuration from NVS with stack-only key buffers.
 */
bool NvsSegmentStorage::loadSegmentConfig(ParseResult& out) {
    Preferences segPrefs;
    if (!segPrefs.begin("AchaemenidSeg", true)) {
        Serial.println("[SegStorage] No segment config in NVS");
        return false;
    }

    const int count = segPrefs.getInt("count", 0);
    if (count <= 0) {
        segPrefs.end();
        Serial.println("[SegStorage] NVS segment count is 0");
        return false;
    }

    char key[16];
    out.count = 0;
    for (int i = 0; i < count && i < MAX_SEGMENTS; i++) {
        snprintf(key, sizeof(key), "s%did", i);
        String id = segPrefs.getString(key, "");

        snprintf(key, sizeof(key), "s%dtp", i);
        String type = segPrefs.getString(key, "");

        snprintf(key, sizeof(key), "s%dpn", i);
        const int pin = segPrefs.getInt(key, -1);

        snprintf(key, sizeof(key), "s%dao", i);
        const int ao = segPrefs.getInt(key, 0);

        if (id.length() > 0 && pin >= 0) {
            strncpy(out.segments[i].id, id.c_str(), sizeof(out.segments[i].id) - 1);
            out.segments[i].id[sizeof(out.segments[i].id) - 1] = '\0';
            strncpy(out.segments[i].type, type.c_str(), sizeof(out.segments[i].type) - 1);
            out.segments[i].type[sizeof(out.segments[i].type) - 1] = '\0';
            out.segments[i].pin = pin;
            out.segments[i].autoOffDelay = ao;
            out.segments[i].value = false;
            out.segments[i].valid = true;
            out.count++;
        }
    }

    segPrefs.end();
    out.success = (out.count > 0);
    Serial.printf("[SegStorage] Loaded %d segments from NVS (offline fallback)\n", out.count);
    return out.success;
}

} // namespace uniuno
