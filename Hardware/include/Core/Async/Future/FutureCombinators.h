#pragma once

#include "FutureBase.h"
#include <utility>

namespace uniuno {

/**
 * @brief Encapsulated, zero-copy Combinator utilities for joining/racing Futures.
 */
struct FutureCombinators {

  /**
   * @brief Combines two void futures, resolving when both resolve or short-circuiting on first error.
   */
  template <typename E = Error>
  static Future<void, void, E> all(Future<void, void, E> f1, Future<void, void, E> f2) {
    return Future<void, void, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<void, E> {
      const auto& r1 = f1.poll();
      if (UNLIKELY(r1.is_rejected())) return AsyncResult<void, E>::reject(*r1.get_error());

      const auto& r2 = f2.poll();
      if (UNLIKELY(r2.is_rejected())) return AsyncResult<void, E>::reject(*r2.get_error());

      if (!r1.is_pending() && !r2.is_pending()) {
        return AsyncResult<void, E>::resolve();
      }
      return AsyncResult<void, E>::pending();
    });
  }

  /**
   * @brief Combines two typed futures, short-circuiting on first error and moving resolved pair without copying.
   */
  template <typename T1, typename T2, typename E = Error>
  static Future<void, std::pair<T1, T2>, E> all(Future<void, T1, E> f1, Future<void, T2, E> f2) {
    return Future<void, std::pair<T1, T2>, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<std::pair<T1, T2>, E> {
      const auto& r1 = f1.poll();
      if (UNLIKELY(r1.is_rejected())) return AsyncResult<std::pair<T1, T2>, E>::reject(*r1.get_error());

      const auto& r2 = f2.poll();
      if (UNLIKELY(r2.is_rejected())) return AsyncResult<std::pair<T1, T2>, E>::reject(*r2.get_error());

      if (!r1.is_pending() && !r2.is_pending()) {
        return AsyncResult<std::pair<T1, T2>, E>::resolve(std::make_pair(
          f1.get_result().take_value(),
          f2.get_result().take_value()
        ));
      }
      return AsyncResult<std::pair<T1, T2>, E>::pending();
    });
  }

  /**
   * @brief Races two void futures: finishes as soon as either one resolves or rejects.
   */
  template <typename E = Error>
  static Future<void, void, E> race(Future<void, void, E> f1, Future<void, void, E> f2) {
    return Future<void, void, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<void, E> {
      const auto& r1 = f1.poll();
      if (!r1.is_pending()) return std::move(f1.get_result());

      const auto& r2 = f2.poll();
      if (!r2.is_pending()) return std::move(f2.get_result());

      return AsyncResult<void, E>::pending();
    });
  }

  /**
   * @brief Races two typed futures: moves out the first finished result without copying.
   */
  template <typename T, typename E = Error>
  static Future<void, T, E> race(Future<void, T, E> f1, Future<void, T, E> f2) {
    return Future<void, T, E>([f1 = std::move(f1), f2 = std::move(f2)]() mutable -> AsyncResult<T, E> {
      const auto& r1 = f1.poll();
      if (!r1.is_pending()) return std::move(f1.get_result());

      const auto& r2 = f2.poll();
      if (!r2.is_pending()) return std::move(f2.get_result());

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
        const auto& r1 = f1.poll();
        if (r1.is_resolved()) return AsyncResult<void, E>::resolve();
        if (UNLIKELY(r1.is_rejected())) {
          fell_back = true;
          f1.clear(); // Free f1 closure resources immediately
        } else {
          return AsyncResult<void, E>::pending();
        }
      }
      const auto& r2 = f2.poll();
      if (!r2.is_pending()) return std::move(f2.get_result());
      return AsyncResult<void, E>::pending();
    });
  }

  /**
   * @brief Runs typed f1; if f1 rejects, falls back to f2 (move-optimized).
   */
  template <typename T, typename E = Error>
  static Future<void, T, E> fallback(Future<void, T, E> f1, Future<void, T, E> f2) {
    return Future<void, T, E>([f1 = std::move(f1), f2 = std::move(f2), fell_back = false]() mutable -> AsyncResult<T, E> {
      if (!fell_back) {
        const auto& r1 = f1.poll();
        if (r1.is_resolved()) return std::move(f1.get_result());
        if (UNLIKELY(r1.is_rejected())) {
          fell_back = true;
          f1.clear(); // Free f1 closure resources immediately
        } else {
          return AsyncResult<T, E>::pending();
        }
      }
      const auto& r2 = f2.poll();
      if (!r2.is_pending()) return std::move(f2.get_result());
      return AsyncResult<T, E>::pending();
    });
  }

};

} // namespace uniuno
