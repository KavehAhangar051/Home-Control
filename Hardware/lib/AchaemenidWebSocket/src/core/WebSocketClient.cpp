#include "WebSocketClient.h"
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <tiny_websockets/network/generic_esp/generic_esp_clients.hpp>
#include <Optimization/CompilerTraits.h>
#include <utility>
#include "../parsers/WsClientParser.h"
#include <WiFi.h>

namespace uniuno {

// SSL client bypasses cert validation for embedded flexibility
class InsecureEsp32TcpClient : public websockets::network::GenericEspTcpClient<WiFiClientSecure> {
public:
    InsecureEsp32TcpClient() { client.setInsecure(); }
    ~InsecureEsp32TcpClient() { client.stop(); }
};

AchaemenidWebSocketClient::AchaemenidWebSocketClient(IEventDispatcher* dispatcher, StateProvider stateProvider)
    : isRunning_(false), firstConnection_(true), isNetworkAvailable_(false),
      nextConnectAttemptTime_(0), dispatcher_(dispatcher), stateProvider_(std::move(stateProvider)),
      parser_(dispatcher_)
{
    auto secureClient = std::make_shared<InsecureEsp32TcpClient>();
    client_ = new websockets::WebsocketsClient(secureClient);

    client_->onMessage([this](websockets::WebsocketsMessage msg) {
        this->onMessageCallback(msg);
    });
    client_->onEvent([this](websockets::WebsocketsEvent ev, String data) {
        this->onEventsCallback(ev, data);
    });
}

AchaemenidWebSocketClient::~AchaemenidWebSocketClient() {
    stop();
    if (connectTaskHandle_) {
        vTaskDelete(connectTaskHandle_);
        connectTaskHandle_ = nullptr;
    }
    if (client_) {
        delete client_;
        client_ = nullptr;
    }
}

void AchaemenidWebSocketClient::sendText(const String& payload) {
    if (UNLIKELY(isConnecting_ || client_ == nullptr)) return;
    
    portENTER_CRITICAL(&clientMux_);
    const bool canSend = (client_ != nullptr && client_->available());
    portEXIT_CRITICAL(&clientMux_);

    if (LIKELY(canSend)) {
        client_->send(payload);
    }
}

void AchaemenidWebSocketClient::requestConfig() {
    sendText("{\"type\":\"get_config\"}");
}

void AchaemenidWebSocketClient::syncPinState(int pin, bool state) {
    char payload[64];
    snprintf(payload, sizeof(payload), "{\"type\":\"sync_pin\",\"pin\":%d,\"state\":%s}", pin, state ? "true" : "false");
    sendText(payload);
}

void AchaemenidWebSocketClient::begin(const String& serverUrl) {
    if (UNLIKELY(isRunning_)) return;
    config_.serverUrl = serverUrl.c_str();
    isRunning_ = true;
    lastPingTime_ = 0;
    lastPollTime_ = 0;
    lastConnectAttemptTime_ = 0;
    nextConnectAttemptTime_ = 0;
    hasConnectAttempted_ = false;
    consecutiveFailures_ = 0;
    isNetworkAvailable_ = (WiFi.status() == WL_CONNECTED);
}

void AchaemenidWebSocketClient::stop() {
    isRunning_ = false;
    if (client_) {
        client_->close();
    }
}

void AchaemenidWebSocketClient::connectTask(void* param) {
    AchaemenidWebSocketClient* self = static_cast<AchaemenidWebSocketClient*>(param);
    self->doConnect();
    self->isConnecting_ = false;
    self->connectTaskHandle_ = nullptr;
    vTaskDelete(nullptr);
}

void AchaemenidWebSocketClient::doConnect() {
    Serial.println("[WebSocket] [Task] Connecting to Cloudflare Worker...");

    portENTER_CRITICAL(&clientMux_);
    websockets::WebsocketsClient* oldClient = client_;
    client_ = nullptr;
    portEXIT_CRITICAL(&clientMux_);

    if (oldClient) {
        oldClient->close();
        delete oldClient;
    }

    auto secureClient = std::make_shared<InsecureEsp32TcpClient>();
    websockets::WebsocketsClient* newClient = new websockets::WebsocketsClient(secureClient);

    newClient->onMessage([this](websockets::WebsocketsMessage msg) {
        this->onMessageCallback(msg);
    });
    newClient->onEvent([this](websockets::WebsocketsEvent ev, String data) {
        this->onEventsCallback(ev, data);
    });

    bool connected = false;
    if (config_.isValid()) {
        Serial.printf("[WebSocket] [Task] Connecting to configured URL: %s\n", config_.serverUrl.c_str());
        connected = newClient->connect(config_.serverUrl.c_str());
    } else {
        Serial.println("[WebSocket] [Task] Fallback: Connecting to default apii.agkalaa.ir");
        connected = newClient->connect("apii.agkalaa.ir", 443, "/ws");
    }

    portENTER_CRITICAL(&clientMux_);
    client_ = newClient;
    portEXIT_CRITICAL(&clientMux_);

    lastConnectAttemptTime_ = millis();
    hasConnectAttempted_ = true;

    if (LIKELY(connected)) {
        consecutiveFailures_ = 0;
        nextConnectAttemptTime_ = 0;
        Serial.println("[WebSocket] [Task] Connected successfully!");
        lastPingTime_ = lastConnectAttemptTime_;
    } else {
        if (consecutiveFailures_ < 255) ++consecutiveFailures_;
        const unsigned long retryDelay = consecutiveFailures_ >= WS_MAX_FAST_RETRIES
            ? WS_RETRY_DELAY_AFTER_MAX_FAILURES_MS
            : WS_RETRY_DELAY_MS;
        nextConnectAttemptTime_ = lastConnectAttemptTime_ + retryDelay;
        Serial.printf("[WebSocket] [Task] Connection failed (%u consecutive failures). Next retry in %lu ms.\n",
                      static_cast<unsigned int>(consecutiveFailures_), retryDelay);
    }
}

/**
 * @brief High-performance non-blocking loop with throttled adaptive polling.
 * Eliminates unconstrained socket polling and reduces 64-bit millis() division overhead.
 */
HOT_PATH void AchaemenidWebSocketClient::loop() {
    // Early exit if client is not enabled or currently connecting in background task
    if (UNLIKELY(!isRunning_ || !isNetworkAvailable_ || isConnecting_)) return;

    const unsigned long now = millis();

    if (client_ && LIKELY(client_->available())) {
        // Throttled socket polling to ~66 Hz (every 15ms)
        if (now - lastPollTime_ >= WS_CLIENT_POLL_INTERVAL_MS) {
            lastPollTime_ = now;
            client_->poll();

            if (UNLIKELY(now - lastPingTime_ >= WS_PING_INTERVAL_MS)) {
                client_->ping();
                lastPingTime_ = now;
            }
        }
        return;
    }

    // Single precomputed deadline subtraction (wrap-safe for millis rollover)
    if (hasConnectAttempted_ && static_cast<long>(now - nextConnectAttemptTime_) < 0) {
        return;
    }

    isConnecting_ = true;

    const BaseType_t taskResult = xTaskCreatePinnedToCore(
        AchaemenidWebSocketClient::connectTask,
        "wsConnect",
        WS_CONNECT_TASK_STACK,
        this,
        WS_CONNECT_TASK_PRIO,
        &connectTaskHandle_,
        WS_CONNECT_TASK_CORE
    );

    if (UNLIKELY(taskResult != pdPASS)) {
        lastConnectAttemptTime_ = millis();
        hasConnectAttempted_ = true;
        if (consecutiveFailures_ < 255) ++consecutiveFailures_;
        isConnecting_ = false;
        connectTaskHandle_ = nullptr;
        const unsigned long nextRetryDelay = consecutiveFailures_ >= WS_MAX_FAST_RETRIES
            ? WS_RETRY_DELAY_AFTER_MAX_FAILURES_MS
            : WS_RETRY_DELAY_MS;
        nextConnectAttemptTime_ = lastConnectAttemptTime_ + nextRetryDelay;
        Serial.printf("[WebSocket] Failed to create connection task (%u consecutive failures). Next retry in %lu ms.\n",
                      static_cast<unsigned int>(consecutiveFailures_), nextRetryDelay);
    }
}

void AchaemenidWebSocketClient::onMessageCallback(websockets::WebsocketsMessage message) {
    parser_.parseMessage(message);
}

void AchaemenidWebSocketClient::onEventsCallback(websockets::WebsocketsEvent event, String /*data*/) {
    if (event == websockets::WebsocketsEvent::ConnectionOpened) {
        bool isFirst;
        portENTER_CRITICAL(&firstConnMux_);
        isFirst = firstConnection_;
        if (firstConnection_) firstConnection_ = false;
        portEXIT_CRITICAL(&firstConnMux_);

        if (isFirst) {
            Serial.println("[WebSocket] Connection Opened (First). Requesting configuration and states...");
            sendText("{\"type\":\"get_all_states\"}");
        } else {
            Serial.println("[WebSocket] Connection Reopened. Requesting configuration and syncing local state...");
            sendText(stateProvider_ ? stateProvider_() : "{}");
        }
        requestConfig();
    } else if (event == websockets::WebsocketsEvent::ConnectionClosed) {
        Serial.println("[WebSocket] Connection Closed");
    }
}

} // namespace uniuno
