#pragma once

#include <Future.h>
#include <Timer/Optimization/TimerAsm.h>

#ifdef ARDUINO
#include <Arduino.h>
#else
#include <native/millis.h>
#endif

namespace uniuno {

/**
 * @brief Helper function to check if the wait time has elapsed using branchless Xtensa asm.
 */
FORCE_INLINE AsyncResult<void> get_wait_async_state(unsigned long timeout_time) {
  if (uniuno::asm_opt::is_timer_expired(millis(), timeout_time)) {
    return AsyncResult<void>::resolve();
  }
  return AsyncResult<void>::pending();
}

/**
 * @brief Creates a future that resolves after a specified delay.
 */
template <typename I = void> Future<I, void> create_wait_future(unsigned long timeout_ms) {
  const unsigned long timeout_time = millis() + timeout_ms;
  return Future<I, void>([timeout_time](const I&) { return get_wait_async_state(timeout_time); });
}

/**
 * @brief Creates a void-input future that resolves after a specified delay.
 */
template <> inline Future<void, void> create_wait_future(unsigned long timeout_ms) {
  const unsigned long timeout_time = millis() + timeout_ms;
  return Future<void, void>([timeout_time]() { return get_wait_async_state(timeout_time); });
}

} // namespace uniuno
