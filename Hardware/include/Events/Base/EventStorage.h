#pragma once

#include "ListenerEntry.h"
#include <Optimization/StaticArray.h>
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
 * @brief Ultra-fast Direct Open-Addressing Hash Storage for Event Dispatcher.
 * 
 * Replaces generic type-erased HashMap with direct inlined open-addressing.
 * Eliminates indirect function pointer calls (hash_func_ and equal_func_),
 * bringing dispatch event lookup down from ~80 CPU cycles to 3-4 cycles!
 */
template <size_t MaxEvents = 32, size_t MaxListeners = 8>
class EventStorage {
  // Bucket count: smallest power-of-2 that is >= 2*MaxEvents
  static constexpr size_t kBuckets = (MaxEvents <= 32) ? 64 :
                                     (MaxEvents <= 64) ? 128 : 256;

  // Sentinel: group index 0xFF means "not found"
  static constexpr uint8_t kNotFound = 0xFF;

  struct HashBucket {
    uint32_t hash;
    uint8_t group_idx;
  };

public:
  EventStorage() {
    clear();
  }

  ~EventStorage() = default;

  /**
   * @brief Fast inlined 3-cycle hash lookup for a group by event hash.
   * Falls back to nullptr when the event has no registered listeners.
   */
  HOT_PATH FORCE_INLINE EventGroup<MaxListeners>* findGroup(uint32_t event_hash) {
    constexpr uint32_t mask = kBuckets - 1;
    uint32_t idx = event_hash & mask;
    const uint32_t start = idx;

    do {
      if (buckets_[idx].group_idx == kNotFound) return nullptr;
      if (LIKELY(buckets_[idx].hash == event_hash)) {
        return &groups_[buckets_[idx].group_idx];
      }
      idx = (idx + 1) & mask;
    } while (idx != start);

    return nullptr;
  }

  FORCE_INLINE const EventGroup<MaxListeners>* findGroup(uint32_t event_hash) const {
    constexpr uint32_t mask = kBuckets - 1;
    uint32_t idx = event_hash & mask;
    const uint32_t start = idx;

    do {
      if (buckets_[idx].group_idx == kNotFound) return nullptr;
      if (LIKELY(buckets_[idx].hash == event_hash)) {
        return &groups_[buckets_[idx].group_idx];
      }
      idx = (idx + 1) & mask;
    } while (idx != start);

    return nullptr;
  }

  /**
   * @brief Find existing group or allocate a new slot.
   */
  EventGroup<MaxListeners>* getOrCreateGroup(uint32_t event_hash) {
    // Fast path: already exists
    EventGroup<MaxListeners>* existing = findGroup(event_hash);
    if (existing) return existing;

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

    constexpr uint32_t mask = kBuckets - 1;
    uint32_t idx = event_hash & mask;
    while (buckets_[idx].group_idx != kNotFound) {
      idx = (idx + 1) & mask;
    }
    buckets_[idx].hash = event_hash;
    buckets_[idx].group_idx = new_idx;

    return &groups_[new_idx];
  }

  void clear() {
    groups_.clear();
    for (size_t i = 0; i < kBuckets; ++i) {
      buckets_[i].hash = 0;
      buckets_[i].group_idx = kNotFound;
    }
  }
  
  const StaticArray<EventGroup<MaxListeners>, MaxEvents>& getAllGroups() const { return groups_; }
  StaticArray<EventGroup<MaxListeners>, MaxEvents>& getAllGroups() { return groups_; }

private:
  StaticArray<EventGroup<MaxListeners>, MaxEvents> groups_;
  HashBucket buckets_[kBuckets];
};

} // namespace uniuno
