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
    std::function<void(bool)> onConnectCb;
    std::function<void(AsyncMqttClientDisconnectReason)> onDisconnectCb;
    std::string mockServer;
    uint16_t mockPort = 0;
    std::string mockUser;
    std::string mockPass;
    std::string mockWillTopic;
    uint8_t mockWillQos = 0;
    std::string mockLastSubscribedTopic;
    bool mockConnected = false;
    int connectCallCount = 0;
    int disconnectCallCount = 0;
    int subscribeCallCount = 0;

    void onConnect(std::function<void(bool)> cb) { onConnectCb = std::move(cb); }
    void onDisconnect(std::function<void(AsyncMqttClientDisconnectReason)> cb) { onDisconnectCb = std::move(cb); }
    void onMessage(std::function<void(char*, char*, AsyncMqttClientMessageProperties, size_t, size_t, size_t)>) {}
    void setServer(const char* h, uint16_t p) { mockServer = h ? h : ""; mockPort = p; }
    void setCredentials(const char* u, const char* p) { mockUser = u ? u : ""; mockPass = p ? p : ""; }
    void setClientId(const char*) {}
    void setWill(const char* t, uint8_t q, bool, const char*) { mockWillTopic = t ? t : ""; mockWillQos = q; }
    void setKeepAlive(uint16_t) {}
    void connect() { ++connectCallCount; }
    void disconnect(bool = false) {
        ++disconnectCallCount;
        if (mockConnected) {
            mockConnected = false;
            if (onDisconnectCb) {
                onDisconnectCb(AsyncMqttClientDisconnectReason::TCP_DISCONNECTED);
            }
        }
    }
    bool connected() const { return mockConnected; }
    uint16_t subscribe(const char* t, uint8_t) {
        mockLastSubscribedTopic = t ? t : "";
        ++subscribeCallCount;
        return 1;
    }
    uint16_t publish(const char*, uint8_t, bool, const char* = nullptr, size_t = 0) { return 1; }
};
