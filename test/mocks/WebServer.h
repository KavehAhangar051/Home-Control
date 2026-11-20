#pragma once
#include <Arduino.h>
#include <functional>

enum HTTPMethod { HTTP_GET = 0, HTTP_POST = 1 };

class WebServer {
public:
    explicit WebServer(uint16_t = 80) {}
    void on(const char*, HTTPMethod, std::function<void()>) {}
    void onNotFound(std::function<void()>) {}
    void begin() {}
    void handleClient() {}
    void send(int, const char*, const char*) {}
    void send(int, const char*, const String&) {}
    void sendHeader(const char*, const char*, bool = false) {}
    String arg(const char*) const { return String(""); }
};
