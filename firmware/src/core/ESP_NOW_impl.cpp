// Custom compilation bridge for optimized ESP_NOW library located in include/ESP_NOW
// Controlled centrally via ACHAEMENID_ENABLE_ESP_NOW in include/ProjectConfig.h (default 0).
#include <ProjectConfig.h>
#if ACHAEMENID_ENABLE_ESP_NOW
#include <ESP32_NOW.cpp>
#include <ESP32_NOW_Serial.cpp>
#endif
