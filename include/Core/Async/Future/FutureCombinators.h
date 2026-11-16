#pragma once

#include "FutureBase.h"
#include <utility>

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
  template <typename E = Error>
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
   * @brief Combines two typed futures, resolving with a std::pair when both resolve.
   * Uses move semantics to avoid copying result objects.
   */
  template <typename T1, typename T2, typename E = Error>
  static Future<void, std::pair<T1, T2>, E> all(Future<void, T1, E> f1, Future<void, T2, E> f2) {
    return Future<void, std::pair<T1, T2>, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<std::pair<T1, T2>, E> {
      if (f1.result.is_pending()) f1.poll();
      if (f2.result.is_pending()) f2.poll();

      if (UNLIKELY(f1.result.is_rejected())) return AsyncResult<std::pair<T1, T2>, E>::reject(*f1.result.get_error());
      if (UNLIKELY(f2.result.is_rejected())) return AsyncResult<std::pair<T1, T2>, E>::reject(*f2.result.get_error());

      if (!f1.result.is_pending() && !f2.result.is_pending()) {
        return AsyncResult<std::pair<T1, T2>, E>::resolve(std::make_pair(
          f1.result.take_value(),
          f2.result.take_value()
        ));
      }
      return AsyncResult<std::pair<T1, T2>, E>::pending();
    });
  }

  /**
   * @brief Races two void futures: resolves/rejects as soon as either one does.
   */
  template <typename E = Error>
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
   * @brief Races two typed futures: resolves/rejects with the first result to finish.
   */
  template <typename T, typename E = Error>
  static Future<void, T, E> race(Future<void, T, E> f1, Future<void, T, E> f2) {
    return Future<void, T, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<T, E> {
      if (f1.result.is_pending()) f1.poll();
      if (!f1.result.is_pending()) return f1.result;

      if (f2.result.is_pending()) f2.poll();
      if (!f2.result.is_pending()) return f2.result;

      return AsyncResult<T, E>::pending();
    });
  }

  /**
   * @brief Runs f1; if f1 rejects, falls back to f2.
   */
  template <typename E = Error>
  static Future<void, void, E> fallback(Future<void, void, E> f1, Future<void, void, E> f2) {
    return Future<void, void, E>([f1 = std::move(f1), f2 = std::move(f2), fell_back = false]() mutable -> AsyncResult<void, E> {
      if (!fell_back) {
        if (f1.result.is_pending()) f1.poll();
        if (f1.result.is_resolved()) return AsyncResult<void, E>::resolve();
        if (UNLIKELY(f1.result.is_rejected())) {
          fell_back = true;
        } else {
          return AsyncResult<void, E>::pending();
        }
      }
      if (f2.result.is_pending()) f2.poll();
      return f2.result;
    });
  }

  /**
   * @brief Runs typed f1; if f1 rejects, falls back to f2.
   */
  template <typename T, typename E = Error>
  static Future<void, T, E> fallback(Future<void, T, E> f1, Future<void, T, E> f2) {
    return Future<void, T, E>([f1 = std::move(f1), f2 = std::move(f2), fell_back = false]() mutable -> AsyncResult<T, E> {
      if (!fell_back) {
        if (f1.result.is_pending()) f1.poll();
        if (f1.result.is_resolved()) return f1.result;
        if (UNLIKELY(f1.result.is_rejected())) {
          fell_back = true;
        } else {
          return AsyncResult<T, E>::pending();
        }
      }
      if (f2.result.is_pending()) f2.poll();
      return f2.result;
    });
  }

};

} // namespace uniuno
