#pragma once
#include <Arduino.h>
#include <cstdint>
#include <cstdio>
#include <string>

enum wl_status_t { WL_DISCONNECTED = 6, WL_CONNECTED = 3 };
enum wifi_mode_t { WIFI_OFF = 0, WIFI_STA = 1, WIFI_AP = 2, WIFI_AP_STA = 3 };
enum wifi_auth_mode_t { WIFI_AUTH_OPEN = 0, WIFI_AUTH_WPA2_PSK = 3 };

struct IPAddress {
    uint8_t octets[4]{127, 0, 0, 1};
    IPAddress() = default;
    IPAddress(uint8_t a, uint8_t b, uint8_t c, uint8_t d) : octets{a, b, c, d} {}
    uint8_t operator[](int idx) const { return (idx >= 0 && idx < 4) ? octets[idx] : 0; }
    String toString() const {
        char buf[20];
        snprintf(buf, sizeof(buf), "%u.%u.%u.%u", octets[0], octets[1], octets[2], octets[3]);
        return String(buf);
    }
};

class WiFiClass {
public:
    wl_status_t mockStatus = WL_DISCONNECTED;
    wifi_mode_t mockMode = WIFI_OFF;
    std::string mockHostname;
    std::string mockApSsid;
    std::string mockApPass;
    bool mockApActive = false;
    uint8_t mockApStationNum = 0;
    IPAddress mockLocalIp{192, 168, 1, 50};
    IPAddress mockApIp{192, 168, 4, 1};

    void resetMock() {
        mockStatus = WL_DISCONNECTED;
        mockMode = WIFI_OFF;
        mockHostname.clear();
        mockApSsid.clear();
        mockApPass.clear();
        mockApActive = false;
        mockApStationNum = 0;
        mockLocalIp = IPAddress(192, 168, 1, 50);
        mockApIp = IPAddress(192, 168, 4, 1);
    }

    wl_status_t status() const { return mockStatus; }
    bool isConnected() const { return mockStatus == WL_CONNECTED; }
    bool mode(wifi_mode_t m) {
        mockMode = m;
        return true;
    }
    wifi_mode_t getMode() const { return mockMode; }
    bool setHostname(const char* name) {
        mockHostname = name ? name : "";
        return true;
    }
    bool softAPsetHostname(const char* name) {
        mockHostname = name ? name : "";
        return true;
    }
    bool disconnect(bool /*wifioff*/ = false, bool /*eraseap*/ = false) {
        mockStatus = WL_DISCONNECTED;
        return true;
    }
    String macAddress() const { return String("AA:BB:CC:DD:EE:FF"); }
    bool softAPConfig(IPAddress local_ip, IPAddress /*gateway*/, IPAddress /*subnet*/) {
        mockApIp = local_ip;
        return true;
    }
    bool softAP(const char* ssid, const char* pass = nullptr) {
        mockApSsid = ssid ? ssid : "";
        mockApPass = pass ? pass : "";
        mockApActive = true;
        return true;
    }
    bool softAPdisconnect(bool /*wifioff*/ = false) {
        mockApActive = false;
        return true;
    }
    uint8_t softAPgetStationNum() const { return mockApStationNum; }
    IPAddress softAPIP() const { return mockApIp; }
    IPAddress localIP() const { return mockLocalIp; }
    String SSID() const { return String("MockHomeWiFi"); }
    int16_t scanNetworks(bool /*async*/ = false, bool /*show_hidden*/ = false) { return 0; }
    String SSID(uint8_t /*i*/) const { return String(""); }
    int32_t RSSI(uint8_t /*i*/) const { return -60; }
    wifi_auth_mode_t encryptionType(uint8_t /*i*/) const { return WIFI_AUTH_WPA2_PSK; }
    void scanDelete() {}
};

inline WiFiClass& getMockWiFi() {
    static WiFiClass instance;
    return instance;
}
#define WiFi (getMockWiFi())
