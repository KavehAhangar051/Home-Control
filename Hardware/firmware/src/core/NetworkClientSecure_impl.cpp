// Custom compilation bridge for optimized NetworkClientSecure (Arduino-ESP32 Core v3+)
#include <Arduino.h> // IWYU pragma: keep
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
#include <NetworkClientSecure.cpp>
#include <ssl_client.cpp>
#endif
