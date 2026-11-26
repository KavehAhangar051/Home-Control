#pragma once

#include <ArduinoWebsockets.h>
#include <Events/IEventDispatcher.h>
#include <Optimization/CompilerTraits.h>
#include "WebSocketConfig.h"
#include "../parsers/WsServerParser.h"

#define WS_SERVER_MAX_CLIENTS 4

namespace uniuno {

/**
 * @brief Lightweight local WebSocket server with throttled adaptive polling.
 */
class AchaemenidWebSocketServer {
public:
  AchaemenidWebSocketServer(IEventDispatcher* dispatcher, StateProvider stateProvider);
  ~AchaemenidWebSocketServer() = default;

  void begin(uint16_t port);
  HOT_PATH void loop();
  void broadcastState(const String& stateJson);
  void broadcastState(const char* stateJson);

private:
  void handleMessage(uint8_t idx, const websockets::WebsocketsMessage& msg);
  void handleEvent(uint8_t idx, websockets::WebsocketsEvent event, const String& data);

  websockets::WebsocketsServer server;
  websockets::WebsocketsClient clients[WS_SERVER_MAX_CLIENTS];
  uint8_t clientCount = 0;
  bool _isStarted = false;
  uint32_t _lastAcceptCycle = 0;
  uint32_t _lastClientPollCycle = 0;
  IEventDispatcher* dispatcher_;
  WsServerParser parser_;
};

} // namespace uniuno
