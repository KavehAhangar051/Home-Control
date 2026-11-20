#include "WsClientParser.h"
#include <AppEvents.h>
#include <PinManager.h>
#include <ArduinoJson.h>
#include <Optimization/CompilerTraits.h>
#include <AchaemenidConfigProtocol.h>
#include <cstdlib>

namespace uniuno {

WsClientParser::WsClientParser(IEventDispatcher* dispatcher) : _dispatcher(dispatcher) {}

/**
 * @brief Parse incoming WebSocket messages (binary automations or JSON config).
 */
HOT_PATH void WsClientParser::parseMessage(const websockets::WebsocketsMessage& message) {
    if (UNLIKELY(_dispatcher == nullptr)) return;

    if (LIKELY(message.isBinary())) {
        const char* data = message.c_str();
        const size_t len = message.length();

        // Single pin binary format: [0x06][pin][state]
        if (LIKELY(len >= 3) && LIKELY(static_cast<uint8_t>(data[0]) == 0x06)) {
            const uint8_t pin   = static_cast<uint8_t>(data[1]);
            const uint8_t state = static_cast<uint8_t>(data[2]);

            Serial.printf("[WebSocket] Automation Triggered! Pin: %u, State: %u\n", pin, state);
            PinStateChangeRequestEvent event{pin, state != 0, 0, PinStateChangeOrigin::Cloudflare};
            _dispatcher->dispatch(event);
        }
        // Batch binary format: [0x08][count][pin1][state1]...
        else if (LIKELY(len >= 2) && static_cast<uint8_t>(data[0]) == 0x08) {
            const uint8_t count = static_cast<uint8_t>(data[1]);
            if (len >= 2 + (count * 2)) {
                Serial.printf("[WebSocket] Batch Automation Triggered! Actions: %u\n", count);
                for (uint8_t i = 0; i < count; ++i) {
                    const uint8_t pin   = static_cast<uint8_t>(data[2 + i*2]);
                    const uint8_t state = static_cast<uint8_t>(data[3 + i*2]);
                    PinStateChangeRequestEvent event{pin, state != 0, 0, PinStateChangeOrigin::Cloudflare};
                    _dispatcher->dispatch(event);
                }
            }
        }
        // Single analog PWM binary format: [0x0A][pin:u8][value:u16LE]
        else if (LIKELY(len >= 4) && static_cast<uint8_t>(data[0]) == 0x0A) {
            const uint8_t pin = static_cast<uint8_t>(data[1]);
            const uint16_t val = static_cast<uint16_t>(static_cast<uint8_t>(data[2])) |
                (static_cast<uint16_t>(static_cast<uint8_t>(data[3])) << 8);
            Serial.printf("[WebSocket] Analog Automation Triggered! Pin: %u, Value: %u\n", pin, val);
            PinStateChangeRequestEvent event = PinStateChangeRequestEvent::analog(
                pin, val, 0, PinStateChangeOrigin::Cloudflare);
            _dispatcher->dispatch(event);
        }
        // Analog input config update: [0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE][optional res:u8]
        else if ((len == 10 || len == 11) && static_cast<uint8_t>(data[0]) == 0x0C) {
            const uint8_t pin = static_cast<uint8_t>(data[1]);
            const uint16_t sint = static_cast<uint16_t>(static_cast<uint8_t>(data[2])) |
                (static_cast<uint16_t>(static_cast<uint8_t>(data[3])) << 8);
            const uint16_t delta = static_cast<uint16_t>(static_cast<uint8_t>(data[4])) |
                (static_cast<uint16_t>(static_cast<uint8_t>(data[5])) << 8);
            const uint16_t ath = static_cast<uint16_t>(static_cast<uint8_t>(data[6])) |
                (static_cast<uint16_t>(static_cast<uint8_t>(data[7])) << 8);
            const uint16_t atl = static_cast<uint16_t>(static_cast<uint8_t>(data[8])) |
                (static_cast<uint16_t>(static_cast<uint8_t>(data[9])) << 8);
            const uint8_t res = (len == 11) ? static_cast<uint8_t>(data[10]) : 0;
            if (pin <= 39 && (res == 0 || (res >= MIN_ADC_RESOLUTION && res <= MAX_ADC_RESOLUTION))) {
                SegmentUpdateAnalogInputConfigRequestEvent event{pin, sint, delta, ath, atl, res};
                _dispatcher->dispatch(event);
            }
        }
        // On-demand analog input read: [0x0D][pin:u8]
        else if (len >= 2 && static_cast<uint8_t>(data[0]) == 0x0D) {
            const uint8_t pin = static_cast<uint8_t>(data[1]);
            if (pin <= 39) {
                AnalogInputReadRequestEvent event{pin};
                _dispatcher->dispatch(event);
            }
        }
        // Multi-range analog rules update: [0x0E][pin:u8][count:u8] + count * 12 bytes
        else if (len >= 3 && static_cast<uint8_t>(data[0]) == 0x0E) {
            const uint8_t pin = static_cast<uint8_t>(data[1]);
            const uint8_t rangeCount = static_cast<uint8_t>(data[2]);
            if (pin <= 39 && rangeCount <= MAX_ANALOG_RANGE_RULES &&
                len == (3U + static_cast<size_t>(rangeCount) * 12U)) {
                RuleConfig newRule;
                bool valid = true;
                size_t offset = 3;
                for (uint8_t i = 0; i < rangeCount; ++i) {
                    uint16_t minVal = static_cast<uint16_t>(static_cast<uint8_t>(data[offset])) |
                        (static_cast<uint16_t>(static_cast<uint8_t>(data[offset + 1])) << 8);
                    uint16_t maxVal = static_cast<uint16_t>(static_cast<uint8_t>(data[offset + 2])) |
                        (static_cast<uint16_t>(static_cast<uint8_t>(data[offset + 3])) << 8);
                    const uint16_t hyst = static_cast<uint16_t>(static_cast<uint8_t>(data[offset + 4])) |
                        (static_cast<uint16_t>(static_cast<uint8_t>(data[offset + 5])) << 8);
                    const int8_t targetPin = static_cast<int8_t>(data[offset + 6]);
                    const uint8_t flags = static_cast<uint8_t>(data[offset + 7]);
                    const uint8_t delay = static_cast<uint8_t>(data[offset + 8]);
                    const int16_t targetValue = static_cast<int16_t>(
                        static_cast<uint16_t>(static_cast<uint8_t>(data[offset + 9])) |
                        (static_cast<uint16_t>(static_cast<uint8_t>(data[offset + 10])) << 8));
                    offset += 12;

                    const bool actionState = (flags & 0x01U) != 0U;
                    const uint8_t actionType = static_cast<uint8_t>((flags >> 1) & 0x03U);
                    const uint8_t triggerMode = static_cast<uint8_t>((flags >> 3) & 0x01U);

                    if (minVal > MAX_ANALOG_INPUT_VALUE || maxVal > MAX_ANALOG_INPUT_VALUE ||
                        hyst > (MAX_ANALOG_INPUT_VALUE / 2U) ||
                        targetPin < 0 || targetPin > 39 ||
                        actionType > ACTION_FOR_DURATION || delay > 60 ||
                        (targetValue != RULE_ANALOG_VALUE_UNSET &&
                         (targetValue < 0 || targetValue > MAX_ANALOG_OUTPUT_VALUE))) {
                        valid = false;
                        break;
                    }
                    if (minVal > maxVal) {
                        const uint16_t tmp = minVal;
                        minVal = maxVal;
                        maxVal = tmp;
                    }

                    AnalogRangeRule& rr = newRule.analogRanges[newRule.analogRangeCount++];
                    rr.minValue = minVal;
                    rr.maxValue = maxVal;
                    rr.hysteresis = hyst;
                    rr.targetPin = targetPin;
                    rr.delay = delay;
                    rr.actionType = static_cast<RuleActionType>(actionType);
                    rr.triggerMode = static_cast<AnalogRangeTriggerMode>(triggerMode);
                    rr.targetValue = targetValue;
                    rr.actionState = (targetValue != RULE_ANALOG_VALUE_UNSET) ? (targetValue > 0) : actionState;
                    rr.enabled = true;
                }
                if (valid) {
                    newRule.active = (newRule.analogRangeCount > 0);
                    SegmentUpdateRuleRequestEvent event{static_cast<int>(pin), newRule};
                    _dispatcher->dispatch(event);
                }
            }
        }
    } else {
        // Text message
        const String text = message.data();
        if (text.startsWith("ESP_CFG_V2")) {
            Serial.println("[WebSocket] Received Config payload");
            AchaemenidConfigProtocol configParser;
            static ParseResult parsed;
            parsed.reset();
            if (configParser.parse(text.c_str(), parsed) &&
                (parsed.segmentsProvided || parsed.wifiProvided || parsed.apProvided || parsed.mqtt.valid)) {
                ConfigLoadedEvent event;
                event.parsed = &parsed;
                event.hasParsedConfig = true;
                event.pinCount = parsed.count;
                event.mqtt = parsed.mqtt;
                event.wifiCount = parsed.wifiCount;
                for (int i = 0; i < parsed.wifiCount; ++i) event.wifi[i] = parsed.wifi[i];
                _dispatcher->dispatch(event);
            } else {
                Serial.println("[WebSocket] Rejected invalid configuration payload.");
            }
        } else if (text.indexOf("\"state_sync\"") >= 0) {
            Serial.println("[WebSocket] Received state_sync payload from Cloudflare");
            StaticJsonDocument<1536> doc;
            DeserializationError error = deserializeJson(doc, text);
            if (!error) {
                if (doc.containsKey("states")) {
                    JsonObject states = doc["states"].as<JsonObject>();
                    for (JsonPair kv : states) {
                        // Zero-heap integer parsing directly via standard atoi
                        const int pin   = atoi(kv.key().c_str());
                        const bool state = kv.value().as<bool>();
                        PinStateChangeRequestEvent event{pin, state, 0, PinStateChangeOrigin::Cloudflare};
                        _dispatcher->dispatch(event);
                    }
                }
                if (doc.containsKey("values")) {
                    JsonObject values = doc["values"].as<JsonObject>();
                    for (JsonPair kv : values) {
                        const int pin = atoi(kv.key().c_str());
                        const int rawVal = kv.value().as<int>();
                        const uint16_t clamped = rawVal <= 0 ? 0 :
                            (rawVal > MAX_ANALOG_OUTPUT_VALUE ? MAX_ANALOG_OUTPUT_VALUE : static_cast<uint16_t>(rawVal));
                        PinStateChangeRequestEvent event = PinStateChangeRequestEvent::analog(
                            pin, clamped, 0, PinStateChangeOrigin::Cloudflare);
                        _dispatcher->dispatch(event);
                    }
                }
                Serial.println("[WebSocket] Initial states applied successfully.");
            }
        } else {
            Serial.printf("[WebSocket] Text: %s\n", text.c_str());
        }
    }
}

} // namespace uniuno
