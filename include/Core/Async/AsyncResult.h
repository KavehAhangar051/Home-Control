#pragma once

#include <Error.h>
#include <Optimization/CompilerTraits.h>
#include <utility>
#include <cstdint>

namespace uniuno {

/**
 * @brief Represents the state of an asynchronous operation (compact 1-byte enum).
 */
enum AsyncState : uint8_t { 
  Pending = 0, 
  Resolved = 1, 
  Rejected = 2 
};

/**
 * @brief A high-speed container for the result of an asynchronous operation.
 * 
 * @tparam T The type of the resolved value.
 * @tparam E The type of the error (defaults to uniuno::Error).
 */
template <typename T, typename E = Error> class AsyncResult {
public:
  static FORCE_INLINE AsyncResult<T, E> pending() { return AsyncResult<T, E>(); }
  static FORCE_INLINE AsyncResult<T, E> reject(E err) { return AsyncResult<T, E>(std::move(err)); }
  static FORCE_INLINE AsyncResult<T, E> resolve(T input) { return AsyncResult<T, E>(std::move(input)); }

  FORCE_INLINE AsyncResult() : state(AsyncState::Pending) {}

  FORCE_INLINE AsyncResult(T input) 
    : state(AsyncState::Resolved), value(std::move(input)) {}

  FORCE_INLINE AsyncResult(E e) 
    : state(AsyncState::Rejected), err(std::move(e)) {}

  FORCE_INLINE bool is_pending() const { return this->state == AsyncState::Pending; }
  FORCE_INLINE bool is_resolved() const { return this->state == AsyncState::Resolved; }
  FORCE_INLINE bool is_rejected() const { return this->state == AsyncState::Rejected; }
  FORCE_INLINE bool has_value() const { return this->is_resolved(); }

  FORCE_INLINE T *get_value() { return LIKELY(this->is_resolved()) ? &value : nullptr; }
  FORCE_INLINE const T *get_value() const { return LIKELY(this->is_resolved()) ? &value : nullptr; }
  
  FORCE_INLINE E *get_error() { return UNLIKELY(this->is_rejected()) ? &err : nullptr; }
  FORCE_INLINE const E *get_error() const { return UNLIKELY(this->is_rejected()) ? &err : nullptr; }
  
  /** @brief Moves and returns the value, avoiding copies for large types. */
  FORCE_INLINE T take_value() { return std::move(this->value); }

  /** @brief Returns the value if resolved, or the provided fallback. */
  FORCE_INLINE T unwrap_or(T fallback) const {
    return is_resolved() ? value : std::move(fallback);
  }

  /** @brief Transforms the resolved value using fn, preserving pending/error states. */
  template <typename F>
  FORCE_INLINE auto map(F&& fn) const -> AsyncResult<decltype(fn(std::declval<T>())), E> {
    using NewT = decltype(fn(std::declval<T>()));
    if (is_resolved()) return AsyncResult<NewT, E>::resolve(fn(value));
    if (is_rejected()) return AsyncResult<NewT, E>::reject(err);
    return AsyncResult<NewT, E>::pending();
  }

  FORCE_INLINE AsyncState get_state() const { return this->state; }

private:
  AsyncState state;
  T value;
  E err;
};

/**
 * @brief Specialization for void return types.
 * 
 * @tparam E The type of the error.
 */
template <typename E> class AsyncResult<void, E> {
public:
  static FORCE_INLINE AsyncResult<void, E> pending() { return AsyncResult<void, E>(AsyncState::Pending); }
  static FORCE_INLINE AsyncResult<void, E> reject(E err) { return AsyncResult<void, E>(std::move(err)); }
  static FORCE_INLINE AsyncResult<void, E> resolve() { return AsyncResult<void, E>(AsyncState::Resolved); }

  FORCE_INLINE AsyncResult() : state(AsyncState::Pending) {}
  FORCE_INLINE AsyncResult(AsyncState state) : state(state) {}
  FORCE_INLINE AsyncResult(E e) : state(AsyncState::Rejected), err(std::move(e)) {}

  FORCE_INLINE bool is_pending() const { return this->state == AsyncState::Pending; }
  FORCE_INLINE bool is_resolved() const { return this->state == AsyncState::Resolved; }
  FORCE_INLINE bool is_rejected() const { return this->state == AsyncState::Rejected; }
  FORCE_INLINE bool has_value() const { return this->is_resolved(); }

  FORCE_INLINE E *get_error() { return UNLIKELY(this->is_rejected()) ? &err : nullptr; }
  FORCE_INLINE const E *get_error() const { return UNLIKELY(this->is_rejected()) ? &err : nullptr; }
  
  FORCE_INLINE AsyncState get_state() const { return this->state; }

  /** @brief Transforms void result into a new value when resolved. */
  template <typename F>
  FORCE_INLINE auto map(F&& fn) const -> AsyncResult<decltype(fn()), E> {
    using NewT = decltype(fn());
    if (is_resolved()) return AsyncResult<NewT, E>::resolve(fn());
    if (is_rejected()) return AsyncResult<NewT, E>::reject(err);
    return AsyncResult<NewT, E>::pending();
  }

private:
  AsyncState state;
  E err;
};

} // namespace uniuno
