#pragma once

#include "EventDispatcherInterface.h"

namespace uniuno {

template <size_t MaxEvents = 32, size_t MaxListeners = 8>
class EventDispatcherBase : public EventDispatcherCoreBase<MaxEvents, MaxListeners> {
public:
  using EventDispatcherCoreBase<MaxEvents, MaxListeners>::dispatch;
  using EventDispatcherCoreBase<MaxEvents, MaxListeners>::removeListener;
  using EventDispatcherCoreBase<MaxEvents, MaxListeners>::removeListenerById;
  using EventDispatcherCoreBase<MaxEvents, MaxListeners>::count;

  // -------------------------------------------------------------------------
  // on<EventType>(function pointer) — zero-overhead path, no FastFunction wrap
  // -------------------------------------------------------------------------
  template <typename EventType>
  uint32_t on(void (*callback)(EventType*)) {
    if (UNLIKELY(!callback)) return 0;
    auto func = FastFunction<void(void*)>([callback](void* event) {
        callback(static_cast<EventType*>(event));
    });
    return this->addListener(kEventHash<EventType>, std::move(func), false);
  }

  // -------------------------------------------------------------------------
  // on<EventType>(lambda by move) — captures by value, forwarded into storage
  // -------------------------------------------------------------------------
  template <typename EventType, typename Lambda>
  uint32_t on(Lambda&& lambda) {
    auto func = FastFunction<void(void*)>([lambda = std::forward<Lambda>(lambda)](void* event) mutable {
        lambda(static_cast<EventType*>(event));
    });
    return this->addListener(kEventHash<EventType>, std::move(func), false);
  }

  // -------------------------------------------------------------------------
  // on<EventType>(pointer to functor/object)
  // -------------------------------------------------------------------------
  template <typename EventType, typename Lambda>
  uint32_t on(Lambda* lambda) {
    if (UNLIKELY(!lambda)) return 0;
    auto func = FastFunction<void(void*)>([lambda](void* event) {
        (*lambda)(static_cast<EventType*>(event));
    });
    return this->addListener(kEventHash<EventType>, std::move(func), false);
  }

  // -------------------------------------------------------------------------
  // once<EventType> — fires once then auto-removes (by move)
  // -------------------------------------------------------------------------
  template <typename EventType, typename Lambda>
  uint32_t once(Lambda&& lambda) {
    auto func = FastFunction<void(void*)>([lambda = std::forward<Lambda>(lambda)](void* event) mutable {
        lambda(static_cast<EventType*>(event));
    });
    return this->addListener(kEventHash<EventType>, std::move(func), true);
  }

  // -------------------------------------------------------------------------
  // once<EventType> — fires once (pointer to functor)
  // -------------------------------------------------------------------------
  template <typename EventType, typename Lambda>
  uint32_t once(Lambda* lambda) {
    if (UNLIKELY(!lambda)) return 0;
    auto func = FastFunction<void(void*)>([lambda](void* event) {
        (*lambda)(static_cast<EventType*>(event));
    });
    return this->addListener(kEventHash<EventType>, std::move(func), true);
  }

  // -------------------------------------------------------------------------
  // dispatch<EventType>(event ref) — Ultra-Fast Template Static Group Cache
  // Eliminates hash table lookup completely on steady-state dispatches!
  // -------------------------------------------------------------------------
  template <typename EventType>
  HOT_PATH FORCE_INLINE void dispatch(EventType& event) {
    static EventGroup<MaxListeners>* s_cachedGroup = nullptr;
    static uint32_t s_cachedGen = 0;

    auto& storage = this->getStorage();
    if (UNLIKELY(s_cachedGroup == nullptr || s_cachedGen != storage.generation())) {
      s_cachedGroup = storage.findGroup(kEventHash<EventType>);
      s_cachedGen = storage.generation();
      if (UNLIKELY(!s_cachedGroup)) return;
    }

    this->invokeGroup(s_cachedGroup, &event);
  }

  // -------------------------------------------------------------------------
  // hasListeners<EventType>() — check before constructing heavy event objects
  // -------------------------------------------------------------------------
  template <typename EventType>
  HOT_PATH FORCE_INLINE bool hasListeners() const {
    static const EventGroup<MaxListeners>* s_cachedGroup = nullptr;
    static uint32_t s_cachedGen = 0;

    const auto& storage = this->getStorage();
    if (UNLIKELY(s_cachedGroup == nullptr || s_cachedGen != storage.generation())) {
      s_cachedGroup = storage.findGroup(kEventHash<EventType>);
      s_cachedGen = storage.generation();
    }
    return s_cachedGroup != nullptr && s_cachedGroup->active && !s_cachedGroup->listeners.empty();
  }

  // -------------------------------------------------------------------------
  // removeListener / removeListenerById / count — typed overloads
  // -------------------------------------------------------------------------
  template <typename EventType>
  size_t removeListener() {
    return this->BaseEventDispatcher<MaxEvents, MaxListeners>::removeListener(kEventHash<EventType>);
  }

  template <typename EventType>
  bool removeListenerById(uint32_t listener_id) {
    return this->BaseEventDispatcher<MaxEvents, MaxListeners>::removeListenerById(kEventHash<EventType>, listener_id);
  }

  template <typename EventType>
  size_t count() const {
    return this->BaseEventDispatcher<MaxEvents, MaxListeners>::count(kEventHash<EventType>);
  }
};

using EventDispatcher = EventDispatcherBase<32, 8>;

} // namespace uniuno
