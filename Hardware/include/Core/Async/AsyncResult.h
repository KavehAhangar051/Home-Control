#pragma once

#include <Error.h>
#include <Optimization/CompilerTraits.h>
#include <utility>
#include <new>
#include <cstdint>

namespace uniuno {

/**
 * @brief Represents the state of an asynchronous operation (compact 1-byte enum).
 */
enum AsyncState : uint8_t {
  Pending  = 0,
  Resolved = 1,
  Rejected = 2
};

/**
 * @brief Zero-overhead Tagged Union container for asynchronous results.
 *
 * Unlike naive structs that default-construct both T and E simultaneously,
 * this Tagged Union constructs ONLY the active member:
 *  - Pending:  0 constructors run (1-cycle state_ = Pending)
 *  - Resolved: only T is constructed (supports non-default-constructible T!)
 *  - Rejected: only E is constructed (zero wasted T construction)
 *
 * @tparam T The type of the resolved value.
 * @tparam E The type of the error (defaults to uniuno::Error).
 */
template <typename T, typename E = Error> class AsyncResult {
public:
  static FORCE_INLINE AsyncResult<T, E> pending() { return AsyncResult<T, E>(); }
  static FORCE_INLINE AsyncResult<T, E> reject(E err) { return AsyncResult<T, E>(RejectTag{}, std::move(err)); }
  static FORCE_INLINE AsyncResult<T, E> resolve(T input) { return AsyncResult<T, E>(ResolveTag{}, std::move(input)); }

  FORCE_INLINE AsyncResult() : state_(AsyncState::Pending) {}

  FORCE_INLINE AsyncResult(T input) : state_(AsyncState::Resolved) {
    new (&storage_.value) T(std::move(input));
  }

  FORCE_INLINE AsyncResult(E e) : state_(AsyncState::Rejected) {
    new (&storage_.err) E(std::move(e));
  }

  FORCE_INLINE AsyncResult(const AsyncResult& other) : state_(other.state_) {
    if (state_ == AsyncState::Resolved) {
      new (&storage_.value) T(other.storage_.value);
    } else if (state_ == AsyncState::Rejected) {
      new (&storage_.err) E(other.storage_.err);
    }
  }

  FORCE_INLINE AsyncResult(AsyncResult&& other) noexcept : state_(other.state_) {
    if (state_ == AsyncState::Resolved) {
      new (&storage_.value) T(std::move(other.storage_.value));
    } else if (state_ == AsyncState::Rejected) {
      new (&storage_.err) E(std::move(other.storage_.err));
    }
  }

  FORCE_INLINE AsyncResult& operator=(const AsyncResult& other) {
    if (LIKELY(this != &other)) {
      // Hot-path shortcut: Pending -> Pending skips destruction and construction
      if (state_ == AsyncState::Pending && other.state_ == AsyncState::Pending) {
        return *this;
      }
      destroy();
      state_ = other.state_;
      if (state_ == AsyncState::Resolved) {
        new (&storage_.value) T(other.storage_.value);
      } else if (state_ == AsyncState::Rejected) {
        new (&storage_.err) E(other.storage_.err);
      }
    }
    return *this;
  }

  FORCE_INLINE AsyncResult& operator=(AsyncResult&& other) noexcept {
    if (LIKELY(this != &other)) {
      // Hot-path shortcut: Pending -> Pending skips destruction and construction
      if (state_ == AsyncState::Pending && other.state_ == AsyncState::Pending) {
        return *this;
      }
      destroy();
      state_ = other.state_;
      if (state_ == AsyncState::Resolved) {
        new (&storage_.value) T(std::move(other.storage_.value));
      } else if (state_ == AsyncState::Rejected) {
        new (&storage_.err) E(std::move(other.storage_.err));
      }
    }
    return *this;
  }

  FORCE_INLINE ~AsyncResult() { destroy(); }

  FORCE_INLINE bool is_pending()  const { return state_ == AsyncState::Pending; }
  FORCE_INLINE bool is_resolved() const { return state_ == AsyncState::Resolved; }
  FORCE_INLINE bool is_rejected() const { return state_ == AsyncState::Rejected; }
  FORCE_INLINE bool has_value()   const { return state_ == AsyncState::Resolved; }

  FORCE_INLINE T*       get_value()       { return LIKELY(is_resolved()) ? &storage_.value : nullptr; }
  FORCE_INLINE const T* get_value() const { return LIKELY(is_resolved()) ? &storage_.value : nullptr; }

  FORCE_INLINE E*       get_error()       { return UNLIKELY(is_rejected()) ? &storage_.err : nullptr; }
  FORCE_INLINE const E* get_error() const { return UNLIKELY(is_rejected()) ? &storage_.err : nullptr; }

  /** @brief Moves and returns the resolved value without copying. */
  FORCE_INLINE T take_value() { return std::move(storage_.value); }

  /** @brief Moves and returns the error without copying. */
  FORCE_INLINE E take_error() { return std::move(storage_.err); }

  /** @brief Returns the value if resolved, or the provided fallback (copy). */
  FORCE_INLINE T unwrap_or(T fallback) const& {
    return is_resolved() ? storage_.value : std::move(fallback);
  }

  /** @brief Moves the value if resolved, or returns fallback without copying. */
  FORCE_INLINE T unwrap_or(T fallback) && {
    return is_resolved() ? std::move(storage_.value) : std::move(fallback);
  }

  /** @brief Transforms the resolved value using fn, preserving pending/error states. */
  template <typename F>
  FORCE_INLINE auto map(F&& fn) const& -> AsyncResult<decltype(fn(std::declval<const T&>())), E> {
    using NewT = decltype(fn(std::declval<const T&>()));
    if (is_resolved()) return AsyncResult<NewT, E>::resolve(fn(storage_.value));
    if (is_rejected()) return AsyncResult<NewT, E>::reject(storage_.err);
    return AsyncResult<NewT, E>::pending();
  }

  /** @brief Transforms the resolved value using fn with move semantics. */
  template <typename F>
  FORCE_INLINE auto map(F&& fn) && -> AsyncResult<decltype(fn(std::declval<T&&>())), E> {
    using NewT = decltype(fn(std::declval<T&&>()));
    if (is_resolved()) return AsyncResult<NewT, E>::resolve(fn(std::move(storage_.value)));
    if (is_rejected()) return AsyncResult<NewT, E>::reject(std::move(storage_.err));
    return AsyncResult<NewT, E>::pending();
  }

  FORCE_INLINE AsyncState get_state() const { return state_; }

private:
  struct ResolveTag {};
  struct RejectTag  {};

  FORCE_INLINE AsyncResult(ResolveTag, T&& input) : state_(AsyncState::Resolved) {
    new (&storage_.value) T(std::move(input));
  }

  FORCE_INLINE AsyncResult(RejectTag, E&& e) : state_(AsyncState::Rejected) {
    new (&storage_.err) E(std::move(e));
  }

  FORCE_INLINE void destroy() {
    if (state_ == AsyncState::Resolved) {
      storage_.value.~T();
    } else if (UNLIKELY(state_ == AsyncState::Rejected)) {
      storage_.err.~E();
    }
  }

  union Storage {
    T value;
    E err;
    FORCE_INLINE Storage() {}
    FORCE_INLINE ~Storage() {}
  };

  Storage    storage_;
  AsyncState state_;
};

/**
 * @brief Zero-overhead Tagged Union specialization for void return types.
 * Pending and Resolved states NEVER construct or destroy E (zero virtual dtor overhead!).
 */
template <typename E> class AsyncResult<void, E> {
public:
  static FORCE_INLINE AsyncResult<void, E> pending() { return AsyncResult<void, E>(AsyncState::Pending); }
  static FORCE_INLINE AsyncResult<void, E> reject(E err) { return AsyncResult<void, E>(std::move(err)); }
  static FORCE_INLINE AsyncResult<void, E> resolve() { return AsyncResult<void, E>(AsyncState::Resolved); }

  FORCE_INLINE AsyncResult() : state_(AsyncState::Pending) {}
  FORCE_INLINE AsyncResult(AsyncState s) : state_(s) {}

  FORCE_INLINE AsyncResult(E e) : state_(AsyncState::Rejected) {
    new (&storage_.err) E(std::move(e));
  }

  FORCE_INLINE AsyncResult(const AsyncResult& other) : state_(other.state_) {
    if (UNLIKELY(state_ == AsyncState::Rejected)) {
      new (&storage_.err) E(other.storage_.err);
    }
  }

  FORCE_INLINE AsyncResult(AsyncResult&& other) noexcept : state_(other.state_) {
    if (UNLIKELY(state_ == AsyncState::Rejected)) {
      new (&storage_.err) E(std::move(other.storage_.err));
    }
  }

  FORCE_INLINE AsyncResult& operator=(const AsyncResult& other) {
    if (LIKELY(this != &other)) {
      // Hot-path: Non-rejected transitions between Pending/Resolved require no destruction/construction
      if (state_ != AsyncState::Rejected && other.state_ != AsyncState::Rejected) {
        state_ = other.state_;
        return *this;
      }
      destroy();
      state_ = other.state_;
      if (UNLIKELY(state_ == AsyncState::Rejected)) {
        new (&storage_.err) E(other.storage_.err);
      }
    }
    return *this;
  }

  FORCE_INLINE AsyncResult& operator=(AsyncResult&& other) noexcept {
    if (LIKELY(this != &other)) {
      // Hot-path: Non-rejected transitions between Pending/Resolved require no destruction/construction
      if (state_ != AsyncState::Rejected && other.state_ != AsyncState::Rejected) {
        state_ = other.state_;
        return *this;
      }
      destroy();
      state_ = other.state_;
      if (UNLIKELY(state_ == AsyncState::Rejected)) {
        new (&storage_.err) E(std::move(other.storage_.err));
      }
    }
    return *this;
  }

  FORCE_INLINE ~AsyncResult() { destroy(); }

  FORCE_INLINE bool is_pending()  const { return state_ == AsyncState::Pending; }
  FORCE_INLINE bool is_resolved() const { return state_ == AsyncState::Resolved; }
  FORCE_INLINE bool is_rejected() const { return state_ == AsyncState::Rejected; }
  FORCE_INLINE bool has_value()   const { return state_ == AsyncState::Resolved; }

  FORCE_INLINE E*       get_error()       { return UNLIKELY(is_rejected()) ? &storage_.err : nullptr; }
  FORCE_INLINE const E* get_error() const { return UNLIKELY(is_rejected()) ? &storage_.err : nullptr; }
  FORCE_INLINE E        take_error()      { return std::move(storage_.err); }

  FORCE_INLINE AsyncState get_state() const { return state_; }

  /** @brief Transforms void result into a new value when resolved. */
  template <typename F>
  FORCE_INLINE auto map(F&& fn) const -> AsyncResult<decltype(fn()), E> {
    using NewT = decltype(fn());
    if (is_resolved()) return AsyncResult<NewT, E>::resolve(fn());
    if (UNLIKELY(is_rejected())) return AsyncResult<NewT, E>::reject(storage_.err);
    return AsyncResult<NewT, E>::pending();
  }

private:
  FORCE_INLINE void destroy() {
    if (UNLIKELY(state_ == AsyncState::Rejected)) {
      storage_.err.~E();
    }
  }

  union ErrStorage {
    E err;
    FORCE_INLINE ErrStorage() {}
    FORCE_INLINE ~ErrStorage() {}
  };

  ErrStorage storage_;
  AsyncState state_;
};

} // namespace uniuno
