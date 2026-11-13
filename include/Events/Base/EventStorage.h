#pragma once

#include "ListenerEntry.h"
#include <Optimization/StaticArray.h>
#include <Optimization/StaticHashMap.h>
#include <Optimization/CompilerTraits.h>
#include <ErrorHandler.h>

namespace uniuno {

/**
 * @brief Represents a group of listeners for a specific event.
 * Uses 100% pre-allocated RAM to prevent heap fragmentation.
 */
template <size_t MaxListeners = 8>
struct EventGroup {
  uint32_t event_hash = 0;
  bool active = false;
  StaticArray<ListenerEntry, MaxListeners> listeners;
};

/**
 * @class EventStorage
 * @brief Memory management component for Event Dispatcher.
 *
 * Uses a StaticHashMap (uint32_t hash → uint8_t group_index) for O(1) group
 * lookup on every dispatch. The dense EventGroup array is still stored
 * contiguously for cache-friendly iteration during dispatch.
 *
 * StaticHashMap bucket count is 2× MaxEvents (must be power-of-2) to keep
 * the load factor ≤ 0.5 and minimise linear-probing collisions.
 */
template <size_t MaxEvents = 32, size_t MaxListeners = 8>
class EventStorage {
  // Bucket count: smallest power-of-2 that is >= 2*MaxEvents
  static constexpr size_t kBuckets = (MaxEvents <= 32) ? 64 :
                                     (MaxEvents <= 64) ? 128 : 256;

  // Sentinel: group index 0xFF means "not found"
  static constexpr uint8_t kNotFound = 0xFF;

public:
  EventStorage() = default;
  ~EventStorage() = default;

  /**
   * @brief O(1) hash-map lookup for a group by event hash.
   * Falls back to nullptr when the event has no registered listeners.
   */
  HOT_PATH EventGroup<MaxListeners>* findGroup(uint32_t event_hash) {
    const uint8_t* idx = index_.find(event_hash);
    if (UNLIKELY(!idx || *idx == kNotFound)) return nullptr;
    return &groups_[*idx];
  }

  const EventGroup<MaxListeners>* findGroup(uint32_t event_hash) const {
    const uint8_t* idx = index_.find(event_hash);
    if (UNLIKELY(!idx || *idx == kNotFound)) return nullptr;
    return &groups_[*idx];
  }

  /**
   * @brief Find existing group or allocate a new slot.
   * Inserts the new hash → index mapping into the StaticHashMap.
   */
  EventGroup<MaxListeners>* getOrCreateGroup(uint32_t event_hash) {
    // Fast path: already exists
    uint8_t* idx = index_.find(event_hash);
    if (idx) return &groups_[*idx];

    // Slow path: create a new group
    if (UNLIKELY(groups_.full())) {
      ErrorHandler::getInstance().reportError("EventStorage", "Max events reached", ErrorSeverity::WARNING);
      return nullptr;
    }

    uint8_t new_idx = static_cast<uint8_t>(groups_.size());
    EventGroup<MaxListeners> new_group;
    new_group.event_hash = event_hash;
    new_group.active = true;
    groups_.push_back(std::move(new_group));

    index_.insert(event_hash, new_idx);
    return &groups_[new_idx];
  }

  void clear() {
    groups_.clear();
    index_.clear();
  }
  
  const StaticArray<EventGroup<MaxListeners>, MaxEvents>& getAllGroups() const { return groups_; }
  StaticArray<EventGroup<MaxListeners>, MaxEvents>& getAllGroups() { return groups_; }

private:
  StaticArray<EventGroup<MaxListeners>, MaxEvents> groups_;

  /**
   * Key:   uint32_t event_hash
   * Value: uint8_t  index into groups_ array
   * Size:  kBuckets (power-of-2 for fast modulo in StaticHashMap)
   */
  StaticHashMap<uint32_t, uint8_t, kBuckets> index_;
};

} // namespace uniuno
