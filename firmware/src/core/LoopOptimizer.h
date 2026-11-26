/**
 * @file LoopOptimizer.h
 * @brief بهینه‌سازی‌های Memory-for-Speed برای تابع loop() اصلی ESP32
 *
 * ۴ روش فعال:
 *  1. IRAM_ATTR             — loop() و توابع hot از Flash Cache خارج می‌شوند
 *  2. LoopFn Table          — حذف null-check pointer هر سیکل (dispatch table)
 *  3. Pre-cached Callbacks  — StaticFunction از قبل bind می‌شود (حذف overhead در hot path)
 *  4. CCOUNT Throttle       — wsServer/wsClient هر 1ms و Watchdog/OTA health هر 500ms
 */

#pragma once

#include <Arduino.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticFunction.h>
#include <Timer/Optimization/TimerAsm.h>
#include <AchaemenidConfigProtocol.h>
#include <PinEntry.h>

// ============================================================================
// روش ۱: IRAM_ATTR
// ============================================================================
#define LOOP_IRAM_ATTR IRAM_ATTR

namespace uniuno {

// ============================================================================
// روش ۲: Pre-cached Callbacks (تخصیص یک‌باره در setup — بدون bind در hot path)
// ============================================================================
using InputCb = StaticFunction<void, int, bool, unsigned long, const RuleConfig&>;
using AnalogCb = StaticFunction<void, const AnalogInputChange&, const RuleConfig&>;

DRAM_ATTR static InputCb s_cachedInputCb;
DRAM_ATTR static AnalogCb s_cachedAnalogCb;

// ============================================================================
// روش ۳: CCOUNT Throttles (WebSocket 1ms + Watchdog/OTA health 500ms)
// مستقیم داخل IRAM_ATTR loop() inline می‌شوند (حذف کامل callx8/entry/retw)
// ============================================================================
DRAM_ATTR static uint32_t s_lastWsCycle = 0;
DRAM_ATTR static uint32_t s_lastWdtCycle = 0;

static constexpr uint32_t WS_POLL_INTERVAL_CYCLES = asm_opt::ms_to_cycles(1);
static constexpr uint32_t WDT_FEED_INTERVAL_CYCLES = asm_opt::ms_to_cycles(500);

FORCE_INLINE bool isWsPollDue() {
  const uint32_t now = asm_opt::get_cpu_cycle_count();
  if (LIKELY((now - s_lastWsCycle) < WS_POLL_INTERVAL_CYCLES)) {
    return false;
  }
  s_lastWsCycle = now;
  return true;
}

FORCE_INLINE bool isWatchdogFeedDue() {
  const uint32_t now = asm_opt::get_cpu_cycle_count();
  if (LIKELY((now - s_lastWdtCycle) < WDT_FEED_INTERVAL_CYCLES)) {
    return false;
  }
  s_lastWdtCycle = now;
  return true;
}

} // namespace uniuno
