#pragma once

#include "SmallVectorDecl.h"

namespace uniuno {

namespace sv_detail {

template<typename T>
FORCE_INLINE void shift_left_dispatch(T* dst, T* src, std::size_t count,
                                      std::true_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  asm_shift_left_words(reinterpret_cast<uint32_t*>(dst),
                       reinterpret_cast<const uint32_t*>(src),
                       static_cast<uint32_t>(count * (sizeof(T) / 4)));
}

template<typename T>
FORCE_INLINE void shift_left_dispatch(T* dst, T* src, std::size_t count,
                                      std::false_type /*word_trivial*/, std::true_type /*byte_trivial*/) {
  if (LIKELY(count > 0)) std::memmove(dst, src, count * sizeof(T));
}

template<typename T>
FORCE_INLINE void shift_left_dispatch(T* dst, T* src, std::size_t count,
                                      std::false_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  for (std::size_t i = 0; i < count; ++i) {
    dst[i] = std::move(src[i]);
  }
}

template<typename T>
FORCE_INLINE void shift_right_one_dispatch(T* dst_pos, T* old_end,
                                           std::true_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  const std::size_t count = static_cast<std::size_t>(old_end - dst_pos);
  asm_shift_right_words(reinterpret_cast<uint32_t*>(old_end + 1),
                        reinterpret_cast<const uint32_t*>(old_end),
                        static_cast<uint32_t>(count * (sizeof(T) / 4)));
}

template<typename T>
FORCE_INLINE void shift_right_one_dispatch(T* dst_pos, T* old_end,
                                           std::false_type /*word_trivial*/, std::true_type /*byte_trivial*/) {
  const std::size_t count = static_cast<std::size_t>(old_end - dst_pos);
  if (LIKELY(count > 0)) std::memmove(dst_pos + 1, dst_pos, count * sizeof(T));
}

template<typename T>
FORCE_INLINE void shift_right_one_dispatch(T* dst_pos, T* old_end,
                                           std::false_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
  for (T* p = old_end; p > dst_pos; --p) {
    new (p) T(std::move(*(p - 1)));
    (p - 1)->~T();
  }
}

} // namespace sv_detail

// ---------------------------------------------------------------------------
// erase by index (inline Xtensa loopnez word-shift — zero ArrayBase/memmove call)
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
FORCE_INLINE void SmallVector<T, N, Allocator>::erase(std::size_t index) {
  T* pos = begin_ + index;
  if (UNLIKELY(pos >= end_)) return;

  const std::size_t tail = static_cast<std::size_t>(end_ - pos - 1);
  if (tail > 0) {
    sv_detail::shift_left_dispatch(pos, pos + 1, tail, IsWordTrivial{}, IsByteTrivial{});
  }
  --end_;
  if (!std::is_trivially_destructible<T>::value) {
    end_->~T();
  }
}

// ---------------------------------------------------------------------------
// O(1) unordered erase (swaps target with back element — zero shifting!)
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
FORCE_INLINE void SmallVector<T, N, Allocator>::erase_unordered(std::size_t index) {
  T* pos = begin_ + index;
  if (UNLIKELY(pos >= end_)) return;
  --end_;
  if (pos != end_) {
    *pos = std::move(*end_);
  }
  if (!std::is_trivially_destructible<T>::value) {
    end_->~T();
  }
}

// ---------------------------------------------------------------------------
// erase by pointer
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
FORCE_INLINE T* SmallVector<T, N, Allocator>::erase(T* pos) {
  if (UNLIKELY(pos < begin_ || pos >= end_)) return end_;
  const std::size_t tail = static_cast<std::size_t>(end_ - pos - 1);
  if (tail > 0) {
    sv_detail::shift_left_dispatch(pos, pos + 1, tail, IsWordTrivial{}, IsByteTrivial{});
  }
  --end_;
  if (!std::is_trivially_destructible<T>::value) {
    end_->~T();
  }
  return pos;
}

// ---------------------------------------------------------------------------
// insert (inline Xtensa loopnez backward word-shift)
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
void SmallVector<T, N, Allocator>::insert(T* pos, T&& value) {
  const std::size_t index = static_cast<std::size_t>(pos - begin_);
  if (UNLIKELY(end_ == cap_end_)) {
    grow_for_push();
  }
  T* dst_pos = begin_ + index;
  if (dst_pos < end_) {
    sv_detail::shift_right_one_dispatch(dst_pos, end_, IsWordTrivial{}, IsByteTrivial{});
  }
  new (dst_pos) T(std::move(value));
  ++end_;
}

// ---------------------------------------------------------------------------
// erase range [first, last)
// ---------------------------------------------------------------------------
template<typename T, std::size_t N, typename Allocator>
T* SmallVector<T, N, Allocator>::erase(T* first, T* last) {
  if (UNLIKELY(first >= last || first < begin_ || last > end_)) return end_;

  const std::size_t count = static_cast<std::size_t>(last - first);
  const std::size_t tail  = static_cast<std::size_t>(end_ - last);

  if (tail > 0) {
    sv_detail::shift_left_dispatch(first, last, tail, IsWordTrivial{}, IsByteTrivial{});
  }
  T* new_end = end_ - count;
  destroy_range(new_end, end_);
  end_ = new_end;
  return first;
}

} // namespace uniuno
