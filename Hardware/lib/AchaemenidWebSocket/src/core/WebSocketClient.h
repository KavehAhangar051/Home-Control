#pragma once

#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <ArduinoWebsockets.h>
#include <Events/IEventDispatcher.h>
#include <Optimization/CompilerTraits.h>
#include "WebSocketConfig.h"
#include "../parsers/WsClientParser.h"

namespace uniuno {

/**
 * @brief Manages secure TLS WebSocket connection to Cloudflare Worker with background task connecting.
 * Uses packed bitmask flags for 1-cycle status validation in loop().
 */
class AchaemenidWebSocketClient {
public:
  static constexpr uint8_t FLAG_RUNNING = 0x01;
  static constexpr uint8_t FLAG_NETWORK = 0x02;
  static constexpr uint8_t FLAG_CONNECTING = 0x04;
  static constexpr uint8_t FLAGS_CAN_POLL = FLAG_RUNNING | FLAG_NETWORK;

  AchaemenidWebSocketClient(IEventDispatcher* dispatcher, StateProvider stateProvider);
  ~AchaemenidWebSocketClient();

  void begin(const String& serverUrl);
  void stop();
  void sendText(const String& payload);
  void requestConfig();
  void syncPinState(int pin, bool state, int16_t analogValue = -1, uint8_t resolution = 0);

  FORCE_INLINE void setNetworkAvailable(bool available) {
    if (available)
      flags_ |= FLAG_NETWORK;
    else
      flags_ &= ~FLAG_NETWORK;
  }
  FORCE_INLINE bool isNetworkAvailable() const { return (flags_ & FLAG_NETWORK) != 0; }

  HOT_PATH void loop();

private:
  void onMessageCallback(websockets::WebsocketsMessage message);
  void onEventsCallback(websockets::WebsocketsEvent event, String data);

  static void connectTask(void* param);
  void doConnect();

  websockets::WebsocketsClient* client_ = nullptr;
  WebSocketConfig config_;

  volatile uint8_t flags_ = 0;
  volatile bool firstConnection_;
  portMUX_TYPE firstConnMux_ = portMUX_INITIALIZER_UNLOCKED;
  portMUX_TYPE clientMux_ = portMUX_INITIALIZER_UNLOCKED;

  unsigned long lastPingTime_ = 0;
  uint32_t lastPollCycle_ = 0;
  volatile unsigned long lastConnectAttemptTime_ = 0;
  volatile unsigned long nextConnectAttemptTime_ = 0;
  volatile uint8_t consecutiveFailures_ = 0;
  volatile bool hasConnectAttempted_ = false;
  TaskHandle_t connectTaskHandle_ = nullptr;
  IEventDispatcher* dispatcher_;
  StateProvider stateProvider_;
  WsClientParser parser_;
};

} // namespace uniuno
