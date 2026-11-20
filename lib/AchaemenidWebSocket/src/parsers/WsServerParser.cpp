#include "WsServerParser.h"
#include <AppEvents.h>
#include <PinManager.h>
#include <Arduino.h>
#include <utility>
#include <cstdlib>

namespace uniuno {

WsServerParser::WsServerParser(IEventDispatcher* dispatcher, StateProvider stateProvider)
    : _dispatcher(dispatcher), _stateProvider(std::move(stateProvider)) {}

/**
 * @brief Zero-heap message parser for get_state and set_state commands.
 */
HOT_PATH void WsServerParser::parseMessage(const String& data, websockets::WebsocketsClient& client) {
    if (data.indexOf("\"command\":\"get_state\"") >= 0) {
        const String stateJson = _stateProvider ? _stateProvider() : "{}";
        client.send(stateJson);
    }
    else if (data.indexOf("\"command\":\"set_state\"") >= 0 || data.indexOf("\"command\":\"set_analog\"") >= 0) {
        // Zero-heap integer parsing avoiding temporary String substring allocations
        const int pinIdx = data.indexOf("\"pin\":");
        const int valueIdx = data.indexOf("\"value\":");
        const int stateIdx = data.indexOf("\"state\":");
        if (pinIdx >= 0 && _dispatcher != nullptr) {
            const int pin = atoi(data.c_str() + pinIdx + 6);
            const int timerIdx = data.indexOf("\"timer\":");
            const int autoOff = timerIdx >= 0 ? atoi(data.c_str() + timerIdx + 8) : 0;

            if (valueIdx >= 0) {
                int rawVal = atoi(data.c_str() + valueIdx + 8);
                if (rawVal < 0) rawVal = 0;
                if (rawVal > MAX_ANALOG_OUTPUT_VALUE) rawVal = MAX_ANALOG_OUTPUT_VALUE;
                PinStateChangeRequestEvent evt = PinStateChangeRequestEvent::analog(
                    pin,
                    static_cast<uint16_t>(rawVal),
                    autoOff,
                    PinStateChangeOrigin::DashboardCommand
                );
                _dispatcher->dispatch(evt);
            } else if (stateIdx >= 0) {
                const int state = atoi(data.c_str() + stateIdx + 8);
                PinStateChangeRequestEvent evt{pin, state == 1, autoOff, PinStateChangeOrigin::DashboardCommand};
                _dispatcher->dispatch(evt);
            }
        }
    }
    else if (data.indexOf("\"command\":\"read_analog\"") >= 0) {
        const int pinIdx = data.indexOf("\"pin\":");
        if (pinIdx >= 0 && _dispatcher != nullptr) {
            const int pin = atoi(data.c_str() + pinIdx + 6);
            if (pin >= 0 && pin <= 39) {
                AnalogInputReadRequestEvent evt{pin};
                _dispatcher->dispatch(evt);
            }
        }
    }
    else if (data.indexOf("\"command\":\"config_analog_input\"") >= 0) {
        const int pinIdx = data.indexOf("\"pin\":");
        if (pinIdx >= 0 && _dispatcher != nullptr) {
            const int pin = atoi(data.c_str() + pinIdx + 6);
            if (pin >= 0 && pin <= 39) {
                const int sintIdx = data.indexOf("\"sint\":");
                const int deltaIdx = data.indexOf("\"delta\":");
                const int athIdx = data.indexOf("\"ath\":");
                const int atlIdx = data.indexOf("\"atl\":");
                const int resIdx = data.indexOf("\"res\":");

                const int rawSint = sintIdx >= 0 ? atoi(data.c_str() + sintIdx + 7) : DEFAULT_ADC_SAMPLE_INTERVAL_MS;
                const int rawDelta = deltaIdx >= 0 ? atoi(data.c_str() + deltaIdx + 8) : DEFAULT_ADC_DELTA_THRESHOLD;
                const int rawAth = athIdx >= 0 ? atoi(data.c_str() + athIdx + 6) : 0;
                const int rawAtl = atlIdx >= 0 ? atoi(data.c_str() + atlIdx + 6) : 0;
                const int rawRes = resIdx >= 0 ? atoi(data.c_str() + resIdx + 6) : 0;

                const uint16_t sint = rawSint < 0 ? 0 : (rawSint > 65535 ? 65535 : static_cast<uint16_t>(rawSint));
                const uint16_t delta = rawDelta < 0 ? 0 : (rawDelta > MAX_ANALOG_INPUT_VALUE ? MAX_ANALOG_INPUT_VALUE : static_cast<uint16_t>(rawDelta));
                const uint16_t ath = rawAth < 0 ? 0 : (rawAth > MAX_ANALOG_INPUT_VALUE ? MAX_ANALOG_INPUT_VALUE : static_cast<uint16_t>(rawAth));
                const uint16_t atl = rawAtl < 0 ? 0 : (rawAtl > MAX_ANALOG_INPUT_VALUE ? MAX_ANALOG_INPUT_VALUE : static_cast<uint16_t>(rawAtl));
                const uint8_t res = (rawRes >= MIN_ADC_RESOLUTION && rawRes <= MAX_ADC_RESOLUTION)
                    ? static_cast<uint8_t>(rawRes)
                    : 0;

                SegmentUpdateAnalogInputConfigRequestEvent evt{pin, sint, delta, ath, atl, res};
                _dispatcher->dispatch(evt);
            }
        }
    }
}

} // namespace uniuno
