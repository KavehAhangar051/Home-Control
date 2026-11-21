#include "SegmentParsers.h"
#include <AppEvents.h>
#include <Utilities/logging.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticString.h>

namespace uniuno {

// Helper to safely read a string directly into a StaticString. No Heap allocations!
template <size_t Capacity>
FORCE_INLINE static void readIntoStaticString(const uint8_t* payload, size_t& offset, size_t maxLen, StaticString<Capacity>& dest) {
    while (offset < maxLen && payload[offset] != '\0' && dest.size() < dest.capacity()) {
        char c[2] = {(char)payload[offset++], '\0'};
        dest += c;
    }
    // skip null terminator or remaining characters if truncated
    while (offset < maxLen && payload[offset] != '\0') offset++;
    if (offset < maxLen) offset++; // skip null
}

bool SegmentParsers::canHandle(uint8_t cmdType) const {
    return cmdType == 0x02 || cmdType == 0x03 || cmdType == 0x04 || cmdType == 0x0C;
}

void SegmentParsers::handle(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
    if (len == 0) return;
    switch (payload[0]) {
        case 0x02: parseAddSegment(payload, len, dispatcher); break;
        case 0x03: parseDeleteSegment(payload, len, dispatcher); break;
        case 0x04: parseDashboardPresence(payload, len, dispatcher); break;
        case 0x0C: parseUpdateAnalogInputConfig(payload, len, dispatcher); break;
    }
}

FORCE_INLINE static uint16_t readUint16LE(const uint8_t* buf, size_t offset) {
    return static_cast<uint16_t>(buf[offset]) |
        (static_cast<uint16_t>(buf[offset + 1]) << 8);
}

HOT_PATH IRAM_ATTR void SegmentParsers::parseAddSegment(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
    if (LIKELY(len >= 6)) {
        const int pinNum = payload[1];
        const uint8_t legacyVal = payload[2];
        size_t offset = 3;
        
        StaticString<32> idStr;
        StaticString<32> typeStr;
        
        readIntoStaticString(payload, offset, len, idStr);
        readIntoStaticString(payload, offset, len, typeStr);

        uint8_t pwmResolution = DEFAULT_PWM_RESOLUTION;
        uint16_t pwmFrequency = DEFAULT_PWM_FREQUENCY;
        uint16_t initialValue = legacyVal;
        uint8_t adcResolution = DEFAULT_ADC_RESOLUTION;
        uint16_t adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
        uint16_t adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
        uint16_t adcHighThreshold = 0;
        uint16_t adcLowThreshold = 0;

        const bool isAnalogInput =
            (strcmp(typeStr.c_str(), "analog_input") == 0 || strcmp(typeStr.c_str(), "adc_input") == 0);

        if (isAnalogInput) {
            // Progressive optional trailing ADC metadata (up to 9 bytes):
            // [res:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]
            if (offset < len) {
                const uint8_t rawRes = payload[offset++];
                if (rawRes >= MIN_ADC_RESOLUTION && rawRes <= MAX_ADC_RESOLUTION) {
                    adcResolution = rawRes;
                }
            }
            const uint16_t maxAdcVal = static_cast<uint16_t>((1UL << adcResolution) - 1UL);
            if (offset + 2 <= len) {
                const uint16_t rawSint = readUint16LE(payload, offset);
                offset += 2;
                if (rawSint >= MIN_ADC_SAMPLE_INTERVAL_MS && rawSint <= MAX_ADC_SAMPLE_INTERVAL_MS) {
                    adcSampleIntervalMs = rawSint;
                } else if (rawSint < MIN_ADC_SAMPLE_INTERVAL_MS) {
                    adcSampleIntervalMs = MIN_ADC_SAMPLE_INTERVAL_MS;
                } else {
                    adcSampleIntervalMs = MAX_ADC_SAMPLE_INTERVAL_MS;
                }
            }
            if (offset + 2 <= len) {
                const uint16_t rawDelta = readUint16LE(payload, offset);
                offset += 2;
                if (rawDelta < MIN_ADC_DELTA_THRESHOLD) {
                    adcDeltaThreshold = MIN_ADC_DELTA_THRESHOLD;
                } else if (rawDelta > maxAdcVal) {
                    adcDeltaThreshold = maxAdcVal;
                } else {
                    adcDeltaThreshold = rawDelta;
                }
            } else if (adcDeltaThreshold > maxAdcVal) {
                adcDeltaThreshold = maxAdcVal;
            }
            if (offset + 2 <= len) {
                const uint16_t rawAth = readUint16LE(payload, offset);
                offset += 2;
                adcHighThreshold = rawAth > maxAdcVal ? maxAdcVal : rawAth;
            }
            if (offset + 2 <= len) {
                const uint16_t rawAtl = readUint16LE(payload, offset);
                offset += 2;
                adcLowThreshold = (adcHighThreshold == 0)
                    ? 0
                    : (rawAtl > adcHighThreshold ? adcHighThreshold : rawAtl);
            }
        } else {
            // Backward-compatible optional trailing PWM metadata (up to 5 bytes):
            // [res:u8] or [res:u8][freq:u16LE] or [res:u8][freq:u16LE][initVal:u16LE]
            if (offset < len) {
                const uint8_t rawRes = payload[offset++];
                if (rawRes >= MIN_PWM_RESOLUTION && rawRes <= MAX_PWM_RESOLUTION) {
                    pwmResolution = rawRes;
                }
            }
            if (offset + 2 <= len) {
                const uint16_t rawFreq = readUint16LE(payload, offset);
                offset += 2;
                if (rawFreq >= MIN_PWM_FREQUENCY && rawFreq <= MAX_PWM_FREQUENCY) {
                    pwmFrequency = rawFreq;
                }
            }
            if (offset + 2 <= len) {
                const uint16_t rawInit = readUint16LE(payload, offset);
                offset += 2;
                initialValue = rawInit > MAX_ANALOG_OUTPUT_VALUE ? MAX_ANALOG_OUTPUT_VALUE : rawInit;
            }
        }

        SegmentAddRequestEvent evt{
            idStr.c_str(),
            typeStr.c_str(),
            pinNum,
            pwmResolution,
            pwmFrequency,
            initialValue,
            adcResolution,
            adcSampleIntervalMs,
            adcDeltaThreshold,
            adcHighThreshold,
            adcLowThreshold
        };
        dispatcher->dispatch(evt);
        if (isAnalogInput) {
            INFOF("[MQTT Handler] Binary Add: id=%s type=%s pin=%d (res=%u sint=%ums delta=%u ath=%u atl=%u)",
                  idStr.c_str(), typeStr.c_str(), pinNum, adcResolution, adcSampleIntervalMs,
                  adcDeltaThreshold, adcHighThreshold, adcLowThreshold);
        } else {
            INFOF("[MQTT Handler] Binary Add: id=%s type=%s pin=%d (res=%u freq=%uHz init=%u)",
                  idStr.c_str(), typeStr.c_str(), pinNum, pwmResolution, pwmFrequency, initialValue);
        }
    }
}

/**
 * @brief Parse binary DELETE_SEGMENT (0x03) command frame.
 * Legacy frame: [0x03][id_ascii...][0x00]
 * Extended v2:  [0x03][id_ascii...][0x00][pin:u8]  (optional trailing GPIO 0..39 fallback)
 */
HOT_PATH IRAM_ATTR void SegmentParsers::parseDeleteSegment(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
    if (UNLIKELY(payload == nullptr || dispatcher == nullptr || len < 2)) {
        return;
    }

    size_t offset = 1;

    StaticString<32> idStr;
    readIntoStaticString(payload, offset, len, idStr);

    int fallbackPin = -1;
    if (offset < len) {
        const uint8_t rawPin = payload[offset];
        if (rawPin <= 39) {
            fallbackPin = static_cast<int>(rawPin);
        } else {
            WARNINGF("[MQTT Handler] Ignoring out-of-range fallback pin %u in DELETE_SEGMENT (0x03)", rawPin);
        }
    }

    if (idStr.size() == 0 && fallbackPin < 0) {
        WARNING("[MQTT Handler] Rejected DELETE_SEGMENT (0x03): empty ID and no valid fallback pin");
        return;
    }

    SegmentRemoveRequestEvent evt{idStr.c_str(), fallbackPin};
    dispatcher->dispatch(evt);
    if (fallbackPin >= 0) {
        INFOF("[MQTT Handler] Binary Delete: id=%s pin=%d", idStr.c_str(), fallbackPin);
    } else {
        INFOF("[MQTT Handler] Binary Delete: id=%s", idStr.c_str());
    }
}

HOT_PATH IRAM_ATTR void SegmentParsers::parseDashboardPresence(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
    if (LIKELY(len >= 2)) {
        bool isOnline = (payload[1] == 0x01);
        DashboardPresenceEvent evt{isOnline};
        dispatcher->dispatch(evt);
        INFOF("[MQTT Handler] Binary Presence: %s", isOnline ? "online" : "offline");
    }
}

/**
 * @brief Parse binary UPDATE_ANALOG_INPUT_CONFIG (0x0C) command frame.
 * Frame (10 bytes): [0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]
 * Frame (11 bytes): [0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE][res:u8]
 */
HOT_PATH IRAM_ATTR void SegmentParsers::parseUpdateAnalogInputConfig(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
    if (UNLIKELY(payload == nullptr || dispatcher == nullptr || (len != 10 && len != 11))) {
        WARNING("[MQTT Handler] Rejected UPDATE_ANALOG_INPUT_CONFIG (0x0C): invalid frame length");
        return;
    }

    const int pinNum = payload[1];
    if (UNLIKELY(pinNum > 39)) {
        WARNINGF("[MQTT Handler] Rejected UPDATE_ANALOG_INPUT_CONFIG (0x0C): invalid GPIO %d", pinNum);
        return;
    }

    const uint16_t sampleIntervalMs = readUint16LE(payload, 2);
    const uint16_t deltaThreshold = readUint16LE(payload, 4);
    const uint16_t highThreshold = readUint16LE(payload, 6);
    const uint16_t lowThreshold = readUint16LE(payload, 8);
    const uint8_t resolution = (len == 11) ? payload[10] : 0;

    if (resolution != 0 && (resolution < MIN_ADC_RESOLUTION || resolution > MAX_ADC_RESOLUTION)) {
        WARNINGF("[MQTT Handler] Rejected UPDATE_ANALOG_INPUT_CONFIG (0x0C): invalid resolution %u", resolution);
        return;
    }

    SegmentUpdateAnalogInputConfigRequestEvent evt{
        pinNum,
        sampleIntervalMs,
        deltaThreshold,
        highThreshold,
        lowThreshold,
        resolution
    };
    dispatcher->dispatch(evt);
    INFOF("[MQTT Handler] Binary Update ADC Config (0x0C): pin=%d sint=%ums delta=%u ath=%u atl=%u res=%u",
          pinNum, sampleIntervalMs, deltaThreshold, highThreshold, lowThreshold, resolution);
}

} // namespace uniuno
