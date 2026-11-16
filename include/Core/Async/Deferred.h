#pragma once

#include "AsyncResult.h"
#include "Future.h"
#include "Executor.h"
#include "Optimization/AtomicSharedPtr.h"

namespace uniuno {

/**
 * @brief Internal shared state between a Deferred promise and its Futures.
 */
template <typename O, typename E = Error>
struct DeferredState {
    AsyncResult<O, E> result;
    TaskHandle task_handle;

    DeferredState() : result(AsyncResult<O, E>::pending()) {}
};

/**
 * @brief High-performance Reactive Promise (Deferred) object.
 * 
 * Supports zero-overhead Waker-driven wakeups: When attached to an Executor TaskHandle,
 * the task can sleep with 0% CPU usage until resolve() or reject() is called,
 * waking the executor task in a single CPU cycle.
 * 
 * @tparam I The input type of the future.
 * @tparam O The output type of the future.
 * @tparam E The error type of the future.
 */
template <typename I, typename O, typename E = Error>
class Deferred {
public:
    Deferred() : state(AtomicSharedPtr<DeferredState<O, E>>::make()) {}

    /** @brief Attaches a TaskHandle to wake up the task immediately when resolved/rejected. */
    void attachTask(TaskHandle handle) {
        if (state) state->task_handle = handle;
    }

    /** @brief Resolves the deferred with the given output and wakes any attached task in 1 cycle. */
    void resolve(O output) {
        if (state && state->result.is_pending()) {
            state->result = AsyncResult<O, E>::resolve(std::move(output));
            if (state->task_handle) state->task_handle.wake();
        }
    }

    /** @brief Rejects the deferred with the given error and wakes any attached task in 1 cycle. */
    void reject(E error) {
        if (state && state->result.is_pending()) {
            state->result = AsyncResult<O, E>::reject(std::move(error));
            if (state->task_handle) state->task_handle.wake();
        }
    }

    /** @brief Returns true if the deferred has not yet been resolved or rejected. */
    FORCE_INLINE bool is_pending() const { return state ? state->result.is_pending() : false; }
    FORCE_INLINE bool is_resolved() const { return state ? state->result.is_resolved() : false; }
    FORCE_INLINE bool is_rejected() const { return state ? state->result.is_rejected() : false; }

    /** @brief Gets a Future linked to this Deferred object. */
    Future<I, O, E> get_future() const {
        return Future<I, O, E>([state = this->state](I) mutable -> AsyncResult<O, E> {
            return state ? state->result : AsyncResult<O, E>::pending();
        });
    }

private:
    AtomicSharedPtr<DeferredState<O, E>> state;
};

/**
 * @brief Deferred specialization for void input.
 */
template <typename O, typename E>
class Deferred<void, O, E> {
public:
    Deferred() : state(AtomicSharedPtr<DeferredState<O, E>>::make()) {}

    void attachTask(TaskHandle handle) {
        if (state) state->task_handle = handle;
    }

    void resolve(O output) {
        if (state && state->result.is_pending()) {
            state->result = AsyncResult<O, E>::resolve(std::move(output));
            if (state->task_handle) state->task_handle.wake();
        }
    }

    void reject(E error) {
        if (state && state->result.is_pending()) {
            state->result = AsyncResult<O, E>::reject(std::move(error));
            if (state->task_handle) state->task_handle.wake();
        }
    }

    FORCE_INLINE bool is_pending() const { return state ? state->result.is_pending() : false; }
    FORCE_INLINE bool is_resolved() const { return state ? state->result.is_resolved() : false; }
    FORCE_INLINE bool is_rejected() const { return state ? state->result.is_rejected() : false; }

    Future<void, O, E> get_future() const {
        return Future<void, O, E>([state = this->state]() mutable -> AsyncResult<O, E> {
            return state ? state->result : AsyncResult<O, E>::pending();
        });
    }

    /**
     * @brief Schedules this Deferred in an Executor in EventDriven (0% CPU sleep) mode.
     * Wakes automatically in 1 CPU cycle when resolve() or reject() is called.
     */
    template <typename FErr>
    TaskHandle execute(Executor& executor, FErr&& on_error) {
        auto fut = this->get_future();
        TaskHandle handle = executor.executeEventDriven(std::move(fut), std::forward<FErr>(on_error));
        this->attachTask(handle);
        return handle;
    }

private:
    AtomicSharedPtr<DeferredState<O, E>> state;
};

/**
 * @brief Deferred specialization for void input and void output.
 */
template <typename E>
class Deferred<void, void, E> {
public:
    Deferred() : state(AtomicSharedPtr<DeferredState<void, E>>::make()) {}

    void attachTask(TaskHandle handle) {
        if (state) state->task_handle = handle;
    }

    void resolve() {
        if (state && state->result.is_pending()) {
            state->result = AsyncResult<void, E>::resolve();
            if (state->task_handle) state->task_handle.wake();
        }
    }

    void reject(E error) {
        if (state && state->result.is_pending()) {
            state->result = AsyncResult<void, E>::reject(std::move(error));
            if (state->task_handle) state->task_handle.wake();
        }
    }

    FORCE_INLINE bool is_pending() const { return state ? state->result.is_pending() : false; }
    FORCE_INLINE bool is_resolved() const { return state ? state->result.is_resolved() : false; }
    FORCE_INLINE bool is_rejected() const { return state ? state->result.is_rejected() : false; }

    Future<void, void, E> get_future() const {
        return Future<void, void, E>([state = this->state]() mutable -> AsyncResult<void, E> {
            return state ? state->result : AsyncResult<void, E>::pending();
        });
    }

    /**
     * @brief Schedules this Deferred in an Executor in EventDriven (0% CPU sleep) mode.
     */
    template <typename FErr>
    TaskHandle execute(Executor& executor, FErr&& on_error) {
        auto fut = this->get_future();
        TaskHandle handle = executor.executeEventDriven(std::move(fut), std::forward<FErr>(on_error));
        this->attachTask(handle);
        return handle;
    }

private:
    AtomicSharedPtr<DeferredState<void, E>> state;
};

} // namespace uniuno
