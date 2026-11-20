#pragma once
#include <Arduino.h>

enum wl_status_t { WL_DISCONNECTED = 6, WL_CONNECTED = 3 };
enum wifi_mode_t { WIFI_OFF = 0, WIFI_STA = 1, WIFI_AP = 2, WIFI_AP_STA = 3 };

struct IPAddress {
    uint8_t octets[4]{127, 0, 0, 1};
    uint8_t operator[](int idx) const { return (idx >= 0 && idx < 4) ? octets[idx] : 0; }
};

class WiFiClass {
public:
    wl_status_t status() const { return WL_DISCONNECTED; }
    bool isConnected() const { return false; }
    bool mode(wifi_mode_t) { return true; }
    String macAddress() const { return String("AA:BB:CC:DD:EE:FF"); }
    bool softAP(const char*, const char* = nullptr) { return true; }
    IPAddress localIP() const { return IPAddress{}; }
};

inline WiFiClass& getMockWiFi() {
    static WiFiClass instance;
    return instance;
}
#define WiFi (getMockWiFi())
