#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <cstdint>
#include <string>

enum class DNSReplyCode : uint16_t {
    NoError = 0,
    FormError = 1,
    ServerFailure = 2,
    NonExistentDomain = 3,
    NotImplemented = 4,
    Refused = 5
};

struct MockDnsState {
    bool running = false;
    uint16_t port = 0;
    std::string domain;
    IPAddress resolvedIp;
    uint32_t ttl = 60;
    DNSReplyCode errorReplyCode = DNSReplyCode::NonExistentDomain;
    uint32_t processCount = 0;

    void reset() {
        running = false;
        port = 0;
        domain.clear();
        resolvedIp = IPAddress{};
        ttl = 60;
        errorReplyCode = DNSReplyCode::NonExistentDomain;
        processCount = 0;
    }
};

inline MockDnsState& mockDnsState() {
    static MockDnsState instance;
    return instance;
}

class DNSServer {
public:
    void setErrorReplyCode(const DNSReplyCode& code) {
        mockDnsState().errorReplyCode = code;
    }
    void setTTL(const uint32_t& ttl) {
        mockDnsState().ttl = ttl;
    }
    bool start(uint16_t port, const String& domainName, const IPAddress& resolvedIP) {
        mockDnsState().running = true;
        mockDnsState().port = port;
        mockDnsState().domain = domainName.c_str();
        mockDnsState().resolvedIp = resolvedIP;
        return true;
    }
    void stop() {
        mockDnsState().running = false;
    }
    void processNextRequest() {
        if (mockDnsState().running) {
            mockDnsState().processCount++;
        }
    }
};
