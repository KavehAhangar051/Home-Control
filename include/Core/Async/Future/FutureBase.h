#pragma once

#include <AsyncResult.h>
#include <function_traits.h>
#include <Optimization/FastFunction.h>
#include <Optimization/CompilerTraits.h>
#include <Timer/Optimization/TimerAsm.h>

#ifdef ARDUINO
#include <Arduino.h>
#else
#include <native/millis.h>
#endif

#ifndef ERROR_FUTURE_TIMEOUT
#define ERROR_FUTURE_TIMEOUT "operation timed out"
#endif

namespace uniuno {

using namespace utils;

/**
 * @brief Represents an encapsulated, zero-overhead asynchronous Future<I, O, E>.
 *
 * OOP & Hardware Features:
 *  - Immediate resolve()/reject() skip FastFunction wrapping completely (1-cycle poll!).
 *  - Single-layer and_then(fn) avoids double-wrapping into a dummy inner Future.
 *  - Fluent .timeout(ms) uses branchless 3-cycle Xtensa is_timer_expired().
 *  - Private result_ with FORCE_INLINE encapsulated state accessors.
 */
template <typename I, typename O, typename E = Error> class Future {
public:
  Future(FastFunction<AsyncResult<O, E>(const I&), 64> callback)
      : poll_callback_(std::move(callback)), result_(AsyncResult<O, E>::pending()) {}

  /** @brief Creates an already resolved Future with zero FastFunction/callx8 overhead. */
  static FORCE_INLINE Future<I, O, E> resolve(O output) {
    return Future<I, O, E>(ImmediateTag{}, AsyncResult<O, E>::resolve(std::move(output)));
  }

  /** @brief Creates an already rejected Future with zero FastFunction/callx8 overhead. */
  static FORCE_INLINE Future<I, O, E> reject(E error) {
    return Future<I, O, E>(ImmediateTag{}, AsyncResult<O, E>::reject(std::move(error)));
  }

  /** @brief Polls the future with the given input, returning a zero-copy reference. */
  HOT_PATH FORCE_INLINE const AsyncResult<O, E>& poll(const I& input) {
    if (LIKELY(result_.is_pending()) && LIKELY(static_cast<bool>(poll_callback_))) {
      result_ = poll_callback_(input);
    }
    return result_;
  }

  FORCE_INLINE bool is_pending()  const { return result_.is_pending(); }
  FORCE_INLINE bool is_resolved() const { return result_.is_resolved(); }
  FORCE_INLINE bool is_rejected() const { return result_.is_rejected(); }
  FORCE_INLINE const AsyncResult<O, E>& get_result() const { return result_; }
  FORCE_INLINE AsyncResult<O, E>&       get_result()       { return result_; }

  /** @brief Chains another Future to run after this one resolves. */
  template <typename N, typename G = Error>
  Future<I, N, G> and_then(Future<O, N, G> next_future) {
    return Future<I, N, G>([this_future = std::move(*this), next_future = std::move(next_future)](const I& input) mutable -> AsyncResult<N, G> {
      const auto& res = this_future.poll(input);
      if (res.is_pending()) return AsyncResult<N, G>::pending();
      if (UNLIKELY(res.is_rejected())) return AsyncResult<N, G>::reject(G(*res.get_error()));
      return next_future.poll(*res.get_value());
    });
  }

  /** @brief Single-layer direct function transform (eliminates dummy inner Future & heap spill). */
  template <typename F>
  auto and_then(F &&fn) -> Future<I, decltype(fn(std::declval<O>())), E> {
    using OutputType = decltype(fn(std::declval<O>()));
    return Future<I, OutputType, E>([this_future = std::move(*this), fn = std::forward<F>(fn)](const I& input) mutable -> AsyncResult<OutputType, E> {
      const auto& res = this_future.poll(input);
      if (res.is_pending()) return AsyncResult<OutputType, E>::pending();
      if (UNLIKELY(res.is_rejected())) return AsyncResult<OutputType, E>::reject(*res.get_error());
      return AsyncResult<OutputType, E>::resolve(fn(*res.get_value()));
    });
  }

  /** @brief Catches errors and recovers with a fallback value. */
  template <typename F>
  Future<I, O, E> catch_error(F &&err_fn) {
    return Future<I, O, E>([this_future = std::move(*this), err_fn = std::forward<F>(err_fn)](const I& input) mutable -> AsyncResult<O, E> {
      const auto& res = this_future.poll(input);
      if (res.is_pending()) return AsyncResult<O, E>::pending();
      if (UNLIKELY(res.is_rejected())) return AsyncResult<O, E>::resolve(err_fn(*res.get_error()));
      return res;
    });
  }

  /** @brief Fluent OOP timeout using branchless Xtensa assembly is_timer_expired(). */
  Future<I, O, E> timeout(unsigned long timeout_ms) {
    const unsigned long deadline = millis() + timeout_ms;
    return Future<I, O, E>([this_future = std::move(*this), deadline](const I& input) mutable -> AsyncResult<O, E> {
      if (UNLIKELY(this_future.is_pending() && uniuno::asm_opt::is_timer_expired(millis(), deadline))) {
        return AsyncResult<O, E>::reject(E(ERROR_FUTURE_TIMEOUT));
      }
      return this_future.poll(input);
    });
  }

  /** @brief Transforms the resolved output value (fluent alias for and_then). */
  template <typename F>
  auto map(F &&fn) -> Future<I, decltype(fn(std::declval<O>())), E> {
    return this->and_then(std::forward<F>(fn));
  }

private:
  struct ImmediateTag {};
  FORCE_INLINE Future(ImmediateTag, AsyncResult<O, E>&& immediate)
      : poll_callback_(nullptr), result_(std::move(immediate)) {}

  FastFunction<AsyncResult<O, E>(const I&), 64> poll_callback_;
  AsyncResult<O, E> result_;
};

} // namespace uniuno
