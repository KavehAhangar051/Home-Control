#pragma once
#include <Arduino.h>
#include <functional>
#include <memory>
#include <vector>
#include <tiny_websockets/network/generic_esp/generic_esp_clients.hpp>

namespace websockets {

enum class WebsocketsEvent {
    ConnectionOpened,
    ConnectionClosed,
    GotPing,
    GotPong
};

class WebsocketsMessage {
public:
    WebsocketsMessage() = default;
    WebsocketsMessage(std::string payload, bool binary)
        : _payload(std::move(payload)), _binary(binary) {}

    bool isBinary() const { return _binary; }
    bool isText() const { return !_binary; }
    const char* c_str() const { return _payload.data(); }
    size_t length() const { return _payload.size(); }
    String data() const { return String(_payload); }

private:
    std::string _payload;
    bool _binary = false;
};

class WebsocketsClient {
public:
    WebsocketsClient() = default;
    explicit WebsocketsClient(std::shared_ptr<network::TcpClient>) {}
    bool send(const String& msg) {
        sentMessages.push_back(msg);
        return true;
    }
    bool send(const char* msg) {
        sentMessages.push_back(String(msg ? msg : ""));
        return true;
    }
    bool sendBinary(const char*, size_t) { return true; }
    bool available(bool = false) const { return connected; }
    void poll() {}
    void close() { connected = false; }
    void setInsecure() {}
    bool connect(const String&) { connected = true; return true; }
    bool connect(const char*, int, const char*) { connected = true; return true; }
    bool ping() { return true; }

    void onMessage(std::function<void(WebsocketsMessage)>) {}
    void onEvent(std::function<void(WebsocketsEvent, String)>) {}

    bool connected = true;
    std::vector<String> sentMessages;
};

class WebsocketsServer {
public:
    void listen(uint16_t) {}
    bool poll() { return false; }
    WebsocketsClient accept() { return WebsocketsClient{}; }
};

} // namespace websockets
