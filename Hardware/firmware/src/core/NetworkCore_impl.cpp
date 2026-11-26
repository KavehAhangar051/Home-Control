// Custom compilation bridge for optimized Networking core (Arduino-ESP32 Core v3+)
#include <Arduino.h> // IWYU pragma: keep
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
#include <NetworkEvents.cpp>
#include <NetworkInterface.cpp>
#include <NetworkManager.cpp>
#include <NetworkClient.cpp>
#include <NetworkUdp.cpp>
#include <NetworkServer.cpp>
#endif
