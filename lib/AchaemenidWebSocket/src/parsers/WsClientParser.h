#pragma once

#include <ArduinoWebsockets.h>
#include <Events/IEventDispatcher.h>
#include "IMessageParser.h"

namespace uniuno {

class WsClientParser : public IMessageParser {
public:
    WsClientParser(IEventDispatcher* dispatcher);
    ~WsClientParser() override = default;

    void parseMessage(const websockets::WebsocketsMessage& message) override;

private:
    IEventDispatcher* _dispatcher;
};

} // namespace uniuno
