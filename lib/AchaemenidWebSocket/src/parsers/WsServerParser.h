#pragma once

#include <ArduinoWebsockets.h>
#include <Events/IEventDispatcher.h>
#include "../core/WebSocketConfig.h"

namespace uniuno {

class WsServerParser {
public:
    WsServerParser(IEventDispatcher* dispatcher, StateProvider stateProvider);
    void parseMessage(const String& data, websockets::WebsocketsClient& client);

private:
    IEventDispatcher* _dispatcher;
    StateProvider _stateProvider;
};

} // namespace uniuno
