#include "WebSocketClient.h"
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <tiny_websockets/network/generic_esp/generic_esp_clients.hpp>
#include <Optimization/CompilerTraits.h>
#include <utility>
#include "../parsers/WsClientParser.h"


namespace uniuno {

// SSL client bypasses cert validation
class InsecureEsp32TcpClient : public websockets::network::GenericEspTcpClient<WiFiClientSecure> {
public:
    InsecureEsp32TcpClient() { client.setInsecure(); }
    ~InsecureEsp32TcpClient() { client.stop(); }
};

AchaemenidWebSocketClient::AchaemenidWebSocketClient(IEventDispatcher* dispatcher, StateProvider stateProvider)
    : isRunning_(false), firstConnection_(true), dispatcher_(dispatcher), stateProvider_(std::move(stateProvider))
{
    parser_ = new WsClientParser(dispatcher_);
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
    if (parser_) {
        delete parser_;
        parser_ = nullptr;
    }
}

void AchaemenidWebSocketClient::sendText(const String& payload) {
    if (client_ && LIKELY(client_->available())) {
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
    lastConnectAttemptTime_ = 0;
    hasConnectAttempted_ = false;
    consecutiveFailures_ = 0;
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

    if (client_) {
        client_->close();
        delete client_;
        client_ = nullptr;
    }

    auto secureClient = std::make_shared<InsecureEsp32TcpClient>();
    client_ = new websockets::WebsocketsClient(secureClient);

    client_->onMessage([this](websockets::WebsocketsMessage msg) {
        this->onMessageCallback(msg);
    });
    client_->onEvent([this](websockets::WebsocketsEvent ev, String data) {
        this->onEventsCallback(ev, data);
    });

    const bool connected = client_->connect("apii.agkalaa.ir", 443, "/ws");

    lastConnectAttemptTime_ = millis();
    hasConnectAttempted_ = true;

    if (LIKELY(connected)) {
        consecutiveFailures_ = 0;
        Serial.println("[WebSocket] [Task] Connected successfully!");
        lastPingTime_ = lastConnectAttemptTime_;
    } else {
        if (consecutiveFailures_ < 255) ++consecutiveFailures_;
        const unsigned long retryDelay = consecutiveFailures_ >= WS_MAX_FAST_RETRIES
            ? WS_RETRY_DELAY_AFTER_MAX_FAILURES_MS
            : WS_RETRY_DELAY_MS;
        Serial.printf("[WebSocket] [Task] Connection failed (%u consecutive failures). Next retry in %lu ms.\n",
                      static_cast<unsigned int>(consecutiveFailures_), retryDelay);
    }
}

IRAM_ATTR void AchaemenidWebSocketClient::loop() {
    if (UNLIKELY(!isRunning_ || WiFi.status() != WL_CONNECTED || isConnecting_)) return;

    const unsigned long now = millis();

    if (client_ && LIKELY(client_->available())) {
        client_->poll();
        if (UNLIKELY(now - lastPingTime_ >= WS_PING_INTERVAL_MS)) {
            client_->ping();
            lastPingTime_ = now;
        }
        return;
    }

    // Do not spawn a new connection task on every Arduino loop iteration.
    // The timestamp check is wrap-safe for millis() rollover.
    const unsigned long retryDelay = consecutiveFailures_ >= WS_MAX_FAST_RETRIES
        ? WS_RETRY_DELAY_AFTER_MAX_FAILURES_MS
        : WS_RETRY_DELAY_MS;
    if (hasConnectAttempted_ &&
        (now - lastConnectAttemptTime_ < retryDelay)) {
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
        Serial.printf("[WebSocket] Failed to create connection task (%u consecutive failures). Next retry in %lu ms.\n",
                      static_cast<unsigned int>(consecutiveFailures_), nextRetryDelay);
    }
}

void AchaemenidWebSocketClient::onMessageCallback(websockets::WebsocketsMessage message) {
    if (parser_) {
        parser_->parseMessage(message);
    }
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
