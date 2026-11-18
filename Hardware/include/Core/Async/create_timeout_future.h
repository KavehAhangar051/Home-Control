#pragma once

#include <Future.h>

namespace uniuno {

/**
 * @brief Backward-compatible wrapper delegating to Future::timeout(timeout_ms).
 */
template <typename I, typename O, typename E = Error>
FORCE_INLINE Future<I, O, E> create_timeout_future(Future<I, O, E> future,
                                                   unsigned long timeout_ms = 5000) {
  return future.timeout(timeout_ms);
}

/**
 * @brief Backward-compatible void-input wrapper delegating to Future::timeout(timeout_ms).
 */
template <typename O, typename E = Error>
FORCE_INLINE Future<void, O, E> create_timeout_future(Future<void, O, E> future,
                                                      unsigned long timeout_ms = 5000) {
  return future.timeout(timeout_ms);
}

} // namespace uniuno
