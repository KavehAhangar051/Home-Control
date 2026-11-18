#include "../PinManager.h"
#include <Utilities/logging.h>
#include <Optimization/StaticString.h>
#include <Timer/Timer.h>
#include <cstdio>
#include <cstring>

PinManager::PinManager() : _registry(), _timerManager(_registry), _stateManager(_registry) {
}

PinManager::~PinManager() {
}

unsigned long PinManager::getAutoOffRemainingMsByPin(int pin) const {
    const uniuno::TimerHandle timer = _timerManager.getTimerIdByPin(pin);
    return timer.getRemainingMs();
}

int PinManager::getActiveCount() const {
    return _registry.getActiveCount();
}

void PinManager::exportConfig(ParseResult& out) const {
    out = ParseResult();
    out.success = true;
    out.segmentsProvided = true;

    int target = 0;
    for (int i = 0; i < MAX_PINS && target < MAX_SEGMENTS; ++i) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active) continue;

        SegmentConfig& segment = out.segments[target++];
        strncpy(segment.id, entry->segmentId, sizeof(segment.id) - 1);
        segment.id[sizeof(segment.id) - 1] = '\0';
        const char* type = entry->type == SegmentType::Input ? "input" : "gpio_toggle";
        strncpy(segment.type, type, sizeof(segment.type) - 1);
        segment.type[sizeof(segment.type) - 1] = '\0';
        segment.pin = entry->pinNumber;
        segment.autoOffDelay = entry->autoOffDelay;
        segment.value = false;
        segment.rule = entry->rule;
        segment.valid = true;
    }
    out.count = target;
}

void PinManager::printStatus() const {
    Serial.println("========= Pin Manager Status =========");
    Serial.printf("  Active pins: %d / %d\n", getActiveCount(), MAX_PINS);
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active) continue;
        const bool state = (entry->type == SegmentType::Input)
            ? entry->lastInputState
            : (entry->hasGpio ? entry->gpio.getState() : false);
        Serial.printf("  [%d] id=%s type=%s pin=%d state=%s autoOff=%ds rule=%s (high=%d low=%d)\n",
            i, entry->segmentId, entry->type == SegmentType::Input ? "input" : "output",
            entry->pinNumber, state ? "HIGH/ON" : "LOW/OFF", entry->autoOffDelay,
            entry->rule.active ? "active" : "inactive",
            entry->rule.highActionCount, entry->rule.lowActionCount);
    }
    Serial.println("======================================");
}

String PinManager::exportStateJson() const {
    uniuno::StaticString<768> json("{\"type\":\"state_sync\",\"states\":{");
    bool pinStates[MAX_PINS] = {};
    bool first = true;

    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (entry && entry->active) {
            if (!first) json += ",";
            char pinText[6];
            snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
            json += "\"";
            json += pinText;
            json += "\":";

            const bool state = (entry->type == SegmentType::Input)
                ? entry->lastInputState
                : (entry->hasGpio && entry->gpio.getState());
            json += state ? "true" : "false";
            pinStates[i] = state;
            first = false;
        }
    }

    json += "},\"timers\":{";
    first = true;
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active || entry->type != SegmentType::Output) continue;

        const unsigned long remainingMs = pinStates[i]
            ? getAutoOffRemainingMsByPin(entry->pinNumber)
            : 0UL;
        if (!first) json += ",";
        char pinText[6];
        char remainingText[12];
        snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
        snprintf(remainingText, sizeof(remainingText), "%lu", (remainingMs + 999UL) / 1000UL);
        json += "\"";
        json += pinText;
        json += "\":";
        json += remainingText;
        first = false;
    }
    json += "}}";
    return String(json.c_str());
}
