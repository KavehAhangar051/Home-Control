/**
 * @file EspNowAsm.h
 * @brief Low-level Xtensa LX6 hardware primitives for ESP-NOW & ESP_NOW_Serial hot paths.
 *
 * Provides branchless 6-byte MAC equality/broadcast checks (eliminating memcmp calls in
 * high-priority WiFi RX/TX callbacks), power-of-2 ring-buffer helpers, and Xtensa loopnez
 * dual-word copy dispatch for bulk ESP-NOW packet buffering.
 */

#pragma once

#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/XtensaMemAsm.h>

namespace espnow_asm {

/**
 * @brief Branchless 6-byte MAC address comparison.
 * Avoids function-call overhead of memcmp inside RX/TX peer lookup loops.
 *
 * @param a First 6-byte MAC buffer
 * @param b Second 6-byte MAC buffer
 * @return true if MAC addresses match identically
 */
FORCE_INLINE bool macEqual(const uint8_t* a, const uint8_t* b) {
  const uint8_t diff = static_cast<uint8_t>((a[0] ^ b[0]) | (a[1] ^ b[1]) | (a[2] ^ b[2]) | (a[3] ^ b[3]) |
                                            (a[4] ^ b[4]) | (a[5] ^ b[5]));
  return diff == 0;
}

/**
 * @brief Branchless broadcast MAC check (FF:FF:FF:FF:FF:FF).
 * Alignment-safe 6-byte bitwise AND accumulation.
 *
 * @param mac 6-byte destination MAC buffer
 * @return true if broadcast address
 */
FORCE_INLINE bool isBroadcastMac(const uint8_t* mac) {
  const uint8_t allOnes = static_cast<uint8_t>(mac[0] & mac[1] & mac[2] & mac[3] & mac[4] & mac[5]);
  return allOnes == 0xFF;
}

/**
 * @brief Fast packet copy using Xtensa loopnez dual-word l32i/s32i when 4-byte aligned.
 * Falls back cleanly to memcpy for unaligned buffers or small payloads.
 *
 * @param dst Destination buffer
 * @param src Source buffer
 * @param len Byte length to copy
 */
FORCE_INLINE void copyAlignedOrByte(uint8_t* __restrict__ dst, const uint8_t* __restrict__ src, size_t len) {
  if (len == 0) {
    return;
  }
  if (len >= 8 && (((reinterpret_cast<uintptr_t>(dst) | reinterpret_cast<uintptr_t>(src)) & 3U) == 0)) {
    const uint32_t words = static_cast<uint32_t>(len >> 2);
    uniuno::xtensa_asm::asm_copy_words(reinterpret_cast<uint32_t*>(dst), reinterpret_cast<const uint32_t*>(src), words);
    const size_t copied = static_cast<size_t>(words) << 2;
    const size_t tail = len & 3U;
    for (size_t i = 0; i < tail; ++i) {
      dst[copied + i] = src[copied + i];
    }
    return;
  }
  memcpy(dst, src, len);
}

/**
 * @brief Round requested ring capacity up to next power of 2 (min 64 bytes) for mask indexing.
 */
FORCE_INLINE size_t nextPow2Size(size_t v) {
  if (v <= 64) return 64;
  size_t p = 64;
  while (p < v && p < (1UL << 16)) {
    p <<= 1;
  }
  return p;
}

} // namespace espnow_asm
