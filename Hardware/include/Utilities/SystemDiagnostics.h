#pragma once

#include <cstddef>
#include <cstdint>
#include <cstdio>

namespace uniuno {
namespace diagnostics {

/**
 * @brief Maps ESP-IDF esp_reset_reason_t numeric codes to concise diagnostic labels.
 * Pure function with no hardware dependencies so native unit tests can verify every code.
 */
inline const char* resetReasonToString(int reason) {
  switch (reason) {
  case 1: // ESP_RST_POWERON
    return "poweron";
  case 2: // ESP_RST_EXT
    return "ext";
  case 3: // ESP_RST_SW
    return "sw";
  case 4: // ESP_RST_PANIC
    return "panic";
  case 5: // ESP_RST_INT_WDT
    return "int_wdt";
  case 6: // ESP_RST_TASK_WDT
    return "task_wdt";
  case 7: // ESP_RST_WDT
    return "wdt";
  case 8: // ESP_RST_DEEPSLEEP
    return "deepsleep";
  case 9: // ESP_RST_BROWNOUT
    return "brownout";
  case 10: // ESP_RST_SDIO
    return "sdio";
  case 11: // ESP_RST_USB
    return "usb";
  case 0: // ESP_RST_UNKNOWN
  default:
    return "unknown";
  }
}

/**
 * @brief Formats the retained MQTT /Status online payload into a fixed caller buffer.
 * Preserves backward-compatible "status" and "ip" fields while adding "resetReason" and "minFreeHeap".
 * @return Number of characters written (excluding NUL terminator).
 */
inline size_t formatMqttOnlineStatusJson(char* outBuf, size_t outBufSize, uint8_t ip0, uint8_t ip1, uint8_t ip2,
                                         uint8_t ip3, const char* resetReason, uint32_t minFreeHeap) {
  if (outBuf == nullptr || outBufSize == 0) return 0;
  const char* reason = (resetReason != nullptr && resetReason[0] != '\0') ? resetReason : "unknown";
  const int written = std::snprintf(
      outBuf, outBufSize, "{\"status\":\"online\",\"ip\":\"%u.%u.%u.%u\",\"resetReason\":\"%s\",\"minFreeHeap\":%lu}",
      static_cast<unsigned int>(ip0), static_cast<unsigned int>(ip1), static_cast<unsigned int>(ip2),
      static_cast<unsigned int>(ip3), reason, static_cast<unsigned long>(minFreeHeap));
  if (written < 0) {
    outBuf[0] = '\0';
    return 0;
  }
  const size_t maxLen = outBufSize - 1;
  return (static_cast<size_t>(written) > maxLen) ? maxLen : static_cast<size_t>(written);
}

/**
 * @brief Pure state gate for OTA rollback confirmation.
 * Ensures a newly flashed OTA image stays alive and network-healthy for minStableMs
 * before calling esp_ota_mark_app_valid_cancel_rollback().
 */
class OtaHealthGate {
public:
  void begin(uint32_t bootMs, uint32_t minStableMs = 30000U) {
    bootMs_ = bootMs;
    minStableMs_ = minStableMs;
    initialized_ = true;
    confirmed_ = false;
  }

  bool isInitialized() const { return initialized_; }
  bool isConfirmed() const { return confirmed_; }

  bool shouldConfirm(uint32_t nowMs, bool networkConnected) const {
    if (!initialized_ || confirmed_ || !networkConnected) {
      return false;
    }
    return (nowMs - bootMs_) >= minStableMs_;
  }

  void markConfirmed() { confirmed_ = true; }

private:
  uint32_t bootMs_ = 0;
  uint32_t minStableMs_ = 30000U;
  bool initialized_ = false;
  bool confirmed_ = false;
};

} // namespace diagnostics
} // namespace uniuno
