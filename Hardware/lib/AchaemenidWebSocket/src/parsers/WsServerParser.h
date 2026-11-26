#pragma once

#include <ArduinoWebsockets.h>
#include <Events/IEventDispatcher.h>
#include "../core/WebSocketConfig.h"
#include <Optimization/CompilerTraits.h>

namespace uniuno {

/**
 * @brief Parses local dashboard commands received by the WebSocket server.
 */
class WsServerParser {
public:
  WsServerParser(IEventDispatcher* dispatcher = nullptr, StateProvider stateProvider = nullptr);

  void init(IEventDispatcher* dispatcher, StateProvider stateProvider) {
    _dispatcher = dispatcher;
    _stateProvider = std::move(stateProvider);
  }

  HOT_PATH void parseMessage(const String& data, websockets::WebsocketsClient& client);

private:
  IEventDispatcher* _dispatcher;
  StateProvider _stateProvider;
};

} // namespace uniuno
