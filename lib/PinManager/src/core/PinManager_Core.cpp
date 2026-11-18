#include "../PinManager.h"
#include <Utilities/logging.h>
#include <Optimization/StaticString.h>
#include <Timer/Timer.h>
#include <cstdio>

PinManager::PinManager() : _registry(), _timerManager(_registry), _stateManager(_registry) {
}

PinManager::~PinManager() {
    // Zero dynamic allocations; static memory managed via PinRegistry
}

unsigned long PinManager::getAutoOffRemainingMsByPin(int pin) const {
    const uniuno::TimerHandle timer = _timerManager.getTimerIdByPin(pin);
    return timer.getRemainingMs();
}

int PinManager::getActiveCount() const {
    return _registry.getActiveCount();
}

void PinManager::printStatus() const {
    Serial.println("========= Pin Manager Status =========");
    Serial.printf("  Active pins: %d / %d\n", getActiveCount(), MAX_PINS);
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active) continue;
        const bool st = (entry->type == SegmentType::Input)
            ? entry->lastInputState
            : (entry->hasGpio ? entry->gpio.getState() : false);
        Serial.printf("  [%d] id=%s  type=%s pin=%d  state=%s  autoOff=%ds\n",
            i, entry->segmentId, (entry->type == SegmentType::Input ? "input" : "output"),
            entry->pinNumber, st ? "ON" : "OFF", entry->autoOffDelay);
    }
    Serial.println("======================================");
}

String PinManager::exportStateJson() const {
    // Static stack buffer sized safely for 16 pins
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

            // Capture each pin's state once so the state and timer sections
            // describe the same snapshot.
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

        // Reuse the state captured above so pin state and timer metadata belong
        // to the same snapshot, even if a GPIO changes during serialization.
        // TimerHandle reports the live deadline, not the originally configured delay.
        const bool isOn = pinStates[i];
        const unsigned long remainingMs = isOn
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
