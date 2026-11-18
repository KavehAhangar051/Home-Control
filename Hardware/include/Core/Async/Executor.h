#pragma once

#include <Future.h>
#include <function_traits.h>
#include <Optimization/FastFunction.h>
#include <Optimization/CompilerTraits.h>
#include <Timer/Optimization/TimerAsm.h>
#include <atomic>
#include <utility>

#ifndef ARDUINO
#include <native/millis.h>
#else
#include <Arduino.h>
#endif

namespace uniuno {

// Forward declaration
template <size_t Capacity>
class ExecutorBase;

/**
 * @brief Lightweight generation-checked handle to an async task scheduled in an Executor.
 * Enables zero-overhead O(1) cancellation, interval adjustment, liveness check, and event wakeups.
 */
template <size_t Capacity = 32>
class TaskHandleBase {
public:
  constexpr TaskHandleBase() : executor_(nullptr), index_(0xFF), generation_(0) {}
  TaskHandleBase(ExecutorBase<Capacity>* exec, uint8_t idx, uint16_t gen)
      : executor_(exec), index_(idx), generation_(gen) {}

  /** @brief Returns true if this handle was bound to an Executor slot. */
  FORCE_INLINE bool isValid() const { return executor_ != nullptr && index_ != 0xFF; }

  /** @brief Returns true if the referenced task is still active with matching generation. */
  FORCE_INLINE bool isAlive() const;

  /** @brief Implicit boolean conversion for backward compatibility. */
  FORCE_INLINE operator bool() const { return isValid(); }

  /** @brief Wakes up the task immediately in the next executor poll cycle (1 clock cycle). */
  FORCE_INLINE void wake() const;

  /** @brief Puts the task to sleep. It will consume 0% CPU until wake() is called. */
  FORCE_INLINE void sleep() const;

  /** @brief Immediately cancels and frees the task from the executor in O(1). */
  FORCE_INLINE void cancel();

  /** @brief Sets a minimum polling interval in milliseconds (throttling). */
  FORCE_INLINE void setInterval(uint32_t interval_ms) const;

  /** @brief Returns the internal slot index (0..Capacity-1). */
  FORCE_INLINE uint8_t getIndex() const { return index_; }

  /**
   * @brief Binds this task to an event from an EventDispatcher.
   * When the event is dispatched, this task is awakened in 1 CPU cycle.
   */
  template <typename EventType, typename DispatcherType>
  FORCE_INLINE const TaskHandleBase& onEvent(DispatcherType& dispatcher) const {
    dispatcher.template on<EventType>([h = *this](const EventType*) mutable {
      h.wake();
    });
    return *this;
  }

private:
  ExecutorBase<Capacity>* executor_;
  uint8_t index_;
  uint16_t generation_;
};

using TaskHandle = TaskHandleBase<32>;

/**
 * @brief High-performance Hybrid Reactive Async Executor for Xtensa ESP32.
 *
 * Features:
 * 1. Hardware bitmask scheduling: 1-cycle Xtensa NSA/CTZ for both ready-task scan
 *    and free-slot allocation (~active_mask_ — zero free_indices_ array!).
 * 2. 1ms CCOUNT Hardware Fast-Gate: eliminates 100,000/sec millis() calls while
 *    interval tasks (e.g. WiFi recovery) are active.
 * 3. Event-Driven Wakeup: dormant tasks consume 0 CPU cycles until wake().
 * 4. Zero dynamic allocations: statically pooled Power-of-2 FastFunction slots.
 */
template <size_t Capacity = 32>
class ExecutorBase {
  static_assert(Capacity > 0 && Capacity <= 32,
                "ExecutorBase bitmask supports between 1 and 32 concurrent futures.");

  static constexpr uint32_t kValidMask =
      (Capacity == 32) ? 0xFFFFFFFFUL : ((1UL << Capacity) - 1UL);

public:
  ExecutorBase()
      : active_mask_(0),
        ready_mask_(0),
        interval_mask_(0),
        sleep_mask_(0),
        last_interval_cycle_(0) {
    for (size_t i = 0; i < Capacity; i++) {
      generations_[i]  = 1;
      intervals_ms_[i] = 0;
      next_poll_ms_[i] = 0;
    }
  }

  // =========================================================================
  // SCHEDULING INTERFACE
  // =========================================================================

  template <typename I, typename O, typename E = Error, class F,
            typename std::enable_if<
                function_traits<F>::arity == 1 &&
                std::is_same<typename function_traits<F>::template arg<0>::type,
                             E>::value>::type * = nullptr>
  TaskHandleBase<Capacity> execute(Future<I, O, E> future, I input, F &&on_error) {
    const uint8_t idx = allocateSlot();
    if (UNLIKELY(idx == 0xFF)) return TaskHandleBase<Capacity>();

    future_pool_[idx] = [future = std::move(future), input = std::move(input), on_error = std::forward<F>(on_error)]() mutable {
      const auto& result = future.poll(input);
      if (UNLIKELY(result.is_rejected())) {
        on_error(*result.get_error());
      }
      return result.get_state();
    };

    return activateSlot(idx);
  }

  template <typename O, typename E = Error, class FErr, class FOk,
            typename std::enable_if<
                function_traits<FErr>::arity == 1 &&
                std::is_same<typename function_traits<FErr>::template arg<0>::type, E>::value &&
                function_traits<FOk>::arity == 0>::type * = nullptr>
  TaskHandleBase<Capacity> execute(Future<void, O, E> future, FErr &&on_error, FOk &&on_success) {
    const uint8_t idx = allocateSlot();
    if (UNLIKELY(idx == 0xFF)) return TaskHandleBase<Capacity>();

    future_pool_[idx] = [future     = std::move(future),
                         on_error   = std::forward<FErr>(on_error),
                         on_success = std::forward<FOk>(on_success)]() mutable {
      const auto& result = future.poll();
      if (UNLIKELY(result.is_rejected())) {
        on_error(*result.get_error());
      } else if (result.is_resolved()) {
        on_success();
      }
      return result.get_state();
    };

    return activateSlot(idx);
  }

  template <typename O, typename E = Error, class F,
            typename std::enable_if<
                function_traits<F>::arity == 1 &&
                std::is_same<typename function_traits<F>::template arg<0>::type,
                             E>::value>::type * = nullptr>
  TaskHandleBase<Capacity> execute(Future<void, O, E> future, F &&on_error) {
    const uint8_t idx = allocateSlot();
    if (UNLIKELY(idx == 0xFF)) return TaskHandleBase<Capacity>();

    future_pool_[idx] = [future = std::move(future), on_error = std::forward<F>(on_error)]() mutable {
      const auto& result = future.poll();
      if (UNLIKELY(result.is_rejected())) {
        on_error(*result.get_error());
      }
      return result.get_state();
    };

    return activateSlot(idx);
  }

  template <typename I, typename O, typename E = Error>
  TaskHandleBase<Capacity> execute(Future<I, O, E> future, I input) {
    return execute(std::move(future), std::move(input), [](E) {});
  }

  template <typename O, typename E = Error>
  TaskHandleBase<Capacity> execute(Future<void, O, E> future) {
    return execute(std::move(future), [](E) {});
  }

  template <typename O, typename E = Error, class F>
  TaskHandleBase<Capacity> executeEventDriven(Future<void, O, E> future, F &&on_error) {
    auto handle = execute(std::move(future), std::forward<F>(on_error));
    if (handle) handle.sleep();
    return handle;
  }

  template <typename O, typename E = Error, class F>
  TaskHandleBase<Capacity> executeInterval(Future<void, O, E> future, uint32_t interval_ms, F &&on_error) {
    auto handle = execute(std::move(future), std::forward<F>(on_error));
    if (handle) handle.setInterval(interval_ms);
    return handle;
  }

  // =========================================================================
  // TASK CONTROL (INVOKED VIA TaskHandle)
  // =========================================================================

  FORCE_INLINE bool isAlive(uint8_t idx, uint16_t gen) const {
    return idx < Capacity && ((active_mask_ & (1UL << idx)) != 0) && generations_[idx] == gen;
  }

  FORCE_INLINE void wake(uint8_t idx, uint16_t gen) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    ready_mask_.fetch_or(1UL << idx, std::memory_order_relaxed);
  }

  FORCE_INLINE void sleep(uint8_t idx, uint16_t gen) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    const uint32_t bit = 1UL << idx;
    sleep_mask_ |= bit;
    ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
  }

  FORCE_INLINE void cancel(uint8_t idx, uint16_t gen) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    const uint32_t bit = 1UL << idx;
    if (active_mask_ & bit) {
      future_pool_[idx].clear();
      active_mask_ &= ~bit;
      if (ready_mask_.load(std::memory_order_relaxed) & bit) {
        ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
      }
      interval_mask_ &= ~bit;
      sleep_mask_ &= ~bit;
      generations_[idx]++;
    }
  }

  FORCE_INLINE void setInterval(uint8_t idx, uint16_t gen, uint32_t interval_ms) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    const uint32_t bit = 1UL << idx;
    if (interval_ms > 0) {
      intervals_ms_[idx] = interval_ms;
      next_poll_ms_[idx] = millis() + interval_ms;
      interval_mask_ |= bit;
      ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
    } else {
      interval_mask_ &= ~bit;
      ready_mask_.fetch_or(bit, std::memory_order_relaxed);
    }
  }

  // =========================================================================
  // MAIN EVENT LOOP POLLER
  // =========================================================================

  /**
   * @brief Polls all active and ready futures using Xtensa bitmask + CCOUNT hardware gates.
   *  - Idle loop: ~2 CPU cycles exit.
   *  - Active interval task waiting: ~4 CPU cycles CCOUNT 1ms gate (100x fewer millis() calls!).
   */
  HOT_PATH void poll() {
    uint32_t to_process = ready_mask_.load(std::memory_order_relaxed);

    // FAST-PATH: If nothing is ready and no intervals exist, or no tasks are active
    if (LIKELY((to_process | interval_mask_) == 0 || active_mask_ == 0)) {
      return;
    }

    uint32_t cached_now = 0;
    bool now_cached = false;

    // 1. Check expired timers for interval-throttled tasks (1ms CCOUNT hardware fast-gate)
    if (UNLIKELY(interval_mask_ != 0)) {
      uint32_t pending_intervals = interval_mask_ & ~to_process;
      if (pending_intervals &&
          UNLIKELY(uniuno::asm_opt::is_cycle_interval_elapsed(
              last_interval_cycle_, uniuno::asm_opt::ms_to_cycles(1)))) {
        cached_now = millis();
        now_cached = true;
        uint32_t newly_ready = 0;

        while (pending_intervals) {
          const uint32_t idx = __builtin_ctz(pending_intervals);
          if (uniuno::asm_opt::is_timer_expired(cached_now, next_poll_ms_[idx])) {
            newly_ready |= (1UL << idx);
          }
          pending_intervals &= pending_intervals - 1;
        }

        if (newly_ready) {
          ready_mask_.fetch_or(newly_ready, std::memory_order_relaxed);
          to_process |= newly_ready;
        }
      }
    }

    if (to_process == 0) return;

    // 2. Process each ready task (Single-cycle Xtensa ctz bit-scan + 1-cycle slli slot index)
    while (to_process) {
      const uint32_t idx = __builtin_ctz(to_process);
      const uint32_t bit = 1UL << idx;
      to_process &= to_process - 1;

      if ((sleep_mask_ | interval_mask_) & bit) {
        ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
        if (interval_mask_ & bit) {
          if (!now_cached) {
            cached_now = millis();
            now_cached = true;
          }
          next_poll_ms_[idx] = cached_now + intervals_ms_[idx];
        }
      }

      auto* slot = &future_pool_[idx];
      if ((*slot)() != AsyncState::Pending) {
        slot->clear();
        active_mask_ &= ~bit;
        // Skip expensive atomic CAS if bit was already cleared above
        if (UNLIKELY(ready_mask_.load(std::memory_order_relaxed) & bit)) {
          ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
        }
        interval_mask_ &= ~bit;
        sleep_mask_ &= ~bit;
        generations_[idx]++;
      }
    }
  }

  FORCE_INLINE size_t getActiveCount() const {
    return __builtin_popcount(active_mask_);
  }

  FORCE_INLINE size_t getReadyCount() const {
    return __builtin_popcount(ready_mask_.load(std::memory_order_relaxed));
  }

private:
  /** @brief 1-cycle hardware free-slot allocation using Xtensa ctz (~active_mask_). */
  FORCE_INLINE uint8_t allocateSlot() const {
    const uint32_t free_bits = (~active_mask_) & kValidMask;
    if (UNLIKELY(free_bits == 0)) return 0xFF;
    return static_cast<uint8_t>(__builtin_ctz(free_bits));
  }

  FORCE_INLINE TaskHandleBase<Capacity> activateSlot(uint8_t idx) {
    const uint32_t bit = 1UL << idx;
    active_mask_ |= bit;
    ready_mask_.fetch_or(bit, std::memory_order_relaxed);
    return TaskHandleBase<Capacity>(this, idx, generations_[idx]);
  }

  FastFunction<AsyncState(void), 128> future_pool_[Capacity];
  uint32_t active_mask_;
  std::atomic<uint32_t> ready_mask_;
  uint32_t interval_mask_;
  uint32_t sleep_mask_;
  uint32_t last_interval_cycle_;
  uint32_t intervals_ms_[Capacity];
  uint32_t next_poll_ms_[Capacity];
  uint16_t generations_[Capacity];
};

// Out-of-line inlined definitions for TaskHandleBase
template <size_t Capacity>
FORCE_INLINE bool TaskHandleBase<Capacity>::isAlive() const {
  return isValid() && executor_->isAlive(index_, generation_);
}

template <size_t Capacity>
FORCE_INLINE void TaskHandleBase<Capacity>::wake() const {
  if (LIKELY(isValid())) executor_->wake(index_, generation_);
}

template <size_t Capacity>
FORCE_INLINE void TaskHandleBase<Capacity>::sleep() const {
  if (LIKELY(isValid())) executor_->sleep(index_, generation_);
}

template <size_t Capacity>
FORCE_INLINE void TaskHandleBase<Capacity>::cancel() {
  if (LIKELY(isValid())) {
    executor_->cancel(index_, generation_);
    executor_ = nullptr;
    index_ = 0xFF;
  }
}

template <size_t Capacity>
FORCE_INLINE void TaskHandleBase<Capacity>::setInterval(uint32_t interval_ms) const {
  if (LIKELY(isValid())) executor_->setInterval(index_, generation_, interval_ms);
}

using Executor = ExecutorBase<32>;

} // namespace uniuno
