#pragma once

#include "FutureBase.h"

namespace uniuno {

/**
 * @brief Specialization of Future for typed input I and void output.
 */
template <typename I, typename E> class Future<I, void, E> {
public:
  Future(FastFunction<AsyncResult<void, E>(const I&), 64> callback)
      : poll_callback_(std::move(callback)), result_(AsyncResult<void, E>::pending()) {}

  static FORCE_INLINE Future<I, void, E> resolve() {
    return Future<I, void, E>(ImmediateTag{}, AsyncResult<void, E>::resolve());
  }

  static FORCE_INLINE Future<I, void, E> reject(E error) {
    return Future<I, void, E>(ImmediateTag{}, AsyncResult<void, E>::reject(std::move(error)));
  }

  HOT_PATH FORCE_INLINE const AsyncResult<void, E>& poll(const I& input) {
    if (LIKELY(result_.is_pending())) {
      result_ = poll_callback_(input);
      if (UNLIKELY(!result_.is_pending())) {
        poll_callback_.clear(); // Release captured closure state immediately on completion
      }
    }
    return result_;
  }

  FORCE_INLINE void clear() { poll_callback_.clear(); }
  FORCE_INLINE bool is_pending()  const { return result_.is_pending(); }
  FORCE_INLINE bool is_resolved() const { return result_.is_resolved(); }
  FORCE_INLINE bool is_rejected() const { return result_.is_rejected(); }
  FORCE_INLINE const AsyncResult<void, E>& get_result() const { return result_; }
  FORCE_INLINE AsyncResult<void, E>&       get_result()       { return result_; }

  template <typename N, typename G = Error>
  Future<I, N, G> and_then(Future<void, N, G> next_future) {
    return Future<I, N, G>([this_future = std::move(*this), next_future = std::move(next_future)](const I& input) mutable -> AsyncResult<N, G> {
      const auto& res = this_future.poll(input);
      if (res.is_pending()) return AsyncResult<N, G>::pending();
      if (UNLIKELY(res.is_rejected())) return AsyncResult<N, G>::reject(G(*res.get_error()));
      return next_future.poll();
    });
  }

  // Single-layer direct function execution (no redundant inner Future!)
  template <typename F>
  auto and_then(F &&fn) -> Future<I, decltype(fn()), E> {
    using OutputType = decltype(fn());
    return Future<I, OutputType, E>([this_future = std::move(*this), fn = std::forward<F>(fn)](const I& input) mutable -> AsyncResult<OutputType, E> {
      const auto& res = this_future.poll(input);
      if (res.is_pending()) return AsyncResult<OutputType, E>::pending();
      if (UNLIKELY(res.is_rejected())) return AsyncResult<OutputType, E>::reject(*res.get_error());
      return AsyncResult<OutputType, E>::resolve(fn());
    });
  }

  template <typename F>
  Future<I, void, E> catch_error(F &&err_fn) {
    return Future<I, void, E>([this_future = std::move(*this), err_fn = std::forward<F>(err_fn)](const I& input) mutable -> AsyncResult<void, E> {
      const auto& res = this_future.poll(input);
      if (res.is_pending()) return AsyncResult<void, E>::pending();
      if (UNLIKELY(res.is_rejected())) {
        err_fn(*res.get_error());
        return AsyncResult<void, E>::resolve();
      }
      return res;
    });
  }

  /** @brief Fluent OOP timeout using branchless Xtensa assembly is_timer_expired(). */
  Future<I, void, E> timeout(unsigned long timeout_ms) {
    const unsigned long deadline = millis() + timeout_ms;
    return Future<I, void, E>([this_future = std::move(*this), deadline](const I& input) mutable -> AsyncResult<void, E> {
      if (UNLIKELY(this_future.is_pending() && uniuno::asm_opt::is_timer_expired(millis(), deadline))) {
        return AsyncResult<void, E>::reject(E(ERROR_FUTURE_TIMEOUT));
      }
      return this_future.poll(input);
    });
  }

  template <typename F>
  auto map(F &&fn) -> Future<I, decltype(fn()), E> {
    return this->and_then(std::forward<F>(fn));
  }

private:
  struct ImmediateTag {};
  FORCE_INLINE Future(ImmediateTag, AsyncResult<void, E>&& immediate)
      : poll_callback_(nullptr), result_(std::move(immediate)) {}

  FastFunction<AsyncResult<void, E>(const I&), 64> poll_callback_;
  AsyncResult<void, E> result_;
};

} // namespace uniuno
