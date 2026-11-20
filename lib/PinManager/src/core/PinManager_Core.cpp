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
        const char* type = segmentTypeToString(entry->type);
        strncpy(segment.type, type, sizeof(segment.type) - 1);
        segment.type[sizeof(segment.type) - 1] = '\0';
        segment.pin = entry->pinNumber;
        segment.autoOffDelay = entry->autoOffDelay;
        segment.value = false;
        segment.analogValue = 0;
        if (entry->type == SegmentType::AnalogOutput && entry->hasPwm) {
            segment.pwmResolution = entry->pwm.getResolution();
            segment.pwmFrequency = entry->pwm.getFrequency();
        } else {
            segment.pwmResolution = DEFAULT_PWM_RESOLUTION;
            segment.pwmFrequency = DEFAULT_PWM_FREQUENCY;
        }
        if (entry->type == SegmentType::AnalogInput && entry->hasAdc) {
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
            Serial.printf("  [%d] id=%s type=analog_input pin=%d val=%u/%u (%u-bit sint=%ums delta=%u ath=%u atl=%u) state=%s rule=%s (high=%d low=%d)\n",
                i, entry->segmentId, entry->pinNumber, val, maxVal, res,
                entry->hasAdc ? entry->adc.getSampleIntervalMs() : DEFAULT_ADC_SAMPLE_INTERVAL_MS,
                entry->hasAdc ? entry->adc.getDeltaThreshold() : DEFAULT_ADC_DELTA_THRESHOLD,
                entry->hasAdc ? entry->adc.getHighThreshold() : 0,
                entry->hasAdc ? entry->adc.getLowThreshold() : 0,
                thrState ? "HIGH" : "LOW",
                entry->rule.active ? "active" : "inactive",
                entry->rule.highActionCount, entry->rule.lowActionCount);
        } else {
            const bool state = (entry->type == SegmentType::Input)
                ? entry->lastInputState
                : (entry->hasGpio ? entry->gpio.getState() : false);
            Serial.printf("  [%d] id=%s type=%s pin=%d state=%s autoOff=%ds rule=%s (high=%d low=%d)\n",
                i, entry->segmentId, entry->type == SegmentType::Input ? "input" : "output",
                entry->pinNumber, state ? "HIGH/ON" : "LOW/OFF", entry->autoOffDelay,
                entry->rule.active ? "active" : "inactive",
                entry->rule.highActionCount, entry->rule.lowActionCount);
        }
    }
    Serial.println("======================================");
}

String PinManager::exportStateJson() const {
    uniuno::StaticString<1280> json("{\"type\":\"state_sync\",\"states\":{");
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

            bool state = false;
            if (entry->type == SegmentType::Input) {
                state = entry->lastInputState;
            } else if (entry->type == SegmentType::AnalogInput) {
                state = entry->hasAdc ? entry->adc.getThresholdState() : entry->lastInputState;
            } else if (entry->type == SegmentType::AnalogOutput) {
                state = entry->hasPwm && entry->pwm.getState();
            } else {
                state = entry->hasGpio && entry->gpio.getState();
            }
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

        uint16_t analogVal = 0;
        if (entry->type == SegmentType::AnalogOutput && entry->hasPwm) {
            analogVal = entry->pwm.getValue();
        } else if (entry->type == SegmentType::AnalogInput && entry->hasAdc) {
            analogVal = entry->adc.getValue();
        } else {
            continue;
        }

        if (!first) json += ",";
        char pinText[6];
        char valText[8];
        snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
        snprintf(valText, sizeof(valText), "%u", analogVal);
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

        uint8_t res = 0;
        if (entry->type == SegmentType::AnalogOutput && entry->hasPwm) {
            res = entry->pwm.getResolution();
        } else if (entry->type == SegmentType::AnalogInput && entry->hasAdc) {
            res = entry->adc.getResolution();
        } else {
            continue;
        }

        if (!first) json += ",";
        char pinText[6];
        char resText[6];
        snprintf(pinText, sizeof(pinText), "%d", entry->pinNumber);
        snprintf(resText, sizeof(resText), "%u", res);
        json += "\"";
        json += pinText;
        json += "\":";
        json += resText;
        first = false;
    }

    json += "},\"timers\":{";
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
