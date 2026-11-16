#include "../PinManager.h"
#include <Utilities/logging.h>
#include <Optimization/StaticString.h>
#include <cstdio>

PinManager::PinManager() : _registry(), _timerManager(_registry), _stateManager(_registry) {
}

PinManager::~PinManager() {
    // Zero dynamic allocations; static memory managed via PinRegistry
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
    uniuno::StaticString<384> json("{\"type\":\"state_sync\",\"states\":{");
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

            // Live state from RAM without slow GPIO hardware reads
            const bool state = (entry->type == SegmentType::Input)
                ? entry->lastInputState
                : (entry->hasGpio && entry->gpio.getState());
            json += state ? "true" : "false";
            first = false;
        }
    }

    json += "}}";
    return String(json.c_str());
}
