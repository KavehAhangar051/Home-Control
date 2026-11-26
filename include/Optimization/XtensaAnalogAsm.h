#pragma once

#include <cstdint>
#include "Optimization/CompilerTraits.h"

namespace uniuno {
namespace xtensa_asm {

/**
 * @brief Branchless 16-bit clamp using Xtensa LX6 single-cycle MAX/MIN instructions.
 * Eliminates conditional branches so the 5-stage Xtensa pipeline never flushes.
 * Speed: 2 CPU cycles (~8.3ns @ 240MHz).
 */
FORCE_INLINE uint16_t asm_clamp_u16(int32_t val, uint16_t lo, uint16_t hi) {
#if defined(__XTENSA__) || defined(ESP32)
  int32_t res;
  const int32_t lo32 = static_cast<int32_t>(lo);
  const int32_t hi32 = static_cast<int32_t>(hi);
  asm volatile("max    %[r], %[v], %[lo] \n"
               "min    %[r], %[r], %[hi] \n"
               : [r] "=&r"(res)
               : [v] "r"(val), [lo] "r"(lo32), [hi] "r"(hi32));
  return static_cast<uint16_t>(res);
#else
  if (val <= static_cast<int32_t>(lo)) return lo;
  if (val >= static_cast<int32_t>(hi)) return hi;
  return static_cast<uint16_t>(val);
#endif
}

/**
 * @brief Branchless absolute difference |a - b| using Xtensa SUB + ABS instructions.
 * Speed: 2 CPU cycles (~8.3ns @ 240MHz), zero branch misprediction penalty.
 */
FORCE_INLINE uint16_t asm_abs_diff_u16(uint16_t a, uint16_t b) {
#if defined(__XTENSA__) || defined(ESP32)
  int32_t res;
  const int32_t a32 = static_cast<int32_t>(a);
  const int32_t b32 = static_cast<int32_t>(b);
  asm volatile("sub    %[r], %[a], %[b] \n"
               "abs    %[r], %[r]       \n"
               : [r] "=&r"(res)
               : [a] "r"(a32), [b] "r"(b32));
  return static_cast<uint16_t>(res);
#else
  return (a >= b) ? static_cast<uint16_t>(a - b) : static_cast<uint16_t>(b - a);
#endif
}

/**
 * @brief Branchless active-high / active-low PWM duty polarity transform.
 * Returns duty if activeHigh != 0, otherwise (maxDuty - duty).
 * Uses Xtensa SUB + MOVEQZ (2 cycles, zero branches).
 */
FORCE_INLINE uint16_t asm_active_low_duty(uint16_t duty, uint16_t maxDuty, bool activeHigh) {
#if defined(__XTENSA__) || defined(ESP32)
  uint32_t inv;
  uint32_t res = static_cast<uint32_t>(duty);
  const uint32_t max32 = static_cast<uint32_t>(maxDuty);
  const uint32_t ah = activeHigh ? 1UL : 0UL;
  asm volatile("sub    %[inv], %[max], %[res]       \n"
               "moveqz %[res], %[inv], %[ah]        \n"
               : [res] "+&r"(res), [inv] "=&r"(inv)
               : [max] "r"(max32), [ah] "r"(ah));
  return static_cast<uint16_t>(res);
#else
  return activeHigh ? duty : static_cast<uint16_t>(maxDuty - duty);
#endif
}

/**
 * @brief Branchless ESP32 LEDC 21.4 fixed-point duty register computation.
 * Applies the ESP32 full-ON hardware rule (if hwDuty == maxDuty, emit maxDuty + 1
 * so output stays 100% DC HIGH without a 1-tick dip), then shifts << 4.
 * Speed: 4 CPU cycles (~16.6ns @ 240MHz), zero branches.
 */
FORCE_INLINE uint32_t asm_ledc_duty_fixed(uint16_t hwDuty, uint16_t maxDuty) {
#if defined(__XTENSA__) || defined(ESP32)
  uint32_t d = static_cast<uint32_t>(hwDuty);
  const uint32_t m = static_cast<uint32_t>(maxDuty);
  uint32_t diff;
  uint32_t fullOn;
  asm volatile("sub    %[diff], %[d], %[m]          \n"
               "addi   %[full], %[m], 1             \n"
               "moveqz %[d],    %[full], %[diff]    \n"
               "slli   %[d],    %[d], 4             \n"
               : [d] "+&r"(d), [diff] "=&r"(diff), [full] "=&r"(fullOn)
               : [m] "r"(m));
  return d;
#else
  const uint32_t adjusted =
      (hwDuty >= maxDuty && maxDuty != 1) ? (static_cast<uint32_t>(maxDuty) + 1UL) : static_cast<uint32_t>(hwDuty);
  return adjusted << 4;
#endif
}

/**
 * @brief Branchless integer EMA (alpha = 0.5) with exact rail snapping at 0 and maxVal.
 * Matches:
 *   if (raw == 0 && prev <= 1) return 0;
 *   if (raw == maxVal && prev + 1 >= maxVal) return maxVal;
 *   return (prev + raw + 1) >> 1;
 * Zero conditional branches -> zero 5-stage pipeline flushes.
 */
FORCE_INLINE uint16_t asm_ema50_rail_snap(uint16_t prev, uint16_t raw, uint16_t maxVal) {
#if defined(__XTENSA__) || defined(ESP32)
  uint32_t ema;
  uint32_t condLo;
  uint32_t condHi;
  uint32_t tmp;
  const uint32_t p32 = static_cast<uint32_t>(prev);
  const uint32_t r32 = static_cast<uint32_t>(raw);
  const uint32_t m32 = static_cast<uint32_t>(maxVal);
  asm volatile(
      // ema = (prev + raw + 1) >> 1
      "add    %[ema],  %[p],   %[r]        \n"
      "addi   %[ema],  %[ema], 1           \n"
      "srli   %[ema],  %[ema], 1           \n"
      // condLo == 0 iff (raw == 0 && prev <= 1) -> (raw | (prev >> 1)) == 0
      "srli   %[cLo],  %[p],   1           \n"
      "or     %[cLo],  %[cLo], %[r]        \n"
      "movi   %[tmp],  0                   \n"
      "moveqz %[ema],  %[tmp], %[cLo]      \n"
      // condHi == 0 iff (raw == maxVal && prev >= maxVal - 1)
      "sub    %[cHi],  %[m],   %[r]        \n" // 0 iff raw == maxVal
      "addi   %[tmp],  %[p],   1           \n"
      "sub    %[tmp],  %[tmp], %[m]        \n" // >= 0 iff prev + 1 >= maxVal (sign bit 0)
      "extui  %[tmp],  %[tmp], 31, 1       \n" // 0 iff prev + 1 >= maxVal, 1 otherwise
      "or     %[cHi],  %[cHi], %[tmp]      \n" // 0 iff BOTH conditions hold
      "moveqz %[ema],  %[m],   %[cHi]      \n"
      : [ema] "=&r"(ema), [cLo] "=&r"(condLo), [cHi] "=&r"(condHi), [tmp] "=&r"(tmp)
      : [p] "r"(p32), [r] "r"(r32), [m] "r"(m32));
  return static_cast<uint16_t>(ema);
#else
  if (raw == 0 && prev <= 1) return 0;
  if (raw == maxVal && static_cast<uint32_t>(prev) + 1UL >= maxVal) return maxVal;
  return static_cast<uint16_t>((static_cast<uint32_t>(prev) + raw + 1UL) >> 1);
#endif
}

/**
 * @brief Branchless Schmitt-trigger hysteresis comparator for analog inputs.
 * Semantics (identical to GpioAdc):
 * - If highTh == 0: returns false (comparator disabled)
 * - If !prevState: transitions HIGH iff val >= highTh
 * - If prevState: transitions LOW iff (lowTh < highTh ? val <= lowTh : val < highTh)
 * Zero conditional branches -> deterministic cycle time with zero pipeline stalls.
 */
FORCE_INLINE bool asm_schmitt_eval(uint16_t val, uint16_t highTh, uint16_t lowTh, bool prevState) {
#if defined(__XTENSA__) || defined(ESP32)
  uint32_t res;
  int32_t t1;
  int32_t t2;
  const int32_t v32 = static_cast<int32_t>(val);
  const int32_t hi32 = static_cast<int32_t>(highTh);
  const int32_t lo32 = static_cast<int32_t>(lowTh);
  const uint32_t prev32 = prevState ? 1UL : 0UL;
  asm volatile(
      // t1 = hi - 1
      "addi   %[t1],  %[hi], -1           \n"
      // res = nextFromLow = ((hi - 1) - v) < 0  <==>  v >= hi
      "sub    %[t2],  %[t1], %[v]         \n"
      "extui  %[res], %[t2], 31, 1        \n"
      // t1 = effLow = (lo < hi) ? lo : (hi - 1)
      "sub    %[t2],  %[lo], %[hi]        \n"
      "movltz %[t1],  %[lo], %[t2]        \n"
      // t1 = nextFromHigh = (effLow - v) < 0  <==>  (lo < hi ? v > lo : v >= hi)
      "sub    %[t2],  %[t1], %[v]         \n"
      "extui  %[t1],  %[t2], 31, 1        \n"
      // res = prevState ? nextFromHigh : nextFromLow
      "movnez %[res], %[t1], %[prev]      \n"
      // if (highTh == 0) res = 0
      "movi   %[t2],  0                   \n"
      "moveqz %[res], %[t2], %[hi]        \n"
      : [res] "=&r"(res), [t1] "=&r"(t1), [t2] "=&r"(t2)
      : [v] "r"(v32), [hi] "r"(hi32), [lo] "r"(lo32), [prev] "r"(prev32));
  return res != 0;
#else
  if (highTh == 0) return false;
  if (!prevState) {
    return val >= highTh;
  }
  const bool belowLow = (lowTh < highTh) ? (val <= lowTh) : (val < highTh);
  return !belowLow;
#endif
}

/**
 * @brief Branchless analog range + hysteresis membership evaluator.
 * Semantics:
 * - If !wasInRange: returns (val >= minVal && val <= maxVal)
 * - If wasInRange:  returns (val >= exitMin && val <= exitMax), where
 *     exitMin = (minVal > hysteresis) ? (minVal - hysteresis) : 0
 *     exitMax = min(maxScale, maxVal + hysteresis)
 * Uses Xtensa LX6 MAX/MIN/SUB/EXTUI/MOVNEZ — zero conditional branches, zero pipeline flushes.
 */
FORCE_INLINE bool asm_range_eval(uint16_t val, uint16_t minVal, uint16_t maxVal, uint16_t hysteresis, uint16_t maxScale,
                                 bool wasInRange) {
#if defined(__XTENSA__) || defined(ESP32)
  int32_t effMin = static_cast<int32_t>(minVal);
  int32_t effMax = static_cast<int32_t>(maxVal);
  int32_t t1;
  int32_t t2;
  const int32_t v32 = static_cast<int32_t>(val);
  const int32_t h32 = static_cast<int32_t>(hysteresis);
  const int32_t scale32 = static_cast<int32_t>(maxScale);
  const uint32_t was32 = wasInRange ? 1UL : 0UL;
  asm volatile(
      // t1 = exitMin = max(0, minVal - hysteresis)
      "sub    %[t1],   %[eMin], %[h]       \n"
      "movi   %[t2],   0                   \n"
      "max    %[t1],   %[t1],   %[t2]      \n"
      "movnez %[eMin], %[t1],   %[was]     \n"
      // t1 = exitMax = min(maxScale, maxVal + hysteresis)
      "add    %[t1],   %[eMax], %[h]       \n"
      "min    %[t1],   %[t1],   %[scale]   \n"
      "movnez %[eMax], %[t1],   %[was]     \n"
      // inRange iff (v - eMin) >= 0 AND (eMax - v) >= 0 -> ((v - eMin) | (eMax - v)) >= 0
      "sub    %[t1],   %[v],    %[eMin]    \n"
      "sub    %[t2],   %[eMax], %[v]       \n"
      "or     %[t1],   %[t1],   %[t2]      \n"
      "extui  %[t1],   %[t1],   31, 1      \n"
      : [eMin] "+&r"(effMin), [eMax] "+&r"(effMax), [t1] "=&r"(t1), [t2] "=&r"(t2)
      : [v] "r"(v32), [h] "r"(h32), [scale] "r"(scale32), [was] "r"(was32));
  return t1 == 0;
#else
  if (!wasInRange) {
    return val >= minVal && val <= maxVal;
  }
  const uint16_t exitMin = (minVal > hysteresis) ? static_cast<uint16_t>(minVal - hysteresis) : 0;
  const uint32_t rawMax = static_cast<uint32_t>(maxVal) + hysteresis;
  const uint16_t exitMax = (rawMax > maxScale) ? maxScale : static_cast<uint16_t>(rawMax);
  return val >= exitMin && val <= exitMax;
#endif
}

/**
 * @brief Fast exact integer division by 1000 (ms -> seconds) using reciprocal multiply.
 * Avoids Xtensa's slow ~40-cycle software division (__udivsi3).
 * Exact for the entire uint32_t domain [0 .. 4,294,967,295].
 * Speed: ~4 CPU cycles on Xtensa LX6 (muluh + srli).
 */
FORCE_INLINE uint32_t asm_div1000_u32(uint32_t ms) {
  return static_cast<uint32_t>((static_cast<uint64_t>(ms) * 0x10624DD3ULL) >> 38);
}

} // namespace xtensa_asm
} // namespace uniuno
