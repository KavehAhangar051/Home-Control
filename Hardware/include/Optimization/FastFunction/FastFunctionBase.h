#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <utility>
#include <new>
#include <type_traits>
#include "Optimization/CompilerTraits.h" // FORCE_INLINE, LIKELY, UNLIKELY
#include "Optimization/TypeTraits.h"     // returns_void_v

#ifndef FASTFUNC_IRAM
// Template instantiations in headers cannot share a fixed .iram1 section under
// Xtensa GCC 14 (Arduino-ESP32 Core v3) without triggering section type conflicts.
#define FASTFUNC_IRAM
#endif

#ifndef FASTFUNC_HOT_OPT
#if defined(__GNUC__) && !defined(__clang__)
#define FASTFUNC_HOT_OPT __attribute__((optimize("O3")))
#else
#define FASTFUNC_HOT_OPT
#endif
#endif

namespace uniuno {

namespace detail {

/**
 * @brief Compile-time next power-of-2 rounder for 1-cycle bit-shift array indexing (slli).
 */
constexpr size_t next_pow2(size_t n) {
  return (n <= 16)    ? 16
         : (n <= 32)  ? 32
         : (n <= 64)  ? 64
         : (n <= 128) ? 128
         : (n <= 256) ? 256
         : (n <= 512) ? 512
                      : 1024;
}

/**
 * @brief Xtensa-accelerated exact-size 8-byte pair copier for trivial functors.
 *
 * - pairs == 0 (stateless lambdas): 0 bytes copied!
 * - pairs == 1 (1..8B lambdas, e.g. [this], [this, pin]): unrolled 4-cycle copy!
 * - pairs == 2 (9..16B lambdas): unrolled interleaved 8-cycle copy!
 * - pairs >= 3: Xtensa zero-overhead hardware loop (loopnez) copying ONLY active pairs!
 */
FORCE_INLINE void fast_copy_pairs(void* __restrict__ dst, const void* __restrict__ src, uint32_t pairs) {
  if (UNLIKELY(pairs == 0)) return;
#if defined(__XTENSA__) || defined(ESP32)
  if (LIKELY(pairs == 1)) {
    uint32_t t0, t1;
    asm volatile("l32i  %[t0], %[s], 0 \n"
                 "l32i  %[t1], %[s], 4 \n"
                 "s32i  %[t0], %[d], 0 \n"
                 "s32i  %[t1], %[d], 4 \n"
                 : [t0] "=&r"(t0), [t1] "=&r"(t1)
                 : [d] "r"(dst), [s] "r"(src)
                 : "memory");
  } else if (pairs == 2) {
    uint32_t t0, t1, t2, t3;
    asm volatile("l32i  %[t0], %[s], 0  \n"
                 "l32i  %[t1], %[s], 4  \n"
                 "l32i  %[t2], %[s], 8  \n"
                 "l32i  %[t3], %[s], 12 \n"
                 "s32i  %[t0], %[d], 0  \n"
                 "s32i  %[t1], %[d], 4  \n"
                 "s32i  %[t2], %[d], 8  \n"
                 "s32i  %[t3], %[d], 12 \n"
                 : [t0] "=&r"(t0), [t1] "=&r"(t1), [t2] "=&r"(t2), [t3] "=&r"(t3)
                 : [d] "r"(dst), [s] "r"(src)
                 : "memory");
  } else {
    uint8_t* d = static_cast<uint8_t*>(dst);
    const uint8_t* s = static_cast<const uint8_t*>(src);
    uint32_t t0, t1;
    asm volatile("loopnez %[cnt], 1f     \n"
                 "l32i    %[t0], %[s], 0 \n"
                 "l32i    %[t1], %[s], 4 \n"
                 "s32i    %[t0], %[d], 0 \n"
                 "s32i    %[t1], %[d], 4 \n"
                 "addi    %[s],  %[s], 8 \n"
                 "addi    %[d],  %[d], 8 \n"
                 "1:                     \n"
                 : [s] "+&r"(s), [d] "+&r"(d), [t0] "=&r"(t0), [t1] "=&r"(t1)
                 : [cnt] "r"(pairs)
                 : "memory");
  }
#else
  std::memcpy(dst, src, static_cast<size_t>(pairs) * 8);
#endif
}

} // namespace detail

template <typename Signature, size_t Capacity = 32> class FastFunction;

} // namespace uniuno
