/**
 * @file IEventDispatcher.h
 * @brief Interface for event dispatching system
 * @author uniuno
 * 
 * PURPOSE: Decouple components from concrete EventDispatcher implementation
 * BENEFIT: Testability, Extensibility, Dependency Inversion, Zero Heap
 */

#pragma once

#include <cstdint>
#include <cstddef>
#include "EventHash.h"
#include <Optimization/CompilerTraits.h>

namespace uniuno {

/**
 * @class IEventDispatcher
 * @brief Abstract interface for event dispatching
 */
class IEventDispatcher {
public:
  virtual ~IEventDispatcher() = default;

  /**
   * @brief Dispatch event via compile-time pre-computed hash.
   * Pure virtual to allow concrete storage implementation.
   */
  virtual void dispatchByHash(void* event, uint32_t event_hash) = 0;

  /**
   * @brief Dispatch event to registered listeners by string name (runtime).
   */
  virtual void dispatch(void* event, const char* event_name) = 0;

  /**
   * @brief Strongly-typed dispatch helper for any EventType struct with static Name.
   * Computes kEventHash<EventType> at compile-time with 0 runtime string overhead!
   */
  template <typename EventType>
  FORCE_INLINE void dispatch(EventType& event) {
    this->dispatchByHash(&event, kEventHash<EventType>);
  }

  /**
   * @brief Register raw C-style event listener
   */
  virtual uint32_t registerListener(const char* event_name, 
                                    void (*callback)(void*), 
                                    bool is_once = false) = 0;

  /**
   * @brief Remove a specific listener by its subscription ID
   */
  virtual bool removeListenerById(const char* event_name, uint32_t listener_id) = 0;

  /**
   * @brief Remove all listeners for a specific event
   */
  virtual size_t removeListener(const char* event_name) = 0;
};

} // namespace uniuno
