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
  // dispatch<EventType>(event ref) — compile-time hash, no string loop
  // -------------------------------------------------------------------------
  template <typename EventType>
  void dispatch(EventType& event) {
    this->dispatchEvent(&event, kEventHash<EventType>);
  }

  // -------------------------------------------------------------------------
  // hasListeners<EventType>() — check before constructing heavy event objects
  // -------------------------------------------------------------------------
  template <typename EventType>
  bool hasListeners() const {
    return this->BaseEventDispatcher<MaxEvents, MaxListeners>::count(kEventHash<EventType>) > 0;
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
