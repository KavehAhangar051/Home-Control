#pragma once

#include "StaticArrayDecl.h"

namespace uniuno {

namespace sa_detail {

template<typename T>
FORCE_INLINE uint32_t find_dispatch(const T* data, uint32_t count, const T& value, std::true_type /*word_scalar*/) {
    uint32_t target_word = 0;
    std::memcpy(&target_word, &value, sizeof(uint32_t));
    return xtensa_asm::asm_find_word(reinterpret_cast<const uint32_t*>(data), count, target_word);
}

template<typename T>
FORCE_INLINE uint32_t find_dispatch(const T* data, uint32_t count, const T& value, std::false_type /*word_scalar*/) {
    for (uint32_t i = 0; i < count; ++i) {
        if (data[i] == value) return i;
    }
    return count;
}

} // namespace sa_detail

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::size_type StaticArray<T, MaxSize>::size() const {
    return static_cast<size_type>(size_);
}

template<typename T, size_t MaxSize>
FORCE_INLINE bool StaticArray<T, MaxSize>::empty() const { return size_ == 0; }

template<typename T, size_t MaxSize>
FORCE_INLINE bool StaticArray<T, MaxSize>::full() const { return size_ == MaxSize; }

template<typename T, size_t MaxSize>
FORCE_INLINE T* StaticArray<T, MaxSize>::data() { return reinterpret_cast<T*>(storage_); }

template<typename T, size_t MaxSize>
FORCE_INLINE const T* StaticArray<T, MaxSize>::data() const { return reinterpret_cast<const T*>(storage_); }

template<typename T, size_t MaxSize>
FORCE_INLINE T& StaticArray<T, MaxSize>::operator[](size_type idx) { return data()[idx]; }

template<typename T, size_t MaxSize>
FORCE_INLINE const T& StaticArray<T, MaxSize>::operator[](size_type idx) const { return data()[idx]; }

template<typename T, size_t MaxSize>
FORCE_INLINE T& StaticArray<T, MaxSize>::at(size_type idx) {
    return data()[xtensa_asm::asm_clamp_index(idx, size_)];
}

template<typename T, size_t MaxSize>
FORCE_INLINE const T& StaticArray<T, MaxSize>::at(size_type idx) const {
    return data()[xtensa_asm::asm_clamp_index(idx, size_)];
}

template<typename T, size_t MaxSize>
FORCE_INLINE T& StaticArray<T, MaxSize>::front() { return data()[0]; }

template<typename T, size_t MaxSize>
FORCE_INLINE const T& StaticArray<T, MaxSize>::front() const { return data()[0]; }

template<typename T, size_t MaxSize>
FORCE_INLINE T& StaticArray<T, MaxSize>::back() { return data()[size_ - 1]; }

template<typename T, size_t MaxSize>
FORCE_INLINE const T& StaticArray<T, MaxSize>::back() const { return data()[size_ - 1]; }

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::iterator StaticArray<T, MaxSize>::begin() { return data(); }

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::const_iterator StaticArray<T, MaxSize>::begin() const { return data(); }

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::iterator StaticArray<T, MaxSize>::end() { return data() + size_; }

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::const_iterator StaticArray<T, MaxSize>::end() const { return data() + size_; }

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::iterator StaticArray<T, MaxSize>::find(const T& value) {
    return data() + sa_detail::find_dispatch(data(), size_, value, IsWordScalar{});
}

template<typename T, size_t MaxSize>
FORCE_INLINE typename StaticArray<T, MaxSize>::const_iterator StaticArray<T, MaxSize>::find(const T& value) const {
    return data() + sa_detail::find_dispatch(data(), size_, value, IsWordScalar{});
}

} // namespace uniuno
