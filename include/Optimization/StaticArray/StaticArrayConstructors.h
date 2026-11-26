#pragma once

#include "StaticArrayDecl.h"

namespace uniuno {

namespace sa_detail {

template <typename T>
FORCE_INLINE void copy_elems(T* __restrict__ dst, const T* __restrict__ src, uint32_t count,
                             std::true_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  xtensa_asm::asm_copy_words(reinterpret_cast<uint32_t*>(dst), reinterpret_cast<const uint32_t*>(src),
                             count * static_cast<uint32_t>(sizeof(T) / 4));
}

template <typename T>
FORCE_INLINE void copy_elems(T* __restrict__ dst, const T* __restrict__ src, uint32_t count,
                             std::false_type /*word_trivial*/, std::true_type /*byte_trivial*/) {
  if (LIKELY(count > 0)) std::memcpy(dst, src, static_cast<size_t>(count) * sizeof(T));
}

template <typename T>
FORCE_INLINE void copy_elems(T* __restrict__ dst, const T* __restrict__ src, uint32_t count,
                             std::false_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  for (uint32_t i = 0; i < count; ++i) {
    new (dst + i) T(src[i]);
  }
}

template <typename T>
FORCE_INLINE void move_elems(T* __restrict__ dst, T* __restrict__ src, uint32_t count, std::true_type /*word_trivial*/,
                             std::false_type /*byte_trivial*/) {
  xtensa_asm::asm_copy_words(reinterpret_cast<uint32_t*>(dst), reinterpret_cast<const uint32_t*>(src),
                             count * static_cast<uint32_t>(sizeof(T) / 4));
}

template <typename T>
FORCE_INLINE void move_elems(T* __restrict__ dst, T* __restrict__ src, uint32_t count, std::false_type /*word_trivial*/,
                             std::true_type /*byte_trivial*/) {
  if (LIKELY(count > 0)) std::memcpy(dst, src, static_cast<size_t>(count) * sizeof(T));
}

template <typename T>
FORCE_INLINE void move_elems(T* __restrict__ dst, T* __restrict__ src, uint32_t count, std::false_type /*word_trivial*/,
                             std::false_type /*byte_trivial*/) {
  for (uint32_t i = 0; i < count; ++i) {
    new (dst + i) T(std::move(src[i]));
    src[i].~T();
  }
}

template <typename T>
FORCE_INLINE void destroy_elems(T* /*first*/, uint32_t /*count*/, std::true_type /*trivial_dtor*/) {
  // Zero cost in assembly (0 instructions for TimerNode*, TimerId, etc.)
}

template <typename T> FORCE_INLINE void destroy_elems(T* first, uint32_t count, std::false_type /*trivial_dtor*/) {
  for (uint32_t i = 0; i < count; ++i) {
    first[i].~T();
  }
}

} // namespace sa_detail

// ---------------------------------------------------------------------------
// Default constructor & Destructor (2 cycles construct, 0 cycles destroy for PODs!)
// ---------------------------------------------------------------------------
template <typename T, size_t MaxSize> FORCE_INLINE StaticArray<T, MaxSize>::StaticArray() : size_(0) {}

template <typename T, size_t MaxSize> FORCE_INLINE StaticArray<T, MaxSize>::~StaticArray() {
  sa_detail::destroy_elems(data(), size_, std::is_trivially_destructible<T>{});
}

// ---------------------------------------------------------------------------
// Copy & Move constructors/assignments (only touch active [0..size_) elements!)
// ---------------------------------------------------------------------------
template <typename T, size_t MaxSize>
StaticArray<T, MaxSize>::StaticArray(const StaticArray& other) : size_(other.size_) {
  if (size_ > 0) {
    sa_detail::copy_elems(data(), other.data(), size_, IsWordTrivial{}, IsByteTrivial{});
  }
}

template <typename T, size_t MaxSize>
StaticArray<T, MaxSize>& StaticArray<T, MaxSize>::operator=(const StaticArray& other) {
  if (LIKELY(this != &other)) {
    clear();
    size_ = other.size_;
    if (size_ > 0) {
      sa_detail::copy_elems(data(), other.data(), size_, IsWordTrivial{}, IsByteTrivial{});
    }
  }
  return *this;
}

template <typename T, size_t MaxSize>
StaticArray<T, MaxSize>::StaticArray(StaticArray&& other) noexcept : size_(other.size_) {
  if (size_ > 0) {
    sa_detail::move_elems(data(), other.data(), size_, IsWordTrivial{}, IsByteTrivial{});
    other.size_ = 0;
  }
}

template <typename T, size_t MaxSize>
StaticArray<T, MaxSize>& StaticArray<T, MaxSize>::operator=(StaticArray&& other) noexcept {
  if (LIKELY(this != &other)) {
    clear();
    size_ = other.size_;
    if (size_ > 0) {
      sa_detail::move_elems(data(), other.data(), size_, IsWordTrivial{}, IsByteTrivial{});
      other.size_ = 0;
    }
  }
  return *this;
}

} // namespace uniuno
