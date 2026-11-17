#pragma once

#include "SmallVectorDecl.h"

namespace uniuno {

// ---------------------------------------------------------------------------
// Copy assignment (reuses existing buffer whenever capacity >= other.size()!)
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
SmallVector<T, N, Allocator>& SmallVector<T, N, Allocator>::operator=(const SmallVector& other) {
  if (LIKELY(this != &other)) {
    destroy_range(begin_, end_);
    const std::size_t n = other.size();

    if (UNLIKELY(n > capacity())) {
      if (is_heap()) sv_detail::free_internal(begin_);
      T* new_buf = static_cast<T*>(sv_detail::alloc_internal(n * sizeof(T)));
      begin_   = new_buf;
      cap_end_ = new_buf + n;
    }

    end_ = begin_ + n;
    copy_elements(begin_, other.begin_, n);
  }
  return *this;
}

// ---------------------------------------------------------------------------
// Move constructor (O(1) heap pointer steal; Xtensa loopnez copy for inline)
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
SmallVector<T, N, Allocator>::SmallVector(SmallVector&& other) noexcept {
  if (UNLIKELY(other.is_heap())) {
    begin_   = other.begin_;
    end_     = other.end_;
    cap_end_ = other.cap_end_;

    T* other_base  = other.inline_ptr();
    other.begin_   = other_base;
    other.end_     = other_base;
    other.cap_end_ = other_base + kInlineCap;
  } else {
    const std::size_t n = other.size();
    T* base  = inline_ptr();
    begin_   = base;
    end_     = base + n;
    cap_end_ = base + kInlineCap;
    move_elements(base, other.begin_, n);
    other.end_ = other.begin_;
  }
}

// ---------------------------------------------------------------------------
// Move assignment
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
SmallVector<T, N, Allocator>& SmallVector<T, N, Allocator>::operator=(SmallVector&& other) noexcept {
  if (LIKELY(this != &other)) {
    destroy_range(begin_, end_);

    if (UNLIKELY(other.is_heap())) {
      if (is_heap()) sv_detail::free_internal(begin_);
      begin_   = other.begin_;
      end_     = other.end_;
      cap_end_ = other.cap_end_;

      T* other_base  = other.inline_ptr();
      other.begin_   = other_base;
      other.end_     = other_base;
      other.cap_end_ = other_base + kInlineCap;
    } else {
      const std::size_t n = other.size();
      // Keep current buffer (inline or existing heap with cap >= n) without extra free/malloc!
      end_ = begin_ + n;
      move_elements(begin_, other.begin_, n);
      other.end_ = other.begin_;
    }
  }
  return *this;
}

// ---------------------------------------------------------------------------
// Initializer list assignment
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
SmallVector<T, N, Allocator>& SmallVector<T, N, Allocator>::operator=(std::initializer_list<T> init) {
  destroy_range(begin_, end_);
  const std::size_t n = init.size();

  if (UNLIKELY(n > capacity())) {
    if (is_heap()) sv_detail::free_internal(begin_);
    T* new_buf = static_cast<T*>(sv_detail::alloc_internal(n * sizeof(T)));
    begin_   = new_buf;
    cap_end_ = new_buf + n;
  }

  end_ = begin_ + n;
  copy_elements(begin_, init.begin(), n);
  return *this;
}

} // namespace uniuno
