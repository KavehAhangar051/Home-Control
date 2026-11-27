/**
 * @file ObjectPool.h
 * @brief Zero-heap, O(1) bitmask-backed StaticObjectPool and RAII PooledPtr.
 *
 * Eliminates repeated heap new/delete churn and fragmentation on embedded targets by
 * reusing pre-allocated, properly aligned static object slots in ~3 CPU cycles.
 */

#ifndef ACHAEMENID_OPTIMIZATION_OBJECT_POOL_H
#define ACHAEMENID_OPTIMIZATION_OBJECT_POOL_H

#include <Optimization/CompilerTraits.h>
#include <cstddef>
#include <cstdint>
#include <new>
#include <utility>

namespace uniuno {

/**
 * @brief Fixed-capacity zero-heap object pool (1 <= Capacity <= 32).
 *
 * Slot allocation uses a single 32-bit free bitmap with `__builtin_ctz` (O(1),
 * single-cycle hardware instruction on Xtensa/x86) and placement-new construction.
 */
template <typename T, size_t Capacity> class StaticObjectPool {
  static_assert(Capacity >= 1 && Capacity <= 32, "StaticObjectPool Capacity must be in [1..32]");

public:
  /**
   * @brief Move-only RAII smart pointer that automatically returns an object to its pool
   *        (or deletes it if it was allocated via the optional heap fallback).
   */
  class PooledPtr {
  public:
    PooledPtr() noexcept : pool_(nullptr), ptr_(nullptr), heapFallback_(false) {}
    PooledPtr(StaticObjectPool* pool, T* ptr, bool heapFallback = false) noexcept
        : pool_(pool), ptr_(ptr), heapFallback_(heapFallback) {}

    PooledPtr(const PooledPtr&) = delete;
    PooledPtr& operator=(const PooledPtr&) = delete;

    PooledPtr(PooledPtr&& other) noexcept : pool_(other.pool_), ptr_(other.ptr_), heapFallback_(other.heapFallback_) {
      other.pool_ = nullptr;
      other.ptr_ = nullptr;
      other.heapFallback_ = false;
    }

    PooledPtr& operator=(PooledPtr&& other) noexcept {
      if (this != &other) {
        reset();
        pool_ = other.pool_;
        ptr_ = other.ptr_;
        heapFallback_ = other.heapFallback_;
        other.pool_ = nullptr;
        other.ptr_ = nullptr;
        other.heapFallback_ = false;
      }
      return *this;
    }

    ~PooledPtr() { reset(); }

    void reset() noexcept {
      if (ptr_ != nullptr) {
        if (heapFallback_) {
          delete ptr_;
        } else if (pool_ != nullptr) {
          pool_->release(ptr_);
        }
        ptr_ = nullptr;
        pool_ = nullptr;
        heapFallback_ = false;
      }
    }

    T* get() const noexcept { return ptr_; }
    T& operator*() const noexcept { return *ptr_; }
    T* operator->() const noexcept { return ptr_; }
    explicit operator bool() const noexcept { return ptr_ != nullptr; }
    bool isPooled() const noexcept { return ptr_ != nullptr && !heapFallback_; }

  private:
    StaticObjectPool* pool_;
    T* ptr_;
    bool heapFallback_;
  };

  StaticObjectPool() noexcept : freeMask_(kFullMask) {}

  StaticObjectPool(const StaticObjectPool&) = delete;
  StaticObjectPool& operator=(const StaticObjectPool&) = delete;

  ~StaticObjectPool() {
    uint32_t usedMask = (~freeMask_) & kFullMask;
    while (usedMask != 0U) {
      const unsigned idx = static_cast<unsigned>(__builtin_ctz(usedMask));
      slotPtr(idx)->~T();
      usedMask &= (usedMask - 1U);
    }
    freeMask_ = kFullMask;
  }

  /**
   * @brief Acquire and construct an object from the static pool (returns nullptr if full).
   */
  template <typename... Args> HOT_PATH T* acquireRaw(Args&&... args) {
    if (UNLIKELY(freeMask_ == 0U)) {
      return nullptr;
    }
    const unsigned idx = static_cast<unsigned>(__builtin_ctz(freeMask_));
    freeMask_ &= ~(1U << idx);
    return new (storage_[idx]) T(std::forward<Args>(args)...);
  }

  /**
   * @brief Acquire an RAII PooledPtr from the static pool (empty if full).
   */
  template <typename... Args> HOT_PATH PooledPtr acquire(Args&&... args) {
    T* obj = acquireRaw(std::forward<Args>(args)...);
    return obj != nullptr ? PooledPtr(this, obj, false) : PooledPtr();
  }

  /**
   * @brief Acquire from the static pool; if momentarily exhausted, fall back to nothrow heap.
   */
  template <typename... Args> HOT_PATH PooledPtr acquireOrHeap(Args&&... args) {
    T* obj = acquireRaw(std::forward<Args>(args)...);
    if (LIKELY(obj != nullptr)) {
      return PooledPtr(this, obj, false);
    }
    T* heapObj = new (std::nothrow) T(std::forward<Args>(args)...);
    return heapObj != nullptr ? PooledPtr(nullptr, heapObj, true) : PooledPtr();
  }

  /**
   * @brief Destroy the object and return its slot to the pool bitmap in O(1).
   */
  HOT_PATH void release(T* ptr) noexcept {
    if (UNLIKELY(ptr == nullptr)) return;
    const uintptr_t base = reinterpret_cast<uintptr_t>(&storage_[0][0]);
    const uintptr_t addr = reinterpret_cast<uintptr_t>(ptr);
    if (UNLIKELY(addr < base)) return;
    const uintptr_t offset = addr - base;
    const size_t idx = static_cast<size_t>(offset / sizeof(storage_[0]));
    if (UNLIKELY(idx >= Capacity || (offset % sizeof(storage_[0])) != 0U)) return;
    const uint32_t bit = (1U << idx);
    if (UNLIKELY((freeMask_ & bit) != 0U)) return; // Double-release guard
    ptr->~T();
    freeMask_ |= bit;
  }

  bool owns(const T* ptr) const noexcept {
    if (ptr == nullptr) return false;
    const uintptr_t base = reinterpret_cast<uintptr_t>(&storage_[0][0]);
    const uintptr_t end = base + sizeof(storage_);
    const uintptr_t addr = reinterpret_cast<uintptr_t>(ptr);
    return addr >= base && addr < end && ((addr - base) % sizeof(storage_[0])) == 0U;
  }

  size_t available() const noexcept { return static_cast<size_t>(__builtin_popcount(freeMask_)); }
  size_t inUse() const noexcept { return Capacity - available(); }
  static constexpr size_t capacity() noexcept { return Capacity; }

private:
  static constexpr uint32_t kFullMask = (Capacity == 32U) ? 0xFFFFFFFFU : ((1U << Capacity) - 1U);

  T* slotPtr(size_t idx) noexcept { return reinterpret_cast<T*>(storage_[idx]); }

  alignas(T) uint8_t storage_[Capacity][sizeof(T)];
  uint32_t freeMask_;
};

} // namespace uniuno

#endif // ACHAEMENID_OPTIMIZATION_OBJECT_POOL_H
