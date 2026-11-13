#pragma once

#include <ArduinoWebsockets.h>
#include <Events/IEventDispatcher.h>
#include <functional>

namespace uniuno {

class WsServerParser {
public:
    WsServerParser(IEventDispatcher* dispatcher, std::function<String()> stateProvider);
    void parseMessage(const String& data, websockets::WebsocketsClient& client);

private:
    IEventDispatcher* _dispatcher;
    std::function<String()> _stateProvider;
};

} // namespace uniuno
