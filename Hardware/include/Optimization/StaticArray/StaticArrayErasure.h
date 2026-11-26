#pragma once

#include "StaticArrayDecl.h"
#include "StaticArrayConstructors.h"
#include "StaticArrayAccess.h"

namespace uniuno {

namespace sa_detail {

template <typename T>
FORCE_INLINE void shift_left(T* dst, T* src, uint32_t count, std::true_type /*word_trivial*/,
                             std::false_type /*byte_trivial*/) {
  xtensa_asm::asm_shift_left_words(reinterpret_cast<uint32_t*>(dst), reinterpret_cast<const uint32_t*>(src),
                                   count * static_cast<uint32_t>(sizeof(T) / 4));
}

template <typename T>
FORCE_INLINE void shift_left(T* dst, T* src, uint32_t count, std::false_type /*word_trivial*/,
                             std::true_type /*byte_trivial*/) {
  if (LIKELY(count > 0)) std::memmove(dst, src, static_cast<size_t>(count) * sizeof(T));
}

template <typename T>
FORCE_INLINE void shift_left(T* dst, T* src, uint32_t count, std::false_type /*word_trivial*/,
                             std::false_type /*byte_trivial*/) {
  for (uint32_t i = 0; i < count; ++i) {
    dst[i] = std::move(src[i]);
  }
}

} // namespace sa_detail

template <typename T, size_t MaxSize> FORCE_INLINE void StaticArray<T, MaxSize>::erase(size_type idx) {
  if (UNLIKELY(idx >= size_)) return;

  T* base = data();
  const uint32_t tail = size_ - idx - 1;
  if (tail > 0) {
    sa_detail::shift_left(base + idx, base + idx + 1, tail, IsWordTrivial{}, IsByteTrivial{});
  }
  --size_;
  sa_detail::destroy_elems(base + size_, 1, std::is_trivially_destructible<T>{});
}

template <typename T, size_t MaxSize> FORCE_INLINE void StaticArray<T, MaxSize>::erase_unordered(size_type idx) {
  if (UNLIKELY(idx >= size_)) return;
  T* base = data();
  --size_;
  if (idx != size_) {
    base[idx] = std::move(base[size_]);
  }
  sa_detail::destroy_elems(base + size_, 1, std::is_trivially_destructible<T>{});
}

template <typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::iterator StaticArray<T, MaxSize>::erase(iterator it) {
  T* base = data();
  if (UNLIKELY(it < base || it >= base + size_)) return base + size_;

  const size_type idx = static_cast<size_type>(it - base);
  erase(idx);
  return base + idx;
}

template <typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::iterator StaticArray<T, MaxSize>::erase(iterator first, iterator last) {
  T* base = data();
  T* cur_end = base + size_;
  if (UNLIKELY(first >= last || first < base || last > cur_end)) return first;

  const uint32_t count = static_cast<uint32_t>(last - first);
  const uint32_t tail = static_cast<uint32_t>(cur_end - last);

  if (tail > 0) {
    sa_detail::shift_left(first, last, tail, IsWordTrivial{}, IsByteTrivial{});
  }
  const uint32_t new_size = size_ - count;
  sa_detail::destroy_elems(base + new_size, count, std::is_trivially_destructible<T>{});
  size_ = new_size;
  return first;
}

template <typename T, size_t MaxSize> FORCE_INLINE bool StaticArray<T, MaxSize>::remove(const T& value) {
  iterator it = find(value);
  if (it != end()) {
    erase(it);
    return true;
  }
  return false;
}

template <typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::size_type StaticArray<T, MaxSize>::remove_all(const T& value) {
  T* base = data();
  uint32_t write_idx = 0;

  for (uint32_t read_idx = 0; read_idx < size_; ++read_idx) {
    if (!(base[read_idx] == value)) {
      if (write_idx != read_idx) {
        base[write_idx] = std::move(base[read_idx]);
      }
      ++write_idx;
    }
  }

  const uint32_t removed = size_ - write_idx;
  if (removed > 0) {
    sa_detail::destroy_elems(base + write_idx, removed, std::is_trivially_destructible<T>{});
    size_ = write_idx;
  }
  return static_cast<size_type>(removed);
}

} // namespace uniuno
