#pragma once

#include "StaticArrayDecl.h"
#include "StaticArrayConstructors.h"

namespace uniuno {

namespace sa_detail {

template<typename T>
FORCE_INLINE void shift_right_one(T* dst_pos, T* old_end,
                                  std::true_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
    const uint32_t count = static_cast<uint32_t>(old_end - dst_pos);
    xtensa_asm::asm_shift_right_words(reinterpret_cast<uint32_t*>(old_end + 1),
                                      reinterpret_cast<const uint32_t*>(old_end),
                                      count * static_cast<uint32_t>(sizeof(T) / 4));
}

template<typename T>
FORCE_INLINE void shift_right_one(T* dst_pos, T* old_end,
                                  std::false_type /*word_trivial*/, std::true_type /*byte_trivial*/) {
    const size_t count = static_cast<size_t>(old_end - dst_pos);
    if (LIKELY(count > 0)) std::memmove(dst_pos + 1, dst_pos, count * sizeof(T));
}

template<typename T>
FORCE_INLINE void shift_right_one(T* dst_pos, T* old_end,
                                  std::false_type /*word_trivial*/, std::false_type /*byte_trivial*/) {
    new (old_end) T(std::move(*(old_end - 1)));
    for (T* p = old_end - 1; p > dst_pos; --p) {
        *p = std::move(*(p - 1));
    }
}

} // namespace sa_detail

template<typename T, size_t MaxSize>
FORCE_INLINE bool StaticArray<T, MaxSize>::push_back(const T& value) {
    if (UNLIKELY(size_ >= MaxSize)) return false;
    new (&data()[size_]) T(value);
    ++size_;
    return true;
}

template<typename T, size_t MaxSize>
FORCE_INLINE bool StaticArray<T, MaxSize>::push_back(T&& value) {
    if (UNLIKELY(size_ >= MaxSize)) return false;
    new (&data()[size_]) T(std::move(value));
    ++size_;
    return true;
}

template<typename T, size_t MaxSize>
template<typename... Args>
FORCE_INLINE bool StaticArray<T, MaxSize>::emplace_back(Args&&... args) {
    if (UNLIKELY(size_ >= MaxSize)) return false;
    new (&data()[size_]) T(std::forward<Args>(args)...);
    ++size_;
    return true;
}

template<typename T, size_t MaxSize>
FORCE_INLINE void StaticArray<T, MaxSize>::pop_back() {
    if (LIKELY(size_ > 0)) {
        --size_;
        sa_detail::destroy_elems(&data()[size_], 1, std::is_trivially_destructible<T>{});
    }
}

template<typename T, size_t MaxSize>
FORCE_INLINE void StaticArray<T, MaxSize>::clear() {
    sa_detail::destroy_elems(data(), size_, std::is_trivially_destructible<T>{});
    size_ = 0;
}

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::iterator StaticArray<T, MaxSize>::insert(iterator pos, const T& value) {
    T* base = data();
    T* cur_end = base + size_;
    if (UNLIKELY(size_ >= MaxSize || pos < base || pos > cur_end)) return cur_end;

    if (pos == cur_end) {
        new (cur_end) T(value);
    } else if (std::is_trivially_copyable<T>::value) {
        sa_detail::shift_right_one(pos, cur_end, IsWordTrivial{}, IsByteTrivial{});
        new (pos) T(value);
    } else {
        sa_detail::shift_right_one(pos, cur_end, IsWordTrivial{}, IsByteTrivial{});
        *pos = value;
    }
    ++size_;
    return pos;
}

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::iterator StaticArray<T, MaxSize>::insert(iterator pos, T&& value) {
    T* base = data();
    T* cur_end = base + size_;
    if (UNLIKELY(size_ >= MaxSize || pos < base || pos > cur_end)) return cur_end;

    if (pos == cur_end) {
        new (cur_end) T(std::move(value));
    } else if (std::is_trivially_copyable<T>::value) {
        sa_detail::shift_right_one(pos, cur_end, IsWordTrivial{}, IsByteTrivial{});
        new (pos) T(std::move(value));
    } else {
        sa_detail::shift_right_one(pos, cur_end, IsWordTrivial{}, IsByteTrivial{});
        *pos = std::move(value);
    }
    ++size_;
    return pos;
}

} // namespace uniuno
