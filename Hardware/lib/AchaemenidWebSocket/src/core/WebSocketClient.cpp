#include "WebSocketClient.h"
#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <tiny_websockets/network/generic_esp/generic_esp_clients.hpp>
#include <Optimization/CompilerTraits.h>
#include <Timer/Optimization/TimerAsm.h>
#include <utility>
#include "WssUrlParser.h"
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
    : firstConnection_(true), nextConnectAttemptTime_(0), dispatcher_(dispatcher),
      stateProvider_(std::move(stateProvider)), parser_(dispatcher_) {}

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
  if (UNLIKELY((flags_ & FLAG_CONNECTING) || client_ == nullptr)) return;

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

void AchaemenidWebSocketClient::syncPinState(int pin, bool state, int16_t analogValue, uint8_t resolution) {
  char payload[96];
  if (analogValue >= 0) {
    snprintf(payload, sizeof(payload), "{\"type\":\"sync_pin\",\"pin\":%d,\"state\":%s,\"value\":%d,\"resolution\":%u}",
             pin, state ? "true" : "false", static_cast<int>(analogValue), static_cast<unsigned int>(resolution));
  } else {
    snprintf(payload, sizeof(payload), "{\"type\":\"sync_pin\",\"pin\":%d,\"state\":%s}", pin,
             state ? "true" : "false");
  }
  sendText(payload);
}

void AchaemenidWebSocketClient::begin(const String& serverUrl) {
  if (UNLIKELY(flags_ & FLAG_RUNNING)) return;
  config_.serverUrl = serverUrl.c_str();
  flags_ |= FLAG_RUNNING;
  lastPingTime_ = 0;
  lastPollCycle_ = uniuno::asm_opt::get_cpu_cycle_count() - uniuno::asm_opt::ms_to_cycles(50);
  lastConnectAttemptTime_ = 0;
  nextConnectAttemptTime_ = 0;
  hasConnectAttempted_ = false;
  consecutiveFailures_ = 0;
  if (WiFi.status() == WL_CONNECTED)
    flags_ |= FLAG_NETWORK;
  else
    flags_ &= ~FLAG_NETWORK;
}

void AchaemenidWebSocketClient::stop() {
  flags_ &= ~FLAG_RUNNING;
  if (client_) {
    client_->close();
  }
}

void AchaemenidWebSocketClient::connectTask(void* param) {
  AchaemenidWebSocketClient* self = static_cast<AchaemenidWebSocketClient*>(param);
  self->doConnect();
  self->flags_ &= ~FLAG_CONNECTING;
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

  newClient->onMessage([this](const websockets::WebsocketsMessage& msg) { this->onMessageCallback(msg); });
  newClient->onEvent([this](websockets::WebsocketsEvent ev, const String& data) { this->onEventsCallback(ev, data); });

#ifdef ESP32
  Serial.printf("[WebSocket] [Task] Free heap: %lu, Max alloc: %lu\n", static_cast<unsigned long>(ESP.getFreeHeap()),
                static_cast<unsigned long>(ESP.getMaxAllocHeap()));
#endif

  bool connected = false;
  if (config_.isValid()) {
    Serial.printf("[WebSocket] [Task] Connecting to configured URL: %s\n", config_.serverUrl.c_str());
    ParsedWssUrl parsed{};
    if (parseWssUrl(config_.serverUrl.c_str(), parsed)) {
      // Use 3-arg connect() so WebsocketsClient preserves InsecureEsp32TcpClient
      // instead of calling upgradeToSecuredConnection() and overwriting it.
      connected = newClient->connect(parsed.host, parsed.port, parsed.path);
    } else {
      connected = newClient->connect(config_.serverUrl.c_str());
    }
  } else {
    Serial.println("[WebSocket] [Task] Fallback: Connecting to default apii.agkalaa.ir");
    connected = newClient->connect("apii.agkalaa.ir", 443, "/ws");
  }

  lastConnectAttemptTime_ = millis();
  hasConnectAttempted_ = true;

  if (LIKELY(connected)) {
    portENTER_CRITICAL(&clientMux_);
    client_ = newClient;
    portEXIT_CRITICAL(&clientMux_);
    consecutiveFailures_ = 0;
    nextConnectAttemptTime_ = 0;
    Serial.println("[WebSocket] [Task] Connected successfully!");
    lastPingTime_ = lastConnectAttemptTime_;
  } else {
    // Release failed TLS/WebSocket client immediately so its heap is free before next retry.
    newClient->close();
    delete newClient;
    if (consecutiveFailures_ < 255) ++consecutiveFailures_;
    const unsigned long retryDelay =
        consecutiveFailures_ >= WS_MAX_FAST_RETRIES ? WS_RETRY_DELAY_AFTER_MAX_FAILURES_MS : WS_RETRY_DELAY_MS;
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
  // 1-cycle bitmask validation: must have FLAG_RUNNING and FLAG_NETWORK set, and FLAG_CONNECTING clear
  if (UNLIKELY((flags_ & (FLAGS_CAN_POLL | FLAG_CONNECTING)) != FLAGS_CAN_POLL)) return;

  if (client_ && LIKELY(client_->available())) {
    // 4-cycle CCOUNT hardware throttle (~66 Hz / 15ms) — zero millis() calls when idle!
    if (LIKELY(!uniuno::asm_opt::is_cycle_interval_elapsed(
            lastPollCycle_, uniuno::asm_opt::ms_to_cycles(WS_CLIENT_POLL_INTERVAL_MS)))) {
      return;
    }

    client_->poll();

    const unsigned long now = millis();
    if (UNLIKELY(uniuno::asm_opt::is_timer_expired(now, lastPingTime_ + WS_PING_INTERVAL_MS))) {
      client_->ping();
      lastPingTime_ = now;
    }
    return;
  }

  // Disconnected path: gate reconnect deadline check with 50ms CCOUNT throttle
  if (LIKELY(!uniuno::asm_opt::is_cycle_interval_elapsed(lastPollCycle_, uniuno::asm_opt::ms_to_cycles(50)))) {
    return;
  }

  // Branchless assembly expiration check (wrap-safe for millis rollover)
  const unsigned long now = millis();
  if (hasConnectAttempted_ && !uniuno::asm_opt::is_timer_expired(now, nextConnectAttemptTime_)) {
    return;
  }

  flags_ |= FLAG_CONNECTING;

  const BaseType_t taskResult =
      xTaskCreatePinnedToCore(AchaemenidWebSocketClient::connectTask, "wsConnect", WS_CONNECT_TASK_STACK, this,
                              WS_CONNECT_TASK_PRIO, &connectTaskHandle_, WS_CONNECT_TASK_CORE);

  if (UNLIKELY(taskResult != pdPASS)) {
    lastConnectAttemptTime_ = millis();
    hasConnectAttempted_ = true;
    if (consecutiveFailures_ < 255) ++consecutiveFailures_;
    flags_ &= ~FLAG_CONNECTING;
    connectTaskHandle_ = nullptr;
    const unsigned long nextRetryDelay =
        consecutiveFailures_ >= WS_MAX_FAST_RETRIES ? WS_RETRY_DELAY_AFTER_MAX_FAILURES_MS : WS_RETRY_DELAY_MS;
    nextConnectAttemptTime_ = lastConnectAttemptTime_ + nextRetryDelay;
    Serial.printf("[WebSocket] Failed to create connection task (%u consecutive failures). Next retry in %lu ms.\n",
                  static_cast<unsigned int>(consecutiveFailures_), nextRetryDelay);
  }
}

void AchaemenidWebSocketClient::onMessageCallback(const websockets::WebsocketsMessage& message) {
  parser_.parseMessage(message);
}

void AchaemenidWebSocketClient::onEventsCallback(websockets::WebsocketsEvent event, const String& /*data*/) {
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
