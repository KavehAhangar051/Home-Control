#include "WebSocketServer.h"
#include "WebSocketConfig.h"
#include "../parsers/WsServerParser.h"
#include <Optimization/CompilerTraits.h>
#include <Timer/Optimization/TimerAsm.h>
#include <utility>

namespace uniuno {

AchaemenidWebSocketServer::AchaemenidWebSocketServer(IEventDispatcher* dispatcher, StateProvider stateProvider)
    : dispatcher_(dispatcher), parser_(dispatcher_, std::move(stateProvider)) {}

void AchaemenidWebSocketServer::begin(uint16_t port) {
  if (_isStarted) return;
  server.listen(port);
  _isStarted = true;
  const uint32_t nowCycles = uniuno::asm_opt::get_cpu_cycle_count();
  _lastAcceptCycle = nowCycles;
  _lastClientPollCycle = nowCycles;
  Serial.printf("[LocalWS] Server started on port %d\n", port);
}

/**
 * @brief High-performance server loop with CCOUNT hardware cycle throttling.
 * Reads Xtensa CCOUNT in 1 cycle (zero millis() 64-bit divisions) and throttles
 * server.poll() (which invokes yield()) to 50ms intervals.
 */
HOT_PATH void AchaemenidWebSocketServer::loop() {
  if (UNLIKELY(!_isStarted)) return;

  const uint32_t nowCycles = uniuno::asm_opt::get_cpu_cycle_count();

  // 1. Throttled Acceptance of New Clients (every 50ms ~ 20 Hz) via 1-cycle CCOUNT
  if (clientCount < WS_SERVER_MAX_CLIENTS &&
      UNLIKELY(uniuno::asm_opt::is_cycle_interval_elapsed(
          nowCycles, _lastAcceptCycle, uniuno::asm_opt::ms_to_cycles(WS_SERVER_ACCEPT_INTERVAL_MS)))) {
    if (server.poll()) {
      const uint8_t idx = clientCount;
      clients[idx] = server.accept();
      clientCount++;

      Serial.printf("[LocalWS] New client connected (slot %d/%d)\n", idx + 1, WS_SERVER_MAX_CLIENTS);

      clients[idx].onMessage([this, idx](websockets::WebsocketsMessage msg) { this->handleMessage(idx, msg); });
      clients[idx].onEvent(
          [this, idx](websockets::WebsocketsEvent event, String data) { this->handleEvent(idx, event, data); });
    }
  }

  // 2. Throttled Polling of Connected Clients (every 15ms ~ 66 Hz) via 1-cycle CCOUNT
  if (clientCount > 0 &&
      UNLIKELY(uniuno::asm_opt::is_cycle_interval_elapsed(nowCycles, _lastClientPollCycle,
                                                          uniuno::asm_opt::ms_to_cycles(WS_SERVER_POLL_INTERVAL_MS)))) {

    for (uint8_t i = 0; i < clientCount;) {
      if (clients[i].available()) {
        clients[i].poll();
        ++i;
      } else {
        Serial.printf("[LocalWS] Client %d disconnected\n", i + 1);
        if (i < clientCount - 1) {
          const uint8_t lastIdx = clientCount - 1;
          clients[i] = std::move(clients[lastIdx]);
          clients[i].onMessage([this, i](websockets::WebsocketsMessage msg) { this->handleMessage(i, msg); });
          clients[i].onEvent(
              [this, i](websockets::WebsocketsEvent event, String data) { this->handleEvent(i, event, data); });
        }
        clientCount--;
      }
    }
  }
}

void AchaemenidWebSocketServer::handleMessage(uint8_t idx, websockets::WebsocketsMessage msg) {
  if (msg.isText()) {
    parser_.parseMessage(msg.data(), clients[idx]);
  }
}

void AchaemenidWebSocketServer::handleEvent(uint8_t idx, websockets::WebsocketsEvent event, String /*data*/) {
  if (event == websockets::WebsocketsEvent::ConnectionClosed) {
    Serial.printf("[LocalWS] Connection closed (slot %d)\n", idx + 1);
  }
}

void AchaemenidWebSocketServer::broadcastState(const String& stateJson) {
  broadcastState(stateJson.c_str());
}

void AchaemenidWebSocketServer::broadcastState(const char* stateJson) {
  for (uint8_t i = 0; i < clientCount; ++i) {
    if (clients[i].available()) {
      clients[i].send(stateJson);
    }
  }
}

} // namespace uniuno
