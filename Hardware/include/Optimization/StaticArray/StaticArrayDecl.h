#pragma once

#include <cstdint>
#include <cstddef>
#include <utility>
#include <new>
#include <type_traits>
#include "Optimization/CompilerTraits.h"
#include "Optimization/XtensaMemAsm.h"

namespace uniuno {

/**
 * @class StaticArray
 * @brief Zero-overhead Xtensa-accelerated fixed-capacity array (decoupled from ArrayBase).
 *
 * Architecture:
 *  - Compact 4-byte header (uint32_t size_ at offset 0 -> 1-cycle l32i.n).
 *  - Zero ArrayBase metadata (saves 12 bytes per instance, eliminates dangling data_
 *    pointer bug on move, and eliminates dead freeHeap() branch in ~StaticArray()).
 *  - Proper Copy/Move constructors that copy ONLY active [0..size_) elements
 *    (0 bytes moved when empty instead of copying entire uninitialized storage_!).
 *  - Inline Xtensa loopnez word-shift assembly for erase/insert, branchless movltz
 *    clamping in at(), and tight register-loop word scanning in find()/remove().
 */
template<typename T, size_t MaxSize>
class StaticArray {
    static_assert(MaxSize > 0 && MaxSize <= 65535, "StaticArray: MaxSize must be in [1, 65535]");

public:
    using value_type     = T;
    using size_type      = uint16_t;
    using iterator       = T*;
    using const_iterator = const T*;

    FORCE_INLINE StaticArray();
    FORCE_INLINE ~StaticArray();

    StaticArray(const StaticArray& other);
    StaticArray& operator=(const StaticArray& other);
    StaticArray(StaticArray&& other) noexcept;
    StaticArray& operator=(StaticArray&& other) noexcept;

    FORCE_INLINE size_type size() const;
    FORCE_INLINE constexpr size_type capacity() const { return static_cast<size_type>(MaxSize); }
    FORCE_INLINE bool empty() const;
    FORCE_INLINE bool full() const;

    FORCE_INLINE void force_set_size(size_type new_size) { size_ = new_size; }

    FORCE_INLINE T* data();
    FORCE_INLINE const T* data() const;

    FORCE_INLINE T& operator[](size_type idx);
    FORCE_INLINE const T& operator[](size_type idx) const;
    FORCE_INLINE T& at(size_type idx);
    FORCE_INLINE const T& at(size_type idx) const;
    FORCE_INLINE T& front();
    FORCE_INLINE const T& front() const;
    FORCE_INLINE T& back();
    FORCE_INLINE const T& back() const;

    FORCE_INLINE bool push_back(const T& value);
    FORCE_INLINE bool push_back(T&& value);
    template<typename... Args> FORCE_INLINE bool emplace_back(Args&&... args);
    FORCE_INLINE void pop_back();
    FORCE_INLINE void clear();

    FORCE_INLINE iterator insert(iterator pos, const T& value);
    FORCE_INLINE iterator insert(iterator pos, T&& value);

    FORCE_INLINE void erase(size_type idx);
    FORCE_INLINE iterator erase(iterator it);
    FORCE_INLINE iterator erase(iterator first, iterator last);

    /** @brief O(1) unordered erase: moves back element into idx with zero shifting. */
    FORCE_INLINE void erase_unordered(size_type idx);

    FORCE_INLINE bool remove(const T& value);
    FORCE_INLINE size_type remove_all(const T& value);

    FORCE_INLINE iterator begin();
    FORCE_INLINE const_iterator begin() const;
    FORCE_INLINE iterator end();
    FORCE_INLINE const_iterator end() const;

    FORCE_INLINE iterator find(const T& value);
    FORCE_INLINE const_iterator find(const T& value) const;

private:
    using IsWordTrivial = std::integral_constant<bool,
        std::is_trivially_copyable<T>::value && ((sizeof(T) % 4) == 0)>;
    using IsByteTrivial = std::integral_constant<bool,
        std::is_trivially_copyable<T>::value && ((sizeof(T) % 4) != 0)>;
    using IsWordScalar = std::integral_constant<bool,
        std::is_scalar<T>::value && (sizeof(T) == 4)>;

    // 4-byte aligned size at offset 0 (1-cycle 16-bit l32i.n on Xtensa LX6)
    uint32_t size_;
    alignas(T) alignas(uint32_t) uint8_t storage_[MaxSize * sizeof(T)];
};

} // namespace uniuno
