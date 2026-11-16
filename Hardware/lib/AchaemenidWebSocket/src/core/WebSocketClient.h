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
 */
class AchaemenidWebSocketClient {
public:
    AchaemenidWebSocketClient(IEventDispatcher* dispatcher, StateProvider stateProvider);
    ~AchaemenidWebSocketClient();

    void begin(const String& serverUrl);
    void stop();
    void sendText(const String& payload);
    void requestConfig();
    void syncPinState(int pin, bool state);

    FORCE_INLINE void setNetworkAvailable(bool available) { isNetworkAvailable_ = available; }
    FORCE_INLINE bool isNetworkAvailable() const { return isNetworkAvailable_; }

    HOT_PATH void loop();

private:
    void onMessageCallback(websockets::WebsocketsMessage message);
    void onEventsCallback(websockets::WebsocketsEvent event, String data);

    static void connectTask(void* param);
    void doConnect();

    websockets::WebsocketsClient* client_ = nullptr;
    WebSocketConfig config_;

    volatile bool isRunning_;
    volatile bool firstConnection_;
    volatile bool isNetworkAvailable_;
    portMUX_TYPE firstConnMux_ = portMUX_INITIALIZER_UNLOCKED;
    portMUX_TYPE clientMux_ = portMUX_INITIALIZER_UNLOCKED;

    unsigned long lastPingTime_ = 0;
    unsigned long lastPollTime_ = 0;
    volatile unsigned long lastConnectAttemptTime_ = 0;
    volatile unsigned long nextConnectAttemptTime_ = 0;
    volatile uint8_t consecutiveFailures_ = 0;
    volatile bool hasConnectAttempted_ = false;
    volatile bool isConnecting_ = false;
    TaskHandle_t connectTaskHandle_ = nullptr;
    IEventDispatcher* dispatcher_;
    StateProvider stateProvider_;
    WsClientParser parser_;
};

} // namespace uniuno
