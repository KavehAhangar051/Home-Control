#include "WsClientParser.h"
#include <AppEvents.h>
#include <PinManager.h>
#include <ArduinoJson.h>
#include <Optimization/CompilerTraits.h>
#include <AchaemenidConfigProtocol.h>


namespace uniuno {

WsClientParser::WsClientParser(IEventDispatcher* dispatcher) : _dispatcher(dispatcher) {}

HOT_PATH void WsClientParser::parseMessage(const websockets::WebsocketsMessage& message) {
    if (LIKELY(message.isBinary())) {
        const char* data = message.c_str();
        const size_t len = message.length();

        // Single pin binary format: [0x06][pin][state]
        if (LIKELY(len >= 3) && LIKELY(data[0] == 0x06)) {
            const uint8_t pin   = static_cast<uint8_t>(data[1]);
            const uint8_t state = static_cast<uint8_t>(data[2]);

            Serial.printf("[WebSocket] Automation Triggered! Pin: %u, State: %u\n", pin, state);
            PinStateChangeRequestEvent event{pin, state != 0, 0, PinStateChangeOrigin::Cloudflare};
            _dispatcher->dispatch(event);

            // getWsClientInstance().sendText("{\"type\":\"automation_ack\",\"status\":\"success\"}");
        }
        // Batch binary format: [0x08][count][pin1][state1]...
        else if (LIKELY(len >= 2) && data[0] == 0x08) {
            const uint8_t count = static_cast<uint8_t>(data[1]);
            if (len >= 2 + (count * 2)) {
                Serial.printf("[WebSocket] Batch Automation Triggered! Actions: %u\n", count);
                for (uint8_t i = 0; i < count; ++i) {
                    const uint8_t pin   = static_cast<uint8_t>(data[2 + i*2]);
                    const uint8_t state = static_cast<uint8_t>(data[3 + i*2]);
                    PinStateChangeRequestEvent event{pin, state != 0, 0, PinStateChangeOrigin::Cloudflare};
                    _dispatcher->dispatch(event);
                }
                // getWsClientInstance().sendText("{\"type\":\"automation_ack\",\"status\":\"success\"}");
            }
        }
    } else {
        // Text message
        String text = message.data();
        if (text.startsWith("ESP_CFG_V2")) {
            Serial.println("[WebSocket] Received Config payload");
            AchaemenidConfigProtocol configParser;
            ParseResult parsed;
            if (configParser.parse(text.c_str(), parsed) &&
                (parsed.segmentsProvided || parsed.wifiProvided || parsed.apProvided || parsed.mqtt.valid)) {
                ConfigLoadedEvent event;
                event.parsed = parsed;
                event.hasParsedConfig = true;
                event.pinCount = parsed.count;
                event.mqtt = parsed.mqtt;
                event.wifiCount = parsed.wifiCount;
                for (int i = 0; i < parsed.wifiCount; ++i) event.wifi[i] = parsed.wifi[i];
                _dispatcher->dispatch(event);
            } else {
                Serial.println("[WebSocket] Rejected invalid configuration payload.");
            }
        } else if (text.indexOf("\"state_sync\"") >= 0) {"\"state_sync\"") >= 0) {
            Serial.println("[WebSocket] Received state_sync payload from Cloudflare");
            StaticJsonDocument<1024> doc; 
            DeserializationError error = deserializeJson(doc, text);
            if (!error && doc.containsKey("states")) {
                JsonObject states = doc["states"].as<JsonObject>();
                for (JsonPair kv : states) {
                    int pin   = String(kv.key().c_str()).toInt();
                    bool state = kv.value().as<bool>();
                    PinStateChangeRequestEvent event{pin, state, 0, PinStateChangeOrigin::Cloudflare};
                    _dispatcher->dispatch(event);
                }
                Serial.println("[WebSocket] Initial states applied successfully.");
            }
        } else {
            Serial.printf("[WebSocket] Text: %s\n", text.c_str());
        }
    }
}

} // namespace uniuno
