#pragma once

#include "SmallVectorDecl.h"

namespace uniuno {

// ---------------------------------------------------------------------------
// Internal element bulk helpers (compile-time tag dispatch: zero dead branches)
// ---------------------------------------------------------------------------

namespace sv_detail {

template <typename T>
FORCE_INLINE void copy_dispatch(T* __restrict__ dst, const T* __restrict__ src, std::size_t count,
                                std::true_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  asm_copy_words(reinterpret_cast<uint32_t*>(dst), reinterpret_cast<const uint32_t*>(src),
                 static_cast<uint32_t>(count * (sizeof(T) / 4)));
}

template <typename T>
FORCE_INLINE void copy_dispatch(T* __restrict__ dst, const T* __restrict__ src, std::size_t count,
                                std::false_type /*word_trivial*/, std::true_type /*byte_trivial*/) {
  if (LIKELY(count > 0)) std::memcpy(dst, src, count * sizeof(T));
}

template <typename T>
FORCE_INLINE void copy_dispatch(T* __restrict__ dst, const T* __restrict__ src, std::size_t count,
                                std::false_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  for (std::size_t i = 0; i < count; ++i) {
    new (dst + i) T(src[i]);
  }
}

template <typename T>
FORCE_INLINE void move_dispatch(T* __restrict__ dst, T* __restrict__ src, std::size_t count,
                                std::true_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  asm_copy_words(reinterpret_cast<uint32_t*>(dst), reinterpret_cast<const uint32_t*>(src),
                 static_cast<uint32_t>(count * (sizeof(T) / 4)));
}

template <typename T>
FORCE_INLINE void move_dispatch(T* __restrict__ dst, T* __restrict__ src, std::size_t count,
                                std::false_type /*word_trivial*/, std::true_type /*byte_trivial*/) {
  if (LIKELY(count > 0)) std::memcpy(dst, src, count * sizeof(T));
}

template <typename T>
FORCE_INLINE void move_dispatch(T* __restrict__ dst, T* __restrict__ src, std::size_t count,
                                std::false_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  for (std::size_t i = 0; i < count; ++i) {
    new (dst + i) T(std::move(src[i]));
    src[i].~T();
  }
}

template <typename T> FORCE_INLINE void destroy_dispatch(T* /*first*/, T* /*last*/, std::true_type /*trivial_dtor*/) {
  // Zero cost in assembly
}

template <typename T> FORCE_INLINE void destroy_dispatch(T* first, T* last, std::false_type /*trivial_dtor*/) {
  for (T* p = first; p != last; ++p) {
    p->~T();
  }
}

} // namespace sv_detail

template <typename T, std::size_t N, typename Allocator>
FORCE_INLINE void SmallVector<T, N, Allocator>::copy_elements(T* __restrict__ dst, const T* __restrict__ src,
                                                              std::size_t count) {
  sv_detail::copy_dispatch(dst, src, count, IsWordTrivial{}, IsByteTrivial{});
}

template <typename T, std::size_t N, typename Allocator>
FORCE_INLINE void SmallVector<T, N, Allocator>::move_elements(T* __restrict__ dst, T* __restrict__ src,
                                                              std::size_t count) {
  sv_detail::move_dispatch(dst, src, count, IsWordTrivial{}, IsByteTrivial{});
}

template <typename T, std::size_t N, typename Allocator>
FORCE_INLINE void SmallVector<T, N, Allocator>::destroy_range(T* first, T* last) {
  sv_detail::destroy_dispatch(first, last, std::is_trivially_destructible<T>{});
}

// ---------------------------------------------------------------------------
// Default constructor (3 instructions: set begin_, end_, cap_end_)
// ---------------------------------------------------------------------------
template <typename T, std::size_t N, typename Allocator> FORCE_INLINE SmallVector<T, N, Allocator>::SmallVector() {
  T* base = inline_ptr();
  begin_ = base;
  end_ = base;
  cap_end_ = base + kInlineCap;
}

// ---------------------------------------------------------------------------
// Destructor
// ---------------------------------------------------------------------------
template <typename T, std::size_t N, typename Allocator> FORCE_INLINE SmallVector<T, N, Allocator>::~SmallVector() {
  destroy_range(begin_, end_);
  if (UNLIKELY(is_heap())) {
    sv_detail::free_internal(begin_);
  }
}

// ---------------------------------------------------------------------------
// Copy constructor
// ---------------------------------------------------------------------------
template <typename T, std::size_t N, typename Allocator>
SmallVector<T, N, Allocator>::SmallVector(const SmallVector& other) {
  const std::size_t n = other.size();
  T* base;
  if (UNLIKELY(n > kInlineCap)) {
    base = static_cast<T*>(sv_detail::alloc_internal(n * sizeof(T)));
    cap_end_ = base + n;
  } else {
    base = inline_ptr();
    cap_end_ = base + kInlineCap;
  }
  begin_ = base;
  end_ = base + n;
  copy_elements(base, other.begin_, n);
}

// ---------------------------------------------------------------------------
// Initializer list constructor
// ---------------------------------------------------------------------------
template <typename T, std::size_t N, typename Allocator>
SmallVector<T, N, Allocator>::SmallVector(std::initializer_list<T> init) {
  const std::size_t n = init.size();
  T* base;
  if (UNLIKELY(n > kInlineCap)) {
    base = static_cast<T*>(sv_detail::alloc_internal(n * sizeof(T)));
    cap_end_ = base + n;
  } else {
    base = inline_ptr();
    cap_end_ = base + kInlineCap;
  }
  begin_ = base;
  end_ = base + n;
  copy_elements(base, init.begin(), n);
}

} // namespace uniuno
