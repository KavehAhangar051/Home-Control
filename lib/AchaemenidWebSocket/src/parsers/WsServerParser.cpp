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
}

} // namespace uniuno
