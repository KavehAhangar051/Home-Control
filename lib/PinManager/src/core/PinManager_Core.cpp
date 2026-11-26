#include "../PinManager.h"
#include <AuxNodeManager.h>
#include <Utilities/logging.h>
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
    out.reset();
    out.success = true;
    out.segmentsProvided = true;

    int target = 0;
    for (int i = 0; i < MAX_PINS && target < MAX_SEGMENTS; ++i) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active) continue;

        SegmentConfig& segment = out.segments[target++];
        strncpy(segment.id, entry->segmentId, sizeof(segment.id) - 1);
        segment.id[sizeof(segment.id) - 1] = '\0';
        const char* type = segmentTypeToString(entry->type);
        strncpy(segment.type, type, sizeof(segment.type) - 1);
        segment.type[sizeof(segment.type) - 1] = '\0';
        segment.pin = entry->pinNumber;
        segment.autoOffDelay = entry->autoOffDelay;
        segment.value = false;
        segment.analogValue = 0;
        segment.isVirtual = entry->isVirtual;
        segment.nodeId = entry->isVirtual ? entry->nodeId : AUX_NODE_ID_LOCAL;
        segment.remotePin = entry->isVirtual ? entry->remotePin : REMOTE_PIN_UNSET;

        if (entry->type == SegmentType::AnalogOutput) {
            if (entry->isVirtual) {
                segment.pwmResolution = entry->virtualPwmResolution;
                segment.pwmFrequency = entry->virtualPwmFrequency;
            } else if (entry->hasPwm) {
                segment.pwmResolution = entry->pwm.getResolution();
                segment.pwmFrequency = entry->pwm.getFrequency();
            } else {
                segment.pwmResolution = DEFAULT_PWM_RESOLUTION;
                segment.pwmFrequency = DEFAULT_PWM_FREQUENCY;
            }
        } else {
            segment.pwmResolution = DEFAULT_PWM_RESOLUTION;
            segment.pwmFrequency = DEFAULT_PWM_FREQUENCY;
        }

        if (entry->type == SegmentType::AnalogInput) {
            if (entry->isVirtual) {
                segment.adcResolution = entry->virtualAdcResolution;
                segment.adcSampleIntervalMs = entry->virtualAdcSampleIntervalMs;
                segment.adcDeltaThreshold = entry->virtualAdcDeltaThreshold;
                segment.adcHighThreshold = entry->virtualAdcHighThreshold;
                segment.adcLowThreshold = entry->virtualAdcLowThreshold;
            } else if (entry->hasAdc) {
                segment.adcResolution = entry->adc.getResolution();
                segment.adcSampleIntervalMs = entry->adc.getSampleIntervalMs();
                segment.adcDeltaThreshold = entry->adc.getDeltaThreshold();
                segment.adcHighThreshold = entry->adc.getHighThreshold();
                segment.adcLowThreshold = entry->adc.getLowThreshold();
            } else {
                segment.adcResolution = DEFAULT_ADC_RESOLUTION;
                segment.adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
                segment.adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
                segment.adcHighThreshold = 0;
                segment.adcLowThreshold = 0;
            }
        } else {
            segment.adcResolution = DEFAULT_ADC_RESOLUTION;
            segment.adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
            segment.adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
            segment.adcHighThreshold = 0;
            segment.adcLowThreshold = 0;
        }
        segment.rule = entry->getRuleRef();
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
        if (entry->isVirtual) {
            Serial.printf("  [%d] VIRTUAL id=%s type=%s vpin=%d -> node#%u rpin=%u state=%s val=%u autoOff=%ds\n",
                i, entry->segmentId, segmentTypeToString(entry->type),
                entry->pinNumber, entry->nodeId, entry->remotePin,
                getPinState(entry->pinNumber) ? "HIGH/ON" : "LOW/OFF",
                static_cast<unsigned int>(entry->virtualAnalogValue),
                entry->autoOffDelay);
            continue;
        }
        if (entry->type == SegmentType::AnalogOutput) {
            const uint16_t val = entry->hasPwm ? entry->pwm.getValue() : 0;
            const uint16_t maxDuty = entry->hasPwm ? entry->pwm.getMaxDuty() : 255;
            const uint16_t lastVal = entry->hasPwm ? entry->pwm.getLastNonZeroValue() : 0;
            const uint8_t res = entry->hasPwm ? entry->pwm.getResolution() : DEFAULT_PWM_RESOLUTION;
            const uint16_t freq = entry->hasPwm ? entry->pwm.getFrequency() : DEFAULT_PWM_FREQUENCY;
            Serial.printf("  [%d] id=%s type=analog_output pin=%d duty=%u/%u (%u-bit @ %uHz) last=%u autoOff=%ds\n",
                i, entry->segmentId, entry->pinNumber, val, maxDuty, res, freq, lastVal, entry->autoOffDelay);
        } else if (entry->type == SegmentType::AnalogInput) {
            const uint16_t val = entry->hasAdc ? entry->adc.getValue() : 0;
            const uint16_t maxVal = entry->hasAdc ? entry->adc.getMaxValue() : 4095;
            const uint8_t res = entry->hasAdc ? entry->adc.getResolution() : DEFAULT_ADC_RESOLUTION;
            const bool thrState = entry->hasAdc ? entry->adc.getThresholdState() : false;
            Serial.printf("  [%d] id=%s type=analog_input pin=%d val=%u/%u (%u-bit sint=%ums delta=%u ath=%u atl=%u) state=%s rule=%s (high=%d low=%d ranges=%u)\n",
                i, entry->segmentId, entry->pinNumber, val, maxVal, res,
                entry->hasAdc ? entry->adc.getSampleIntervalMs() : DEFAULT_ADC_SAMPLE_INTERVAL_MS,
                entry->hasAdc ? entry->adc.getDeltaThreshold() : DEFAULT_ADC_DELTA_THRESHOLD,
                entry->hasAdc ? entry->adc.getHighThreshold() : 0,
                entry->hasAdc ? entry->adc.getLowThreshold() : 0,
                thrState ? "HIGH" : "LOW",
                entry->getRuleRef().active ? "active" : "inactive",
                entry->getRuleRef().highActionCount, entry->getRuleRef().lowActionCount,
                static_cast<unsigned int>(entry->getRuleRef().analogRangeCount));
        } else {
            const bool state = (entry->type == SegmentType::Input)
                ? entry->lastInputState
                : (entry->hasGpio ? entry->gpio.getState() : false);
            Serial.printf("  [%d] id=%s type=%s pin=%d state=%s autoOff=%ds rule=%s (high=%d low=%d)\n",
                i, entry->segmentId, entry->type == SegmentType::Input ? "input" : "output",
                entry->pinNumber, state ? "HIGH/ON" : "LOW/OFF", entry->autoOffDelay,
                entry->getRuleRef().active ? "active" : "inactive",
                entry->getRuleRef().highActionCount, entry->getRuleRef().lowActionCount);
        }
    }
    Serial.println("======================================");
}

static void appendJsonEscaped(String& out, const char* text) {
    if (!text) return;
    for (const char* p = text; *p != '\0'; ++p) {
        const unsigned char c = static_cast<unsigned char>(*p);
        if (c == '"' || c == '\\') {
            out += '\\';
            out += static_cast<char>(c);
        } else if (c >= 0x20) {
            out += static_cast<char>(c);
        }
    }
}

String PinManager::exportStateJson(const AuxNodeManager* auxNodes) const {
    String json;
    json.reserve(1024);
    json += "{\"type\":\"state_sync\",\"states\":{";
    bool pinStates[MAX_PINS] = {};
    bool first = true;

    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (entry && entry->active) {
            if (!first) json += ",";
            char pinText[8];
            snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
            json += "\"";
            json += pinText;
            json += "\":";

            const bool state = _stateManager.getPinState(entry->pinNumber);
            json += state ? "true" : "false";
            pinStates[i] = state;
            first = false;
        }
    }

    json += "},\"values\":{";
    first = true;
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active) continue;

        const int16_t analogVal = _stateManager.getPinAnalogValue(entry->pinNumber);
        if (analogVal < 0) continue;

        if (!first) json += ",";
        char pinText[8];
        char valText[8];
        snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
        snprintf(valText, sizeof(valText), "%d", static_cast<int>(analogVal));
        json += "\"";
        json += pinText;
        json += "\":";
        json += valText;
        first = false;
    }

    json += "},\"resolutions\":{";
    first = true;
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active) continue;

        const uint8_t res = _stateManager.getPinAnalogResolution(entry->pinNumber);
        if (res == 0) continue;

        if (!first) json += ",";
        char pinText[8];
        char resText[6];
        snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
        snprintf(resText, sizeof(resText), "%u", static_cast<unsigned int>(res));
        json += "\"";
        json += pinText;
        json += "\":";
        json += resText;
        first = false;
    }

    // Expose live pin -> stored segment ID mapping before "timers" so dashboards
    // can detect or reconcile segment ID drift without breaking timers parsing.
    json += "},\"ids\":{";
    first = true;
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active || entry->segmentId[0] == '\0') continue;

        if (!first) json += ",";
        char pinText[8];
        snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
        json += "\"";
        json += pinText;
        json += "\":\"";
        appendJsonEscaped(json, entry->segmentId);
        json += "\"";
        first = false;
    }

    // Expose live virtual pin -> {node, rpin} bindings
    json += "},\"virtual\":{";
    first = true;
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active || !entry->isVirtual) continue;

        if (!first) json += ",";
        char entryText[48];
        snprintf(entryText, sizeof(entryText), "\"%d\":{\"node\":%u,\"rpin\":%u}",
                 entry->pinNumber, entry->nodeId, entry->remotePin);
        json += entryText;
        first = false;
    }

    if (auxNodes != nullptr) {
        json += "},\"nodes\":";
        auxNodes->appendNodesJson(json);
        json += ",\"timers\":{";
    } else {
        json += "},\"timers\":{";
    }

    first = true;
    for (int i = 0; i < MAX_PINS; i++) {
        const PinEntry* entry = _registry.getEntryByIndexConst(i);
        if (!entry || !entry->active ||
            (entry->type != SegmentType::Output && entry->type != SegmentType::AnalogOutput)) {
            continue;
        }

        const unsigned long remainingMs = pinStates[i]
            ? getAutoOffRemainingMsByPin(entry->pinNumber)
            : 0UL;
        if (!first) json += ",";
        char pinText[8];
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
    return json;
}
