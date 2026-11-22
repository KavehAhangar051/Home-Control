#pragma once
#include <Arduino.h>
#include <functional>
#include <map>
#include <string>
#include <utility>

enum HTTPMethod { HTTP_GET = 0, HTTP_POST = 1, HTTP_ANY = 2 };

class WebServer {
public:
    struct Response {
        int code = 0;
        std::string contentType;
        std::string body;
        std::map<std::string, std::string> headers;
    };

    explicit WebServer(uint16_t = 80) {}

    void on(const char* path, HTTPMethod method, std::function<void()> handler) {
        routes_[{path ? path : "", method}] = std::move(handler);
    }
    void onNotFound(std::function<void()> handler) {
        notFoundHandler_ = std::move(handler);
    }
    void begin() { started_ = true; }
    void stop() { started_ = false; }
    void handleClient() { handleClientCount_++; }

    void send(int code, const char* contentType, const char* content) {
        lastResponse_.code = code;
        lastResponse_.contentType = contentType ? contentType : "";
        lastResponse_.body = content ? content : "";
    }
    void send(int code, const char* contentType, const String& content) {
        send(code, contentType, content.c_str());
    }
    void sendHeader(const char* name, const char* value, bool = false) {
        if (name) {
            lastResponse_.headers[name] = value ? value : "";
        }
    }
    void sendHeader(const char* name, const String& value, bool first = false) {
        sendHeader(name, value.c_str(), first);
    }
    String arg(const char* name) const {
        if (!name) return String("");
        auto it = args_.find(name);
        return it == args_.end() ? String("") : String(it->second.c_str());
    }
    bool hasArg(const char* name) const {
        return name != nullptr && args_.find(name) != args_.end();
    }
    String uri() const { return String(currentUri_.c_str()); }
    String hostHeader() const { return String(currentHost_.c_str()); }

    // Native test inspection & simulation helpers
    bool isStarted() const { return started_; }
    uint32_t handleClientCount() const { return handleClientCount_; }
    const Response& lastResponse() const { return lastResponse_; }

    void simulateRequest(
        HTTPMethod method,
        const char* path,
        const char* host = "",
        const std::map<std::string, std::string>& formArgs = {}
    ) {
        lastResponse_ = Response{};
        currentUri_ = path ? path : "/";
        currentHost_ = host ? host : "";
        args_ = formArgs;

        auto it = routes_.find({currentUri_, method});
        if (it == routes_.end()) {
            it = routes_.find({currentUri_, HTTP_ANY});
        }
        if (it != routes_.end() && it->second) {
            it->second();
        } else if (notFoundHandler_) {
            notFoundHandler_();
        }
    }

private:
    bool started_ = false;
    uint32_t handleClientCount_ = 0;
    std::string currentUri_ = "/";
    std::string currentHost_;
    std::map<std::string, std::string> args_;
    std::map<std::pair<std::string, HTTPMethod>, std::function<void()>> routes_;
    std::function<void()> notFoundHandler_;
    Response lastResponse_;
};
