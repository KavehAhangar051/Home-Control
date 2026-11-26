#pragma once

#include "SmallVectorDecl.h"

namespace uniuno {

// ---------------------------------------------------------------------------
// reserve — inline heap realloc for PODs, zero ArrayBase / memw overhead
// ---------------------------------------------------------------------------
template <typename T, std::size_t N, typename Allocator>
void SmallVector<T, N, Allocator>::reserve(std::size_t new_cap) {
  const std::size_t cur_cap = capacity();
  if (LIKELY(new_cap <= cur_cap)) return;

  const std::size_t cur_size = size();
  const bool on_heap = is_heap();

  if (std::is_trivially_copyable<T>::value && on_heap) {
    T* new_buf = static_cast<T*>(sv_detail::realloc_internal(begin_, new_cap * sizeof(T)));
    if (UNLIKELY(!new_buf)) return;
    begin_ = new_buf;
    end_ = new_buf + cur_size;
    cap_end_ = new_buf + new_cap;
    return;
  }

  T* new_buf = static_cast<T*>(sv_detail::alloc_internal(new_cap * sizeof(T)));
  if (UNLIKELY(!new_buf)) return;

  move_elements(new_buf, begin_, cur_size);
  if (on_heap) sv_detail::free_internal(begin_);

  begin_ = new_buf;
  end_ = new_buf + cur_size;
  cap_end_ = new_buf + new_cap;
}

template <typename T, std::size_t N, typename Allocator>
__attribute__((noinline)) void SmallVector<T, N, Allocator>::grow_for_push() {
  const std::size_t cur_cap = capacity();
  reserve(cur_cap > 0 ? (cur_cap * 2) : 8);
}

// ---------------------------------------------------------------------------
// push_back / emplace_back — writes directly to *end_++ (ZERO size_ * sizeof(T)!)
// ---------------------------------------------------------------------------
template <typename T, std::size_t N, typename Allocator>
FORCE_INLINE void SmallVector<T, N, Allocator>::push_back(const T& value) {
  if (UNLIKELY(end_ == cap_end_)) {
    grow_for_push();
  }
  new (end_) T(value);
  ++end_;
}

template <typename T, std::size_t N, typename Allocator>
FORCE_INLINE void SmallVector<T, N, Allocator>::push_back(T&& value) {
  if (UNLIKELY(end_ == cap_end_)) {
    grow_for_push();
  }
  new (end_) T(std::move(value));
  ++end_;
}

template <typename T, std::size_t N, typename Allocator>
template <typename... Args>
FORCE_INLINE void SmallVector<T, N, Allocator>::emplace_back(Args&&... args) {
  if (UNLIKELY(end_ == cap_end_)) {
    grow_for_push();
  }
  new (end_) T(std::forward<Args>(args)...);
  ++end_;
}

// ---------------------------------------------------------------------------
// pop_back / clear — 2-cycle pointer update for trivial types
// ---------------------------------------------------------------------------
template <typename T, std::size_t N, typename Allocator> FORCE_INLINE void SmallVector<T, N, Allocator>::pop_back() {
  if (LIKELY(end_ != begin_)) {
    --end_;
    if (!std::is_trivially_destructible<T>::value) {
      end_->~T();
    }
  }
}

template <typename T, std::size_t N, typename Allocator> FORCE_INLINE void SmallVector<T, N, Allocator>::clear() {
  destroy_range(begin_, end_);
  end_ = begin_;
}

} // namespace uniuno
