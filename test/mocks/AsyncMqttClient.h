#pragma once
#include <Arduino.h>
#include <functional>

enum class AsyncMqttClientDisconnectReason : int8_t { TCP_DISCONNECTED = 0 };
struct AsyncMqttClientMessageProperties {
    uint8_t qos = 0;
    bool dup = false;
    bool retain = false;
};

class AsyncMqttClient {
public:
    void onConnect(std::function<void(bool)>) {}
    void onDisconnect(std::function<void(AsyncMqttClientDisconnectReason)>) {}
    void onMessage(std::function<void(char*, char*, AsyncMqttClientMessageProperties, size_t, size_t, size_t)>) {}
    void setServer(const char*, uint16_t) {}
    void setCredentials(const char*, const char*) {}
    void setClientId(const char*) {}
    void setWill(const char*, uint8_t, bool, const char*) {}
    void setKeepAlive(uint16_t) {}
    void connect() {}
    bool connected() const { return false; }
    uint16_t subscribe(const char*, uint8_t) { return 1; }
    uint16_t publish(const char*, uint8_t, bool, const char* = nullptr, size_t = 0) { return 1; }
};
