#pragma once

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <utility>
#include <memory>
#include <new>
#include <type_traits>
#include <initializer_list>
#include "Optimization/CompilerTraits.h"
#include "Optimization/XtensaMemAsm.h"

#ifdef ESP32
#include <esp_heap_caps.h>
#endif

namespace uniuno {

namespace sv_detail {

using xtensa_asm::asm_copy_words;
using xtensa_asm::asm_shift_left_words;
using xtensa_asm::asm_shift_right_words;

FORCE_INLINE void* alloc_internal(std::size_t bytes) {
#ifdef ESP32
  return heap_caps_malloc(bytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
#else
  return std::malloc(bytes);
#endif
}

FORCE_INLINE void* realloc_internal(void* ptr, std::size_t bytes) {
#ifdef ESP32
  return heap_caps_realloc(ptr, bytes, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
#else
  return std::realloc(ptr, bytes);
#endif
}

FORCE_INLINE void free_internal(void* ptr) {
  if (ptr) {
#ifdef ESP32
    heap_caps_free(ptr);
#else
    std::free(ptr);
#endif
  }
}

} // namespace sv_detail

/**
 * @brief High-velocity Xtensa-optimized SmallVector (3-pointer layout, zero ArrayBase tax).
 *
 * Architecture:
 *  - Decoupled from type-erased ArrayBase: eliminates runtime elem_size multiplies,
 *    fixed_capacity_ branches, and out-of-line call8 hops on erase/insert/reserve.
 *  - Compact 12-byte 3-pointer header (begin_, end_, cap_end_):
 *      * push_back / emplace_back write directly to *end_++ without size_ * sizeof(T)!
 *      * end(), back(), pop_back(), clear() execute in 1-2 CPU instructions.
 *      * is_heap() requires zero boolean field (begin_ != inline_ptr()).
 *  - Space-for-Time SBO expansion: small vectors (<=32B inline) expand to 8 inline slots
 *    to eliminate heap allocations for HTTP headers / policy lists.
 *  - Word-aligned trivial types use Xtensa loopnez inline assembly for copy/erase/insert.
 */
template <typename T, std::size_t N = 4, typename Allocator = std::allocator<T>> class SmallVector {
public:
  using value_type = T;

  // Space-for-Time SBO: expand tiny inline buffers (<=32B) to 8 slots to avoid heap spill
  static constexpr std::size_t kInlineCap = (N > 0 && N < 8 && (N * sizeof(T) <= 32)) ? 8 : N;

  FORCE_INLINE SmallVector();
  FORCE_INLINE ~SmallVector();

  SmallVector(const SmallVector& other);
  SmallVector& operator=(const SmallVector& other);
  SmallVector(SmallVector&& other) noexcept;
  SmallVector& operator=(SmallVector&& other) noexcept;

  SmallVector(std::initializer_list<T> init);
  SmallVector& operator=(std::initializer_list<T> init);

  void reserve(std::size_t new_cap);

  FORCE_INLINE void push_back(const T& value);
  FORCE_INLINE void push_back(T&& value);
  template <typename... Args> FORCE_INLINE void emplace_back(Args&&... args);
  FORCE_INLINE void pop_back();
  FORCE_INLINE void clear();

  FORCE_INLINE void erase(std::size_t index);
  FORCE_INLINE T* erase(T* pos);
  T* erase(T* first, T* last);

  /** @brief O(1) unordered erase: swaps target with back element, zero shifting. */
  FORCE_INLINE void erase_unordered(std::size_t index);

  void insert(T* pos, const T& value) = delete;
  void insert(T* pos, T&& value);

  FORCE_INLINE bool full() const { return end_ == cap_end_; }
  FORCE_INLINE bool empty() const { return begin_ == end_; }
  FORCE_INLINE std::size_t size() const { return static_cast<std::size_t>(end_ - begin_); }
  FORCE_INLINE std::size_t capacity() const { return static_cast<std::size_t>(cap_end_ - begin_); }
  FORCE_INLINE void shrink_to_fit() {} // No-op for inline/SBO storage

  // Fast path: set active element count directly (e.g., after socket bulk read)
  FORCE_INLINE void force_set_size(std::size_t new_size) { end_ = begin_ + new_size; }
  FORCE_INLINE bool is_heap() const { return begin_ != inline_ptr(); }

  FORCE_INLINE T& operator[](std::size_t idx) { return begin_[idx]; }
  FORCE_INLINE const T& operator[](std::size_t idx) const { return begin_[idx]; }

  FORCE_INLINE T* data() { return begin_; }
  FORCE_INLINE const T* data() const { return begin_; }

  FORCE_INLINE T* begin() { return begin_; }
  FORCE_INLINE T* end() { return end_; }
  FORCE_INLINE const T* begin() const { return begin_; }
  FORCE_INLINE const T* end() const { return end_; }

  FORCE_INLINE T& front() { return *begin_; }
  FORCE_INLINE const T& front() const { return *begin_; }
  FORCE_INLINE T& back() { return *(end_ - 1); }
  FORCE_INLINE const T& back() const { return *(end_ - 1); }

private:
  using IsWordTrivial = std::integral_constant<bool, std::is_trivially_copyable<T>::value && ((sizeof(T) % 4) == 0)>;
  using IsByteTrivial = std::integral_constant<bool, std::is_trivially_copyable<T>::value && ((sizeof(T) % 4) != 0)>;

  FORCE_INLINE T* inline_ptr() { return reinterpret_cast<T*>(stack_storage_); }
  FORCE_INLINE const T* inline_ptr() const { return reinterpret_cast<const T*>(stack_storage_); }

  // Cold out-of-line growth path keeps push_back()/emplace_back() tiny in ICache
  __attribute__((noinline)) void grow_for_push();

  FORCE_INLINE static void copy_elements(T* __restrict__ dst, const T* __restrict__ src, std::size_t count);
  FORCE_INLINE static void move_elements(T* __restrict__ dst, T* __restrict__ src, std::size_t count);
  FORCE_INLINE static void destroy_range(T* first, T* last);

  // Compact 12-byte 3-pointer header (offsets 0, 4, 8 -> 16-bit l32i.n instructions)
  T* begin_;
  T* end_;
  T* cap_end_;

  // 32-bit and T-aligned inline SBO buffer directly after header
  alignas(T) alignas(uint32_t) uint8_t stack_storage_[kInlineCap * sizeof(T)];
};

} // namespace uniuno
