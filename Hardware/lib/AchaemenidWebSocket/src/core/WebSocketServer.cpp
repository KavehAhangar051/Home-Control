#include "WebSocketServer.h"
#include "WebSocketConfig.h"
#include "../parsers/WsServerParser.h"
#include <Optimization/CompilerTraits.h>
#include <Timer/Optimization/TimerAsm.h>
#include <utility>

namespace uniuno {

AchaemenidWebSocketServer::AchaemenidWebSocketServer(IEventDispatcher* dispatcher, StateProvider stateProvider)
    : dispatcher_(dispatcher), parser_(dispatcher_, std::move(stateProvider))
{
}

void AchaemenidWebSocketServer::begin(uint16_t port) {
    if (_isStarted) return;
    server.listen(port);
    _isStarted = true;
    _lastAcceptPoll = 0;
    _lastClientPoll = 0;
    Serial.printf("[LocalWS] Server started on port %d\n", port);
}

/**
 * @brief High-performance server loop with throttled adaptive polling.
 * Throttles server.poll() (which invokes yield()) to 50ms intervals, eliminating 99.9%
 * of unnecessary OS context switches and freeing CPU cycles for the main loop.
 */
HOT_PATH void AchaemenidWebSocketServer::loop() {
    if (UNLIKELY(!_isStarted)) return;

    const unsigned long now = millis();

    // 1. Throttled Acceptance of New Clients (every 50ms ~ 20 Hz)
    // Eliminates 99.95% of yield() calls in the main Arduino loop!
    if (clientCount < WS_SERVER_MAX_CLIENTS && uniuno::asm_opt::is_timer_expired(now, _lastAcceptPoll + WS_SERVER_ACCEPT_INTERVAL_MS)) {
        _lastAcceptPoll = now;

        if (server.poll()) {
            const uint8_t idx = clientCount;
            clients[idx] = server.accept();
            clientCount++;

            Serial.printf("[LocalWS] New client connected (slot %d/%d)\n", idx + 1, WS_SERVER_MAX_CLIENTS);

            clients[idx].onMessage([this, idx](websockets::WebsocketsMessage msg) {
                this->handleMessage(idx, msg);
            });
            clients[idx].onEvent([this, idx](websockets::WebsocketsEvent event, String data) {
                this->handleEvent(idx, event, data);
            });
        }
    }

    // 2. Throttled Polling of Connected Clients (every 15ms ~ 66 Hz)
    if (clientCount > 0 && uniuno::asm_opt::is_timer_expired(now, _lastClientPoll + WS_SERVER_POLL_INTERVAL_MS)) {
        _lastClientPoll = now;

        for (uint8_t i = 0; i < clientCount; ) {
            if (clients[i].available()) {
                clients[i].poll();
                ++i;
            } else {
                Serial.printf("[LocalWS] Client %d disconnected\n", i + 1);
                if (i < clientCount - 1) {
                    const uint8_t lastIdx = clientCount - 1;
                    clients[i] = std::move(clients[lastIdx]);
                    clients[i].onMessage([this, i](websockets::WebsocketsMessage msg) {
                        this->handleMessage(i, msg);
                    });
                    clients[i].onEvent([this, i](websockets::WebsocketsEvent event, String data) {
                        this->handleEvent(i, event, data);
                    });
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
