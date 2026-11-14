#pragma once

#include "FutureBase.h"

namespace uniuno {

/**
 * @brief Combinator utilities for Futures.
 * These allow joining multiple asynchronous tasks.
 */
struct FutureCombinators {

  /**
   * @brief Combines two void futures, resolving only when both are resolved.
   * If either future rejects, the combined future rejects immediately with that error.
   * Both futures are polled concurrently every call.
   * 
   * @tparam E The error type for both futures.
   * @param f1 First future.
   * @param f2 Second future.
   * @return A combined future that resolves when both resolve.
   */
  template <typename E>
  static Future<void, void, E> all(Future<void, void, E> f1, Future<void, void, E> f2) {
    return Future<void, void, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<void, E> {
      if (f1.result.is_pending()) f1.poll();
      if (f2.result.is_pending()) f2.poll();

      if (UNLIKELY(f1.result.is_rejected())) return AsyncResult<void, E>::reject(*f1.result.get_error());
      if (UNLIKELY(f2.result.is_rejected())) return AsyncResult<void, E>::reject(*f2.result.get_error());

      if (!f1.result.is_pending() && !f2.result.is_pending()) {
        return AsyncResult<void, E>::resolve();
      }
      return AsyncResult<void, E>::pending();
    });
  }

  /**
   * @brief Races two void futures: resolves/rejects as soon as either one does.
   * The winner's result is returned; the other is abandoned.
   * f1 is checked first — give it priority if both complete on the same poll.
   * 
   * @tparam E The error type for both futures.
   * @param f1 First future (checked first).
   * @param f2 Second future.
   * @return A race future that settles with the first result.
   */
  template <typename E>
  static Future<void, void, E> race(Future<void, void, E> f1, Future<void, void, E> f2) {
    return Future<void, void, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<void, E> {
      if (f1.result.is_pending()) f1.poll();
      if (!f1.result.is_pending()) return f1.result;

      if (f2.result.is_pending()) f2.poll();
      if (!f2.result.is_pending()) return f2.result;

      return AsyncResult<void, E>::pending();
    });
  }

  /**
   * @brief Runs f1; if f1 rejects, falls back to f2.
   * If f1 resolves, f2 is never polled.
   * Useful for WiFi fallback: try primary AP, then secondary.
   * 
   * @tparam E The error type for both futures.
   * @param f1 Primary future.
   * @param f2 Fallback future, tried only if f1 rejects.
   * @return A future that resolves with f1 on success, or falls back to f2.
   */
  template <typename E>
  static Future<void, void, E> fallback(Future<void, void, E> f1, Future<void, void, E> f2) {
    return Future<void, void, E>([f1 = std::move(f1), f2 = std::move(f2), fell_back = false]() mutable -> AsyncResult<void, E> {
      if (!fell_back) {
        if (f1.result.is_pending()) f1.poll();
        if (f1.result.is_resolved()) return AsyncResult<void, E>::resolve();
        if (UNLIKELY(f1.result.is_rejected())) {
          fell_back = true; // switch to fallback
        } else {
          return AsyncResult<void, E>::pending();
        }
      }
      if (f2.result.is_pending()) f2.poll();
      return f2.result;
    });
  }

};

} // namespace uniuno
