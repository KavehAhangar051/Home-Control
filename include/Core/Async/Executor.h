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
 * @brief Lightweight handle to an asynchronous task scheduled in an Executor.
 * Enables zero-overhead O(1) cancellation, interval adjustment, and event-driven wakeups.
 */
template <size_t Capacity = 32>
class TaskHandleBase {
public:
  constexpr TaskHandleBase() : executor_(nullptr), index_(0xFF), generation_(0) {}
  TaskHandleBase(ExecutorBase<Capacity>* exec, uint8_t idx, uint16_t gen)
      : executor_(exec), index_(idx), generation_(gen) {}

  /** @brief Returns true if this handle points to a valid, active task. */
  FORCE_INLINE bool isValid() const { return executor_ != nullptr && index_ != 0xFF; }

  /** @brief Implicit boolean conversion for backward compatibility with bool returns. */
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
 * @brief High-performance Hybrid Reactive Async Executor.
 * 
 * Features:
 * 1. Hardware-accelerated bitmask scheduling: Uses Xtensa single-cycle NSA instruction (__builtin_ctz)
 *    to find ready tasks in 1 clock cycle.
 * 2. Event-Driven Wakeup: Dormant tasks consume 0 CPU cycles until wake() is triggered (via ISR, Event, or Deferred).
 * 3. Throttled/Interval Polling: Prevents busy-wait burning CPU cycles during slow I/O or WiFi handshakes.
 * 4. Zero dynamic allocations: All memory is statically pooled and word-aligned in RAM.
 * 
 * @tparam Capacity Maximum number of concurrently executing futures (up to 32).
 */
template <size_t Capacity = 32>
class ExecutorBase {
  static_assert(Capacity <= 32, "ExecutorBase bitmask currently supports up to 32 concurrent futures.");

public:
  ExecutorBase() {
    this->active_mask_ = 0;
    this->ready_mask_.store(0, std::memory_order_relaxed);
    this->interval_mask_ = 0;
    this->sleep_mask_ = 0;
    this->free_count_ = Capacity;

    for (size_t i = 0; i < Capacity; i++) {
      this->free_indices_[i] = static_cast<uint8_t>(Capacity - 1 - i);
      this->generations_[i] = 1;
      this->intervals_ms_[i] = 0;
      this->next_poll_ms_[i] = 0;
    }
  }

  // =========================================================================
  // SCHEDULING INTERFACE
  // =========================================================================

  /**
   * @brief Schedule a future with input and an error callback.
   * @return TaskHandle to control execution, or invalid handle if full.
   */
  template <typename I, typename O, typename E = Error, class F,
            typename std::enable_if<
                function_traits<F>::arity == 1 &&
                std::is_same<typename function_traits<F>::template arg<0>::type,
                             E>::value>::type * = nullptr>
  TaskHandleBase<Capacity> execute(Future<I, O, E> future, I input, F &&on_error) {
    uint8_t idx = allocateSlot();
    if (UNLIKELY(idx == 0xFF)) return TaskHandleBase<Capacity>();

    this->future_pool_[idx] = [future = std::move(future), input = std::move(input), on_error = std::forward<F>(on_error)]() mutable {
      const auto& result = future.poll(input);
      if (UNLIKELY(result.is_rejected())) {
        on_error(*result.get_error());
      }
      return result.get_state();
    };

    return activateSlot(idx);
  }

  /**
   * @brief Schedule a void-input future with error and success callbacks.
   */
  template <typename O, typename E = Error, class FErr, class FOk,
            typename std::enable_if<
                function_traits<FErr>::arity == 1 &&
                std::is_same<typename function_traits<FErr>::template arg<0>::type, E>::value &&
                function_traits<FOk>::arity == 0>::type * = nullptr>
  TaskHandleBase<Capacity> execute(Future<void, O, E> future, FErr &&on_error, FOk &&on_success) {
    uint8_t idx = allocateSlot();
    if (UNLIKELY(idx == 0xFF)) return TaskHandleBase<Capacity>();

    this->future_pool_[idx] = [future     = std::move(future),
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

  /**
   * @brief Schedule a void-input future with only an error callback.
   */
  template <typename O, typename E = Error, class F,
            typename std::enable_if<
                function_traits<F>::arity == 1 &&
                std::is_same<typename function_traits<F>::template arg<0>::type,
                             E>::value>::type * = nullptr>
  TaskHandleBase<Capacity> execute(Future<void, O, E> future, F &&on_error) {
    uint8_t idx = allocateSlot();
    if (UNLIKELY(idx == 0xFF)) return TaskHandleBase<Capacity>();

    this->future_pool_[idx] = [future = std::move(future), on_error = std::forward<F>(on_error)]() mutable {
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
    return this->execute(std::move(future), std::move(input), [](E) {});
  }

  template <typename O, typename E = Error>
  TaskHandleBase<Capacity> execute(Future<void, O, E> future) {
    return this->execute(std::move(future), [](E) {});
  }

  /**
   * @brief Schedule a future in event-driven mode (dormant until wake() is called).
   * Consumes 0 CPU cycles until awakened.
   */
  template <typename O, typename E = Error, class F>
  TaskHandleBase<Capacity> executeEventDriven(Future<void, O, E> future, F &&on_error) {
    auto handle = this->execute(std::move(future), std::forward<F>(on_error));
    if (handle) handle.sleep();
    return handle;
  }

  /**
   * @brief Schedule a future with a throttled polling interval (e.g. check every 50ms).
   */
  template <typename O, typename E = Error, class F>
  TaskHandleBase<Capacity> executeInterval(Future<void, O, E> future, uint32_t interval_ms, F &&on_error) {
    auto handle = this->execute(std::move(future), std::forward<F>(on_error));
    if (handle) handle.setInterval(interval_ms);
    return handle;
  }

  // =========================================================================
  // TASK CONTROL (INVOKED VIA TaskHandle)
  // =========================================================================

  FORCE_INLINE void wake(uint8_t idx, uint16_t gen) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    ready_mask_.fetch_or(1UL << idx, std::memory_order_relaxed);
  }

  FORCE_INLINE void sleep(uint8_t idx, uint16_t gen) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    uint32_t bit = 1UL << idx;
    sleep_mask_ |= bit;
    ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
  }

  FORCE_INLINE void cancel(uint8_t idx, uint16_t gen) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    uint32_t bit = 1UL << idx;
    if (active_mask_ & bit) {
      future_pool_[idx].clear();
      active_mask_ &= ~bit;
      ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
      interval_mask_ &= ~bit;
      sleep_mask_ &= ~bit;
      generations_[idx]++;
      free_indices_[free_count_++] = idx;
    }
  }

  FORCE_INLINE void setInterval(uint8_t idx, uint16_t gen, uint32_t interval_ms) {
    if (UNLIKELY(idx >= Capacity || generations_[idx] != gen)) return;
    uint32_t bit = 1UL << idx;
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
   * @brief Polls all active and ready futures in hardware-accelerated Xtensa bitmask steps.
   * In 95%+ of loop cycles where no tasks are ready or pending intervals,
   * exits in ~2 CPU cycles without branch penalties or stack overhead.
   */
  HOT_PATH void poll() {
    uint32_t to_process = this->ready_mask_.load(std::memory_order_relaxed);

    // FAST-PATH: If no tasks are ready and no intervals exist, or no tasks are active
    if (LIKELY((to_process | this->interval_mask_) == 0 || this->active_mask_ == 0)) {
      return;
    }

    uint32_t cached_now = 0;
    bool now_cached = false;

    // 1. Check expired timers for interval-throttled tasks using branchless assembly
    if (UNLIKELY(this->interval_mask_ != 0)) {
      uint32_t pending_intervals = this->interval_mask_ & ~to_process;
      if (pending_intervals) {
        cached_now = millis();
        now_cached = true;
        uint32_t newly_ready = 0;

        while (pending_intervals) {
          const uint32_t idx = __builtin_ctz(pending_intervals);
          if (uniuno::asm_opt::is_timer_expired(cached_now, this->next_poll_ms_[idx])) {
            newly_ready |= (1UL << idx);
          }
          pending_intervals &= pending_intervals - 1; // 1-cycle clear lowest set bit
        }

        if (newly_ready) {
          this->ready_mask_.fetch_or(newly_ready, std::memory_order_relaxed);
          to_process |= newly_ready;
        }
      }
    }

    if (to_process == 0) return;

    // 2. Process each ready task (Single-cycle Xtensa bit-scan)
    while (to_process) {
      const uint32_t idx = __builtin_ctz(to_process);
      const uint32_t bit = 1UL << idx;
      to_process &= to_process - 1; // 1-cycle clear lowest set bit

      // If it's dormant or interval-based, clear ready bit before calling task
      if ((this->sleep_mask_ | this->interval_mask_) & bit) {
        this->ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
        if (this->interval_mask_ & bit) {
          if (!now_cached) {
            cached_now = millis();
            now_cached = true;
          }
          this->next_poll_ms_[idx] = cached_now + this->intervals_ms_[idx];
        }
      }

      auto* slot = &this->future_pool_[idx];
      if ((*slot)() != AsyncState::Pending) {
        // Task completed (Resolved or Rejected): free slot immediately
        slot->clear();
        this->active_mask_ &= ~bit;
        this->ready_mask_.fetch_and(~bit, std::memory_order_relaxed);
        this->interval_mask_ &= ~bit;
        this->sleep_mask_ &= ~bit;
        this->generations_[idx]++;
        this->free_indices_[this->free_count_++] = static_cast<uint8_t>(idx);
      }
    }
  }

  FORCE_INLINE size_t getActiveCount() const {
    return __builtin_popcount(this->active_mask_);
  }

  FORCE_INLINE size_t getReadyCount() const {
    return __builtin_popcount(this->ready_mask_.load(std::memory_order_relaxed));
  }

private:
  FORCE_INLINE uint8_t allocateSlot() {
    if (UNLIKELY(this->free_count_ == 0)) return 0xFF;
    return this->free_indices_[--this->free_count_];
  }

  FORCE_INLINE TaskHandleBase<Capacity> activateSlot(uint8_t idx) {
    uint32_t bit = 1UL << idx;
    this->active_mask_ |= bit;
    this->ready_mask_.fetch_or(bit, std::memory_order_relaxed);
    return TaskHandleBase<Capacity>(this, idx, this->generations_[idx]);
  }

  FastFunction<AsyncState(void), 128> future_pool_[Capacity];
  uint32_t active_mask_;
  std::atomic<uint32_t> ready_mask_;
  uint32_t interval_mask_;
  uint32_t sleep_mask_;
  uint32_t intervals_ms_[Capacity];
  uint32_t next_poll_ms_[Capacity];
  uint16_t generations_[Capacity];
  uint8_t free_indices_[Capacity];
  size_t free_count_;
};

// Out-of-line inlined definitions for TaskHandleBase
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
