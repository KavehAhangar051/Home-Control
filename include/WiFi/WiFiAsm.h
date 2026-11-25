/**
 * @file WiFiAsm.h
 * @brief Low-level Xtensa LX6 hardware-aligned bitwise & zero-branch optimizations for WiFi.
 *
 * Provides branchless reason-code bitmasks, fast hex-nibble MAC formatting (replacing heavy snprintf),
 * branchless 6-byte BSSID equality, and single-instruction 32-bit IPv4 subnet/CIDR math.
 */

#pragma once

#include <stdint.h>
#include <stddef.h>
#include <esp_wifi_types.h>
#include <Optimization/CompilerTraits.h>

namespace wifi_asm {

/**
 * @brief Fast zero-printf 6-byte MAC address formatter ("AA:BB:CC:DD:EE:FF").
 * Eliminates stdio snprintf overhead and Flash format-string bloat.
 *
 * @param mac Pointer to 6-byte MAC/BSSID array
 * @param out Output buffer (must be at least 18 bytes)
 * @return Pointer to out buffer
 */
FORCE_INLINE char *formatMacStr(const uint8_t mac[6], char out[18]) {
  static constexpr char kHex[] = "0123456789ABCDEF";
  char *dst = out;
  for (int i = 0; i < 6; ++i) {
    const uint8_t b = mac[i];
    *dst++ = kHex[(b >> 4) & 0x0F];
    *dst++ = kHex[b & 0x0F];
    *dst++ = (i < 5) ? ':' : '\0';
  }
  return out;
}

/**
 * @brief Branchless 6-byte MAC/BSSID equality test.
 * Avoids generic memcmp function-call overhead on short 6-byte addresses.
 *
 * @param a First 6-byte MAC buffer
 * @param b Second 6-byte MAC buffer
 * @return true if identical, false otherwise
 */
FORCE_INLINE bool macEqual(const uint8_t *a, const uint8_t *b) {
  const uint8_t diff = static_cast<uint8_t>(
    (a[0] ^ b[0]) | (a[1] ^ b[1]) | (a[2] ^ b[2]) |
    (a[3] ^ b[3]) | (a[4] ^ b[4]) | (a[5] ^ b[5])
  );
  return diff == 0;
}

namespace detail {
constexpr uint32_t reasonMaskWord(uint8_t r, uint8_t wordIdx) {
  return ((r >> 5) == wordIdx) ? (1UL << (r & 31)) : 0UL;
}

constexpr uint32_t buildReconnectWord(uint8_t wordIdx) {
  return reasonMaskWord(WIFI_REASON_UNSPECIFIED, wordIdx)
       | reasonMaskWord(WIFI_REASON_AUTH_EXPIRE, wordIdx)
       | reasonMaskWord(WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT, wordIdx)
       | reasonMaskWord(WIFI_REASON_GROUP_KEY_UPDATE_TIMEOUT, wordIdx)
       | reasonMaskWord(WIFI_REASON_802_1X_AUTH_FAILED, wordIdx)
       | reasonMaskWord(WIFI_REASON_HANDSHAKE_TIMEOUT, wordIdx)
       | reasonMaskWord(WIFI_REASON_AUTH_LEAVE, wordIdx)
       | reasonMaskWord(WIFI_REASON_ASSOC_EXPIRE, wordIdx)
       | reasonMaskWord(WIFI_REASON_ASSOC_TOOMANY, wordIdx)
       | reasonMaskWord(WIFI_REASON_NOT_AUTHED, wordIdx)
       | reasonMaskWord(WIFI_REASON_NOT_ASSOCED, wordIdx)
       | reasonMaskWord(WIFI_REASON_ASSOC_NOT_AUTHED, wordIdx)
       | reasonMaskWord(WIFI_REASON_MIC_FAILURE, wordIdx)
       | reasonMaskWord(WIFI_REASON_IE_IN_4WAY_DIFFERS, wordIdx)
       | reasonMaskWord(WIFI_REASON_INVALID_PMKID, wordIdx)
       | reasonMaskWord(WIFI_REASON_BEACON_TIMEOUT, wordIdx)
       | reasonMaskWord(WIFI_REASON_NO_AP_FOUND, wordIdx)
       | reasonMaskWord(WIFI_REASON_ASSOC_FAIL, wordIdx)
       | reasonMaskWord(WIFI_REASON_CONNECTION_FAIL, wordIdx)
       | reasonMaskWord(WIFI_REASON_AP_TSF_RESET, wordIdx)
       | reasonMaskWord(WIFI_REASON_ROAMING, wordIdx);
}
} // namespace detail

/**
 * @brief Branchless O(1) lookup for Wi-Fi disconnect reasons eligible for auto-reconnect.
 * Compiles to compact Xtensa bit extraction (extui + l32i + srl) replacing a 21-case switch tree.
 *
 * @param reason 8-bit wifi_err_reason_t disconnect code
 * @return true if STA should attempt automatic reconnection
 */
FORCE_INLINE bool isReconnectableReason(uint8_t reason) {
  static constexpr uint32_t kReconnectMask[8] = {
    detail::buildReconnectWord(0), detail::buildReconnectWord(1),
    detail::buildReconnectWord(2), detail::buildReconnectWord(3),
    detail::buildReconnectWord(4), detail::buildReconnectWord(5),
    detail::buildReconnectWord(6), detail::buildReconnectWord(7)
  };
  return ((kReconnectMask[reason >> 5] >> (reason & 31)) & 1UL) != 0;
}

/**
 * @brief Zero-branch 32-bit IPv4 subnet CIDR calculation via hardware/intrinsic popcount.
 * Replaces multi-branch octet if/else-if chains.
 *
 * @param subnetMask32 Network-order 32-bit IPv4 subnet mask
 * @return Prefix length in bits (0..32)
 */
FORCE_INLINE uint8_t subnetCidr32(uint32_t subnetMask32) {
  return static_cast<uint8_t>(__builtin_popcount(subnetMask32));
}

} // namespace wifi_asm

