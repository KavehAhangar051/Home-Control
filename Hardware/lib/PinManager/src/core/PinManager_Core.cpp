#include "../PinManager.h"
#include <Utilities/logging.h>
#include <Optimization/StaticString.h>
#include <cstdio>

PinManager::PinManager() : _registry(), _timerManager(_registry), _stateManager(_registry) {
}

PinManager::~PinManager() {
    // No dynamic memory to clean up anymore!
}

int PinManager::getActiveCount() const {
    int count = 0;
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (entry->active) count++;
    }
    return count;
}

void PinManager::printStatus() const {
    Serial.println("========= Pin Manager Status =========");
    Serial.printf("  Active pins: %d / %d\n", getActiveCount(), MAX_PINS);
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry->active) continue;
        bool st;
        if (entry->type == SegmentType::Input) {
            st = digitalRead(entry->pinNumber) == HIGH;
        } else {
            st = entry->hasGpio ? entry->gpio.getState() : false;
        }
        Serial.printf("  [%d] id=%s  type=%s pin=%d  state=%s  autoOff=%ds\n",
            i, entry->segmentId, (entry->type == SegmentType::Input ? "input" : "output"),
            entry->pinNumber, st ? "ON" : "OFF", entry->autoOffDelay);
    }
    Serial.println("======================================");
}

String PinManager::exportStateJson() const {
    // At most 16 configured pins; include both input and output levels for reconnect reconciliation.
    uniuno::StaticString<256> json("{\"type\":\"state_sync\",\"states\":{");
    bool first = true;

    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (entry->active) {
            if (!first) json += ",";
            char pinText[4];
            snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
            json += "\"";
            json += pinText;
            json += "\":";

            // Reconcile both output and input GPIO levels after a WebSocket reconnect.
            const bool state = (entry->type == SegmentType::Input)
                ? (digitalRead(entry->pinNumber) == HIGH)
                : (entry->hasGpio && entry->gpio.getState());
            json += state ? "true" : "false";
            first = false;
        }
    }

    json += "}}";
    return String(json.c_str());
}
