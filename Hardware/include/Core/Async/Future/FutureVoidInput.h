#pragma once

#include "FutureBase.h"

namespace uniuno {

/**
 * @brief Specialization of Future for void input and typed output O.
 */
template <typename O, typename E> class Future<void, O, E> {
public:
  Future(FastFunction<AsyncResult<O, E>(), 64> callback)
      : poll_callback_(std::move(callback)), result_(AsyncResult<O, E>::pending()) {}

  static FORCE_INLINE Future<void, O, E> resolve(O output) {
    return Future<void, O, E>(ImmediateTag{}, AsyncResult<O, E>::resolve(std::move(output)));
  }

  static FORCE_INLINE Future<void, O, E> reject(E error) {
    return Future<void, O, E>(ImmediateTag{}, AsyncResult<O, E>::reject(std::move(error)));
  }

  HOT_PATH FORCE_INLINE const AsyncResult<O, E>& poll() {
    if (LIKELY(result_.is_pending())) {
      result_ = poll_callback_();
      if (UNLIKELY(!result_.is_pending())) {
        poll_callback_.clear(); // Release captured closure state immediately on completion
      }
    }
    return result_;
  }

  FORCE_INLINE void clear() { poll_callback_.clear(); }
  FORCE_INLINE bool is_pending() const { return result_.is_pending(); }
  FORCE_INLINE bool is_resolved() const { return result_.is_resolved(); }
  FORCE_INLINE bool is_rejected() const { return result_.is_rejected(); }
  FORCE_INLINE const AsyncResult<O, E>& get_result() const { return result_; }
  FORCE_INLINE AsyncResult<O, E>& get_result() { return result_; }

  template <typename N, typename G = Error> Future<void, N, G> and_then(Future<O, N, G> next_future) {
    return Future<void, N, G>(
        [this_future = std::move(*this), next_future = std::move(next_future)]() mutable -> AsyncResult<N, G> {
          const auto& res = this_future.poll();
          if (res.is_pending()) return AsyncResult<N, G>::pending();
          if (UNLIKELY(res.is_rejected())) return AsyncResult<N, G>::reject(G(*res.get_error()));
          return next_future.poll(*res.get_value());
        });
  }

  template <class F> auto and_then(F&& fn) -> Future<void, decltype(fn(std::declval<O>())), E> {
    return this->into_future(std::forward<F>(fn));
  }

  template <class F> Future<void, O, E> catch_error(F&& err_fn) {
    return Future<void, O, E>(
        [this_future = std::move(*this), err_fn = std::forward<F>(err_fn)]() mutable -> AsyncResult<O, E> {
          const auto& res = this_future.poll();
          if (res.is_pending()) return AsyncResult<O, E>::pending();
          if (UNLIKELY(res.is_rejected())) return AsyncResult<O, E>::resolve(err_fn(*res.get_error()));
          return res;
        });
  }

  /** @brief Fluent OOP timeout using branchless Xtensa assembly is_timer_expired(). */
  Future<void, O, E> timeout(unsigned long timeout_ms) {
    const unsigned long deadline = millis() + timeout_ms;
    return Future<void, O, E>([this_future = std::move(*this), deadline]() mutable -> AsyncResult<O, E> {
      if (UNLIKELY(this_future.is_pending() && uniuno::asm_opt::is_timer_expired(millis(), deadline))) {
        return AsyncResult<O, E>::reject(E(ERROR_FUTURE_TIMEOUT));
      }
      return this_future.poll();
    });
  }

  template <class F> auto map(F&& fn) -> Future<void, decltype(fn(std::declval<O>())), E> {
    return this->and_then(std::forward<F>(fn));
  }

private:
  struct ImmediateTag {};
  FORCE_INLINE Future(ImmediateTag, AsyncResult<O, E>&& immediate)
      : poll_callback_(nullptr), result_(std::move(immediate)) {}

  // Single-layer direct function execution (no redundant inner Future!)
  template <class F, typename std::enable_if<
                         std::is_same<typename function_traits<F>::template arg<0>::type, O>::value &&
                         !std::is_same<typename function_traits<F>::result_type, void>::value>::type* = nullptr>
  auto into_future(F&& fn) -> Future<void, decltype(fn(std::declval<O>())), E> {
    using OutputType = decltype(fn(std::declval<O>()));
    return Future<void, OutputType, E>(
        [this_future = std::move(*this), fn = std::forward<F>(fn)]() mutable -> AsyncResult<OutputType, E> {
          const auto& res = this_future.poll();
          if (res.is_pending()) return AsyncResult<OutputType, E>::pending();
          if (UNLIKELY(res.is_rejected())) return AsyncResult<OutputType, E>::reject(*res.get_error());
          return AsyncResult<OutputType, E>::resolve(fn(*res.get_value()));
        });
  }

  template <class F, typename std::enable_if<
                         std::is_same<typename function_traits<F>::template arg<0>::type, O>::value &&
                         std::is_same<typename function_traits<F>::result_type, void>::value>::type* = nullptr>
  auto into_future(F&& fn) -> Future<void, void, E> {
    return Future<void, void, E>(
        [this_future = std::move(*this), fn = std::forward<F>(fn)]() mutable -> AsyncResult<void, E> {
          const auto& res = this_future.poll();
          if (res.is_pending()) return AsyncResult<void, E>::pending();
          if (UNLIKELY(res.is_rejected())) return AsyncResult<void, E>::reject(*res.get_error());
          fn(*res.get_value());
          return AsyncResult<void, E>::resolve();
        });
  }

  FastFunction<AsyncResult<O, E>(), 64> poll_callback_;
  AsyncResult<O, E> result_;
};

} // namespace uniuno
