#pragma once

#include "AsyncResult.h"
#include "Future.h"
#include "Executor.h"
#include "Optimization/AtomicSharedPtr.h"
#include <atomic>

namespace uniuno {

/**
 * @brief Thread-safe shared state between a Deferred promise and its Futures.
 *
 * Uses release-acquire atomic state transitions to guarantee dual-core ESP32
 * visibility (Core 0 producer -> Core 1 Executor consumer) with zero data races
 * and zero attachTask()/resolve() sleep deadlocks.
 */
template <typename O, typename E = Error> struct DeferredState {
  AsyncResult<O, E> result;
  TaskHandle task_handle;
  std::atomic<uint8_t> settled;  // 0 = Pending, 1 = Writing, 2 = Published
  std::atomic<uint8_t> attached; // 0 = Detached, 1 = TaskHandle attached

  DeferredState() : result(AsyncResult<O, E>::pending()), settled(0), attached(0) {}
};

/**
 * @brief Non-virtual OOP base class consolidating shared Deferred lifecycle & sync logic.
 * Eliminates 3x boilerplate across Deferred specializations with zero virtual overhead.
 */
template <typename O, typename E = Error> class DeferredBase {
public:
  DeferredBase() : state_(AtomicSharedPtr<DeferredState<O, E>>::make()) {}

  /**
   * @brief Attaches a TaskHandle for 1-cycle event-driven wakeup.
   * Deadlock-safe: if already settled prior to attachTask(), wakes handle immediately.
   */
  void attachTask(TaskHandle handle) {
    if (LIKELY(static_cast<bool>(state_))) {
      state_->task_handle = handle;
      state_->attached.store(1, std::memory_order_release);
      if (UNLIKELY(state_->settled.load(std::memory_order_acquire) == 2)) {
        handle.wake();
      }
    }
  }

  /** @brief Thread-safely rejects the Deferred and wakes any attached task in 1 cycle. */
  void reject(E error) {
    if (UNLIKELY(!state_)) return;
    uint8_t expected = 0;
    if (!state_->settled.compare_exchange_strong(expected, 1, std::memory_order_acq_rel)) {
      return;
    }
    state_->result = AsyncResult<O, E>::reject(std::move(error));
    state_->settled.store(2, std::memory_order_release);
    if (state_->attached.load(std::memory_order_acquire) != 0 && state_->task_handle) {
      state_->task_handle.wake();
    }
  }

  FORCE_INLINE bool is_pending() const {
    return state_ ? (state_->settled.load(std::memory_order_acquire) != 2) : false;
  }

  FORCE_INLINE bool is_resolved() const {
    return state_ && state_->settled.load(std::memory_order_acquire) == 2 && state_->result.is_resolved();
  }

  FORCE_INLINE bool is_rejected() const {
    return state_ && state_->settled.load(std::memory_order_acquire) == 2 && state_->result.is_rejected();
  }

protected:
  AtomicSharedPtr<DeferredState<O, E>> state_;
};

/**
 * @brief Reactive Promise (Deferred) with typed input I and typed output O.
 */
template <typename I, typename O, typename E = Error> class Deferred : public DeferredBase<O, E> {
public:
  using DeferredBase<O, E>::DeferredBase;

  void resolve(O output) {
    if (UNLIKELY(!this->state_)) return;
    uint8_t expected = 0;
    if (!this->state_->settled.compare_exchange_strong(expected, 1, std::memory_order_acq_rel)) {
      return;
    }
    this->state_->result = AsyncResult<O, E>::resolve(std::move(output));
    this->state_->settled.store(2, std::memory_order_release);
    if (this->state_->attached.load(std::memory_order_acquire) != 0 && this->state_->task_handle) {
      this->state_->task_handle.wake();
    }
  }

  Future<I, O, E> get_future() const {
    return Future<I, O, E>([state = this->state_](const I&) mutable -> AsyncResult<O, E> {
      if (LIKELY(!state || state->settled.load(std::memory_order_acquire) != 2)) {
        return AsyncResult<O, E>::pending();
      }
      return state->result;
    });
  }
};

/**
 * @brief Deferred specialization for void input and typed output O.
 */
template <typename O, typename E> class Deferred<void, O, E> : public DeferredBase<O, E> {
public:
  using DeferredBase<O, E>::DeferredBase;

  void resolve(O output) {
    if (UNLIKELY(!this->state_)) return;
    uint8_t expected = 0;
    if (!this->state_->settled.compare_exchange_strong(expected, 1, std::memory_order_acq_rel)) {
      return;
    }
    this->state_->result = AsyncResult<O, E>::resolve(std::move(output));
    this->state_->settled.store(2, std::memory_order_release);
    if (this->state_->attached.load(std::memory_order_acquire) != 0 && this->state_->task_handle) {
      this->state_->task_handle.wake();
    }
  }

  Future<void, O, E> get_future() const {
    return Future<void, O, E>([state = this->state_]() mutable -> AsyncResult<O, E> {
      if (LIKELY(!state || state->settled.load(std::memory_order_acquire) != 2)) {
        return AsyncResult<O, E>::pending();
      }
      return state->result;
    });
  }

  /**
   * @brief Schedules this Deferred in an Executor in EventDriven (0% CPU sleep) mode.
   */
  template <typename FErr> TaskHandle execute(Executor& executor, FErr&& on_error) {
    auto fut = this->get_future();
    TaskHandle handle = executor.executeEventDriven(std::move(fut), std::forward<FErr>(on_error));
    this->attachTask(handle);
    return handle;
  }
};

/**
 * @brief Deferred specialization for void input and void output.
 */
template <typename E> class Deferred<void, void, E> : public DeferredBase<void, E> {
public:
  using DeferredBase<void, E>::DeferredBase;

  void resolve() {
    if (UNLIKELY(!this->state_)) return;
    uint8_t expected = 0;
    if (!this->state_->settled.compare_exchange_strong(expected, 1, std::memory_order_acq_rel)) {
      return;
    }
    this->state_->result = AsyncResult<void, E>::resolve();
    this->state_->settled.store(2, std::memory_order_release);
    if (this->state_->attached.load(std::memory_order_acquire) != 0 && this->state_->task_handle) {
      this->state_->task_handle.wake();
    }
  }

  Future<void, void, E> get_future() const {
    return Future<void, void, E>([state = this->state_]() mutable -> AsyncResult<void, E> {
      if (LIKELY(!state || state->settled.load(std::memory_order_acquire) != 2)) {
        return AsyncResult<void, E>::pending();
      }
      return state->result;
    });
  }

  /**
   * @brief Schedules this Deferred in an Executor in EventDriven (0% CPU sleep) mode.
   */
  template <typename FErr> TaskHandle execute(Executor& executor, FErr&& on_error) {
    auto fut = this->get_future();
    TaskHandle handle = executor.executeEventDriven(std::move(fut), std::forward<FErr>(on_error));
    this->attachTask(handle);
    return handle;
  }
};

} // namespace uniuno
