#pragma once
#include <Arduino.h>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

struct MockMdnsService {
    std::string service;
    std::string proto;
    uint16_t port;
};

struct MockMdnsState {
    bool started = false;
    std::string hostname;
    std::string instanceName;
    std::vector<MockMdnsService> services;
    std::vector<std::pair<std::string, std::string>> txtRecords;

    void reset() {
        started = false;
        hostname.clear();
        instanceName.clear();
        services.clear();
        txtRecords.clear();
    }
};

inline MockMdnsState& mockMdnsState() {
    static MockMdnsState instance;
    return instance;
}

class MDNSResponder {
public:
    bool begin(const char* hostName) {
        mockMdnsState().started = true;
        mockMdnsState().hostname = hostName ? hostName : "";
        return true;
    }
    bool begin(const String& hostName) {
        return begin(hostName.c_str());
    }
    void end() {
        mockMdnsState().started = false;
        mockMdnsState().services.clear();
        mockMdnsState().txtRecords.clear();
    }
    void setInstanceName(const char* name) {
        mockMdnsState().instanceName = name ? name : "";
    }
    void setInstanceName(const String& name) {
        setInstanceName(name.c_str());
    }
    bool addService(const char* service, const char* proto, uint16_t port) {
        mockMdnsState().services.push_back({service ? service : "", proto ? proto : "", port});
        return true;
    }
    void addServiceTxt(const char* /*name*/, const char* /*proto*/, const char* key, const char* value) {
        mockMdnsState().txtRecords.push_back({key ? key : "", value ? value : ""});
    }
};

inline MDNSResponder& getMockMdns() {
    static MDNSResponder instance;
    return instance;
}

#define MDNS (getMockMdns())
