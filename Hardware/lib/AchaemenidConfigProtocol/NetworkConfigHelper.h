#ifndef NETWORK_CONFIG_HELPER_H
#define NETWORK_CONFIG_HELPER_H

#include <stddef.h>
#include <stdint.h>
#include <string.h>

namespace uniuno {
namespace net_config {

constexpr int kDefaultMqttPort = 1883;
constexpr int kDefaultMqttQos  = 1;
constexpr uint32_t kMaxMqttReconnectDelayMs = 60000UL;

/**
 * @brief Validates IEEE 802.11 Wi-Fi SSID length (1..32 UTF-8/raw bytes).
 */
inline bool isValidWifiSsid(const char* ssid) {
    if (ssid == nullptr) return false;
    const size_t len = strlen(ssid);
    return len >= 1 && len <= 32;
}

/**
 * @brief Validates IEEE 802.11 / WPA2-PSK passphrase.
 * Empty (nullptr or "") is valid for open networks (STA only); otherwise 8..63 bytes.
 */
inline bool isValidWifiPassword(const char* password) {
    if (password == nullptr || password[0] == '\0') return true;
    const size_t len = strlen(password);
    return len >= 8 && len <= 63;
}

/**
 * @brief Validates a STA Wi-Fi credential pair.
 */
inline bool isValidWifiCredential(const char* ssid, const char* password) {
    return isValidWifiSsid(ssid) && isValidWifiPassword(password);
}

/**
 * @brief Validates a SoftAP provisioning credential pair.
 * Custom APs always require both non-empty SSID (1..32 bytes) and WPA2 passphrase (8..63 bytes).
 */
inline bool isValidSoftApCredential(const char* ssid, const char* password) {
    if (!isValidWifiSsid(ssid)) return false;
    if (password == nullptr) return false;
    const size_t passLen = strlen(password);
    return passLen >= 8 && passLen <= 63;
}

/**
 * @brief Clamps/sanitizes an MQTT TCP port to valid range [1..65535], defaulting to 1883.
 */
inline int sanitizeMqttPort(int rawPort) {
    return (rawPort >= 1 && rawPort <= 65535) ? rawPort : kDefaultMqttPort;
}

/**
 * @brief Clamps/sanitizes MQTT QoS level to [0..2], defaulting to 1.
 */
inline int sanitizeMqttQos(int rawQos) {
    return (rawQos >= 0 && rawQos <= 2) ? rawQos : kDefaultMqttQos;
}

/**
 * @brief Validates an MQTT broker hostname or IP (non-empty, 1..63 bytes, no whitespace/wildcards).
 */
inline bool isValidMqttHost(const char* host) {
    if (host == nullptr) return false;
    const size_t len = strlen(host);
    if (len == 0 || len > 63) return false;
    for (size_t i = 0; i < len; ++i) {
        const unsigned char c = static_cast<unsigned char>(host[i]);
        if (c <= 0x20 || c == 0x7F || c == '#' || c == '+') {
            return false;
        }
    }
    return true;
}

/**
 * @brief Trims whitespace and trailing '/' characters from an MQTT base topic into outBuf.
 * Rejects topics containing MQTT wildcard chars ('+', '#') or empty result.
 * Returns true if normalized topic is valid (1..63 bytes).
 */
inline bool normalizeMqttBaseTopic(const char* rawTopic, char* outBuf, size_t outSize) {
    if (outBuf == nullptr || outSize == 0) return false;
    outBuf[0] = '\0';
    if (rawTopic == nullptr) return false;

    const char* start = rawTopic;
    while (*start == ' ' || *start == '\t' || *start == '\r' || *start == '\n' || *start == '/') {
        ++start;
    }

    size_t len = strlen(start);
    while (len > 0 && (start[len - 1] == ' ' || start[len - 1] == '\t' ||
                       start[len - 1] == '\r' || start[len - 1] == '\n' ||
                       start[len - 1] == '/')) {
        --len;
    }

    if (len == 0 || len >= outSize || len > 63) {
        return false;
    }

    for (size_t i = 0; i < len; ++i) {
        const unsigned char c = static_cast<unsigned char>(start[i]);
        if (c < 0x20 || c == 0x7F || c == '+' || c == '#') {
            outBuf[0] = '\0';
            return false;
        }
        outBuf[i] = static_cast<char>(c);
    }
    outBuf[len] = '\0';
    return true;
}

/**
 * @brief Computes capped exponential backoff delay (ms) for MQTT reconnection attempts.
 * Attempt 1 -> 1000ms, 2 -> 2000ms, 3 -> 4000ms, 4 -> 8000ms, 5 -> 16000ms, 6 -> 32000ms, >=7 -> 60000ms.
 */
inline uint32_t computeMqttReconnectDelayMs(uint8_t retryAttempt) {
    if (retryAttempt <= 1) return 1000UL;
    if (retryAttempt >= 7) return kMaxMqttReconnectDelayMs;
    const uint32_t delayMs = 1000UL << static_cast<uint32_t>(retryAttempt - 1);
    return delayMs > kMaxMqttReconnectDelayMs ? kMaxMqttReconnectDelayMs : delayMs;
}

/**
 * @brief Safely copies a C-string into a fixed buffer and guarantees null-termination.
 */
inline void copySafeString(char* dst, size_t dstSize, const char* src) {
    if (dst == nullptr || dstSize == 0) return;
    if (src == nullptr) {
        dst[0] = '\0';
        return;
    }
    size_t i = 0;
    for (; i + 1 < dstSize && src[i] != '\0'; ++i) {
        dst[i] = src[i];
    }
    dst[i] = '\0';
}

} // namespace net_config
} // namespace uniuno

#endif // NETWORK_CONFIG_HELPER_H
