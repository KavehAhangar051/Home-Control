#pragma once

#include <ArduinoWebsockets.h>
#include <Events/IEventDispatcher.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {

/**
 * @brief Parses incoming binary automations and JSON configuration from Cloudflare WebSocket.
 */
class WsClientParser {
public:
  explicit WsClientParser(IEventDispatcher* dispatcher = nullptr);

  void setDispatcher(IEventDispatcher* dispatcher) { _dispatcher = dispatcher; }
  HOT_PATH void parseMessage(const websockets::WebsocketsMessage& message);

private:
  IEventDispatcher* _dispatcher;
};

} // namespace uniuno
