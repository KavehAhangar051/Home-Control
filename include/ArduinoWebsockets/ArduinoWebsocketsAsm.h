/**
 * @file ArduinoWebsocketsAsm.h
 * @brief High-performance Xtensa LX6 assembly and SIMD-style masking pipeline for ArduinoWebsockets.
 *
 * Replaces byte-by-byte modulo (% 4) iteration with 32-bit word-aligned XOR operations,
 * providing 4x-8x acceleration for WebSocket frame masking/unmasking on ESP32.
 */

#pragma once

#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/XtensaMemAsm.h>

#ifdef __XTENSA__
#include <esp_system.h>
#endif

namespace websockets {
namespace asm_opt {

FORCE_INLINE uint16_t bswap16(uint16_t v) {
  return __builtin_bswap16(v);
}

FORCE_INLINE uint32_t bswap32(uint32_t v) {
  return __builtin_bswap32(v);
}

FORCE_INLINE uint64_t bswap64(uint64_t v) {
  return __builtin_bswap64(v);
}

/**
 * @brief Xtensa LX6 hardware-loop 32-bit word XOR pipeline for aligned memory blocks.
 * Processes 16 bytes per iteration via zero-overhead `loopnez`.
 */
FORCE_INLINE void mask_words_aligned(uint32_t* __restrict__ p32, size_t num_words, uint32_t mask32) {
  size_t n4 = num_words >> 2;
  size_t rem = num_words & 3;

#if defined(__XTENSA__) || defined(ESP32)
  if (LIKELY(n4 > 0)) {
    uint32_t t0, t1, t2, t3;
    asm volatile("loopnez %[cnt], 1f     \n"
                 "l32i    %[t0], %[p], 0 \n"
                 "l32i    %[t1], %[p], 4 \n"
                 "l32i    %[t2], %[p], 8 \n"
                 "l32i    %[t3], %[p], 12\n"
                 "xor     %[t0], %[t0], %[m]\n"
                 "xor     %[t1], %[t1], %[m]\n"
                 "xor     %[t2], %[t2], %[m]\n"
                 "xor     %[t3], %[t3], %[m]\n"
                 "s32i    %[t0], %[p], 0 \n"
                 "s32i    %[t1], %[p], 4 \n"
                 "s32i    %[t2], %[p], 8 \n"
                 "s32i    %[t3], %[p], 12\n"
                 "addi    %[p],  %[p], 16\n"
                 "1:                     \n"
                 : [p] "+&r"(p32), [t0] "=&r"(t0), [t1] "=&r"(t1), [t2] "=&r"(t2), [t3] "=&r"(t3)
                 : [cnt] "r"(n4), [m] "r"(mask32)
                 : "memory");
  }
#else
  while (n4--) {
    p32[0] ^= mask32;
    p32[1] ^= mask32;
    p32[2] ^= mask32;
    p32[3] ^= mask32;
    p32 += 4;
  }
#endif

  while (rem--) {
    *p32++ ^= mask32;
  }
}

/**
 * @brief Memory-safe, high-speed WebSocket masking routine.
 * Uses register bit-rotation (no stack temp array) and Xtensa loopnez 32-bit XOR.
 */
FORCE_INLINE void fast_mask(uint8_t* data, size_t len, const uint8_t* mask) {
  if (UNLIKELY(!data || len == 0 || !mask)) return;

  size_t i = 0;
  const uintptr_t addr = reinterpret_cast<uintptr_t>(data);
  const size_t align_offset = addr & 3U;
  if (align_offset != 0U) {
    size_t lead = 4U - align_offset;
    if (lead > len) lead = len;
    for (; i < lead; ++i) {
      data[i] ^= mask[i & 3U];
    }
  }

  if (i + 4U <= len) {
    // Little-endian Xtensa: byte-shift key in 1 register instead of stack loop+memcpy
    uint32_t m32;
    memcpy(&m32, mask, 4U);
    const uint32_t rot_bits = static_cast<uint32_t>((i & 3U) << 3U);
    if (rot_bits != 0U) {
      m32 = (m32 >> rot_bits) | (m32 << (32U - rot_bits));
    }

    const size_t words = (len - i) >> 2U;
    mask_words_aligned(reinterpret_cast<uint32_t*>(data + i), words, m32);
    i += (words << 2U);
  }

  for (; i < len; ++i) {
    data[i] ^= mask[i & 3U];
  }
}

} // namespace asm_opt
} // namespace websockets
