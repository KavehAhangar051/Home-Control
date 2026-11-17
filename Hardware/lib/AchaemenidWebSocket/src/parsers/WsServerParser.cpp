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
    else if (data.indexOf("\"command\":\"set_state\"") >= 0) {
        // Zero-heap integer parsing avoiding temporary String substring allocations
        const int pinIdx = data.indexOf("\"pin\":");
        const int stateIdx = data.indexOf("\"state\":");
        if (pinIdx >= 0 && stateIdx >= 0 && _dispatcher != nullptr) {
            const int pin = atoi(data.c_str() + pinIdx + 6);
            const int state = atoi(data.c_str() + stateIdx + 8);
            PinStateChangeRequestEvent evt{pin, state == 1, 0, PinStateChangeOrigin::DashboardCommand};
            _dispatcher->dispatch(evt);
        }
    }
}

} // namespace uniuno
