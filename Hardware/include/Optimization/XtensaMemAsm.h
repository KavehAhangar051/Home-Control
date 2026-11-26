#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include "Optimization/CompilerTraits.h"

namespace uniuno {
namespace xtensa_asm {

/**
 * @brief Xtensa-accelerated 32-bit word copier using interleaved dual-word l32i/s32i
 * inside a zero-overhead hardware loop (loopnez). Zero call8 memcpy overhead.
 */
/**
 * @brief Xtensa-accelerated 32-bit zeroer for word-aligned memory blocks.
 */
FORCE_INLINE void asm_zero_words(uint32_t* __restrict__ dst, uint32_t words) {
  if (UNLIKELY(words == 0)) return;
#if defined(__XTENSA__) || defined(ESP32)
  const uint32_t pairs = words >> 1;
  if (LIKELY(pairs > 0)) {
    uint32_t z = 0;
    asm volatile (
      "loopnez %[cnt], 1f     \n"
      "s32i    %[z], %[d], 0  \n"
      "s32i    %[z], %[d], 4  \n"
      "addi    %[d], %[d], 8  \n"
      "1:                     \n"
      : [d] "+&r" (dst)
      : [cnt] "r" (pairs), [z] "r" (z)
      : "memory"
    );
  }
  if (words & 1U) {
    *dst = 0;
  }
#else
  std::memset(dst, 0, static_cast<std::size_t>(words) * 4);
#endif
}

/**
 * @brief Fast 4-byte aligned string length scanner (word-wise Mycroft zero-byte check).
 */
FORCE_INLINE std::size_t asm_strlen(const char* str) {
  if (UNLIKELY(str == nullptr)) return 0;
  const char* p = str;
  while ((reinterpret_cast<std::uintptr_t>(p) & 3U) != 0U) {
    if (*p == '\0') return static_cast<std::size_t>(p - str);
    ++p;
  }
  const uint32_t* wp = reinterpret_cast<const uint32_t*>(p);
  for (;;) {
    const uint32_t v = *wp;
    if (UNLIKELY(((v - 0x01010101U) & ~v & 0x80808080U) != 0U)) {
      const char* bp = reinterpret_cast<const char*>(wp);
      if (bp[0] == '\0') return static_cast<std::size_t>(bp - str);
      if (bp[1] == '\0') return static_cast<std::size_t>(bp + 1 - str);
      if (bp[2] == '\0') return static_cast<std::size_t>(bp + 2 - str);
      return static_cast<std::size_t>(bp + 3 - str);
    }
    ++wp;
  }
}

FORCE_INLINE void asm_copy_words(uint32_t* __restrict__ dst, const uint32_t* __restrict__ src, uint32_t words) {
  if (UNLIKELY(words == 0)) return;
#if defined(__XTENSA__) || defined(ESP32)
  const uint32_t pairs = words >> 1;
  if (LIKELY(pairs > 0)) {
    uint32_t t0, t1;
    asm volatile (
      "loopnez %[cnt], 1f     \n"
      "l32i    %[t0], %[s], 0 \n"
      "l32i    %[t1], %[s], 4 \n"
      "s32i    %[t0], %[d], 0 \n"
      "s32i    %[t1], %[d], 4 \n"
      "addi    %[s],  %[s], 8 \n"
      "addi    %[d],  %[d], 8 \n"
      "1:                     \n"
      : [s] "+&r" (src), [d] "+&r" (dst), [t0] "=&r" (t0), [t1] "=&r" (t1)
      : [cnt] "r" (pairs)
      : "memory"
    );
  }
  if (words & 1U) {
    *dst = *src;
  }
#else
  std::memcpy(dst, src, static_cast<std::size_t>(words) * 4);
#endif
}

/**
 * @brief Overlap-safe forward 32-bit word shift (dst < src) for erase().
 * Loads both words before storing either, making even 1-word overlap 100% safe
 * while eliminating load-use pipeline bubbles and memmove call overhead.
 */
FORCE_INLINE void asm_shift_left_words(uint32_t* dst, const uint32_t* src, uint32_t words) {
  if (UNLIKELY(words == 0)) return;
#if defined(__XTENSA__) || defined(ESP32)
  const uint32_t pairs = words >> 1;
  if (LIKELY(pairs > 0)) {
    uint32_t t0, t1;
    asm volatile (
      "loopnez %[cnt], 1f     \n"
      "l32i    %[t0], %[s], 0 \n"
      "l32i    %[t1], %[s], 4 \n"
      "s32i    %[t0], %[d], 0 \n"
      "s32i    %[t1], %[d], 4 \n"
      "addi    %[s],  %[s], 8 \n"
      "addi    %[d],  %[d], 8 \n"
      "1:                     \n"
      : [s] "+&r" (src), [d] "+&r" (dst), [t0] "=&r" (t0), [t1] "=&r" (t1)
      : [cnt] "r" (pairs)
      : "memory"
    );
  }
  if (words & 1U) {
    *dst = *src;
  }
#else
  std::memmove(dst, src, static_cast<std::size_t>(words) * 4);
#endif
}

/**
 * @brief Overlap-safe backward 32-bit word shift (dst_end > src_end) for insert().
 * Walks backwards in interleaved 8-byte pairs inside Xtensa loopnez.
 */
FORCE_INLINE void asm_shift_right_words(uint32_t* dst_end, const uint32_t* src_end, uint32_t words) {
  if (UNLIKELY(words == 0)) return;
#if defined(__XTENSA__) || defined(ESP32)
  const uint32_t pairs = words >> 1;
  if (LIKELY(pairs > 0)) {
    uint32_t t0, t1;
    asm volatile (
      "loopnez %[cnt], 1f      \n"
      "addi    %[s],  %[s], -8 \n"
      "addi    %[d],  %[d], -8 \n"
      "l32i    %[t1], %[s],  4 \n"
      "l32i    %[t0], %[s],  0 \n"
      "s32i    %[t1], %[d],  4 \n"
      "s32i    %[t0], %[d],  0 \n"
      "1:                      \n"
      : [s] "+&r" (src_end), [d] "+&r" (dst_end), [t0] "=&r" (t0), [t1] "=&r" (t1)
      : [cnt] "r" (pairs)
      : "memory"
    );
  }
  if (words & 1U) {
    *(--dst_end) = *(--src_end);
  }
#else
  std::memmove(dst_end - words, src_end - words, static_cast<std::size_t>(words) * 4);
#endif
}

/**
 * @brief Tight Xtensa register-loop 32-bit word scanner (pointers, TimerId, uint32_t).
 * @return Index of first match, or count if not found.
 */
FORCE_INLINE uint32_t asm_find_word(const uint32_t* data, uint32_t count, uint32_t target) {
  if (UNLIKELY(count == 0)) return 0;
#if defined(__XTENSA__) || defined(ESP32)
  const uint32_t* p = data;
  const uint32_t* end = data + count;
  uint32_t val;
  asm volatile (
    "1:                      \n"
    "l32i   %[v], %[p], 0    \n"
    "beq    %[v], %[t], 2f   \n"
    "addi   %[p], %[p], 4    \n"
    "bltu   %[p], %[e], 1b   \n"
    "2:                      \n"
    : [p] "+&r" (p), [v] "=&r" (val)
    : [e] "r" (end), [t] "r" (target)
    : "memory"
  );
  return static_cast<uint32_t>(p - data);
#else
  for (uint32_t i = 0; i < count; ++i) {
    if (data[i] == target) return i;
  }
  return count;
#endif
}

/**
 * @brief Branchless bounds clamp for StaticArray::at(): returns idx if idx < limit, else 0.
 * Uses Xtensa conditional move (movltz) — 3 cycles, zero branch misprediction stall.
 * Requires idx and limit < 2^31 (always true for 16-bit StaticArray indices).
 */
FORCE_INLINE uint32_t asm_clamp_index(uint32_t idx, uint32_t limit) {
#if defined(__XTENSA__) || defined(ESP32)
  uint32_t diff;
  uint32_t res;
  asm volatile (
    "sub    %[diff], %[idx], %[lim]  \n"
    "movi   %[res],  0               \n"
    "movltz %[res],  %[idx], %[diff] \n"
    : [diff] "=&r" (diff), [res] "=&r" (res)
    : [idx] "r" (idx), [lim] "r" (limit)
  );
  return res;
#else
  return (idx < limit) ? idx : 0;
#endif
}

} // namespace xtensa_asm
} // namespace uniuno

