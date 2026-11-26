// Custom compilation bridge for optimized WiFi library located in include/WiFi (Arduino-ESP32 Core v3+)
#include <Arduino.h> // IWYU pragma: keep
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
#include <WiFi.cpp>
#include <WiFiAP.cpp>
#include <WiFiGeneric.cpp>
#include <WiFiMulti.cpp>
#include <WiFiScan.cpp>
#include <WiFiSTA.cpp>
#include <AP.cpp>
#include <STA.cpp>
#endif
