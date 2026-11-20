#pragma once

#include "FastFunctionBase.h"

namespace uniuno {

/**
 * @brief Max-Velocity Power-of-2 Flattened SBO callable wrapper for Xtensa ESP32.
 *
 * Space-for-Time Architecture:
 *  1. Power-of-2 total sizeof (32 / 64 / 128 / 256B) -> 1-cycle `slli` array indexing
 *     and expanded inline SBO storage (eliminates heap allocations).
 *  2. Flattened 16-byte header (no Flash RODATA vtable pointer indirection!):
 *       offset  0: invoker_       (l32i.n a8, a2, 0 -> direct IRAM callx8)
 *       offset  4: destroyer_     (nullptr if empty or inline-trivial; else direct IRAM call)
 *       offset  8: move_or_pairs_ (mover fn ptr if non-trivial; exact 8B pair count if trivial!)
 *       offset 12: copier_        (direct copy fn ptr if non-trivial)
 *       offset 16: storage_       (16-byte aligned inline SBO / heap_ptr union)
 *  3. Exact-size trivial copy/move (0B/8B/16B unrolled + loopnez).
 *  4. Hot paths compiled with -O3 in IRAM (.iram1.text).
 */
template<typename R, typename... Args, size_t Capacity>
class FastFunction<R(Args...), Capacity> {
public:
  static constexpr size_t kHeaderBytes  = 4 * sizeof(void*);
  static constexpr size_t kMinTotal     = kHeaderBytes + (Capacity < sizeof(void*) ? sizeof(void*) : Capacity);
  static constexpr size_t kTotalBytes   = detail::next_pow2(kMinTotal);
  static constexpr size_t kStorageBytes = kTotalBytes - kHeaderBytes;

  static_assert((kStorageBytes % 8) == 0 && kStorageBytes >= sizeof(void*),
                "FastFunction storage must be 8-byte aligned and fit at least a pointer");

  union Storage {
    alignas(std::max_align_t) alignas(uint32_t) uint8_t inline_buf[kStorageBytes];
    void* heap_ptr;
  };

  FORCE_INLINE FastFunction();
  FORCE_INLINE FastFunction(std::nullptr_t);

  template<typename F, typename = typename std::enable_if<
    !std::is_same<typename std::decay<F>::type, FastFunction<R(Args...), Capacity>>::value &&
    !std::is_same<typename std::decay<F>::type, std::nullptr_t>::value
  >::type>
  FORCE_INLINE FastFunction(F&& f);

  FORCE_INLINE FastFunction(const FastFunction& other);
  FORCE_INLINE FastFunction(FastFunction&& other) noexcept;

  FORCE_INLINE FastFunction& operator=(const FastFunction& other);
  FORCE_INLINE FastFunction& operator=(FastFunction&& other) noexcept;

  FORCE_INLINE ~FastFunction();

  FORCE_INLINE void clear();
  FORCE_INLINE R operator()(Args... args) const;
  FORCE_INLINE explicit operator bool() const;

private:
  using Invoker   = R(*)(void*, Args...);
  using DestroyFn = void(*)(void*);
  using MoveFn    = void(*)(void* __restrict__, void* __restrict__);
  using CopyFn    = void(*)(void* __restrict__, const void* __restrict__);

  union MoveOrPairs {
    MoveFn   mover;
    uint32_t trivial_pairs;
  };

  template<typename DecayF>
  static R FASTFUNC_IRAM FASTFUNC_HOT_OPT invoke_inline(void* storage, Args... args);

  template<typename DecayF>
  static R FASTFUNC_IRAM FASTFUNC_HOT_OPT invoke_heap(void* storage, Args... args);

  template<typename DecayF>
  static void FASTFUNC_IRAM FASTFUNC_HOT_OPT destroy_inline(void* storage);

  template<typename DecayF>
  static void FASTFUNC_IRAM FASTFUNC_HOT_OPT move_inline(void* __restrict__ dest, void* __restrict__ src);

  template<typename DecayF>
  static void copy_inline(void* __restrict__ dest, const void* __restrict__ src);

  template<typename DecayF>
  static void destroy_heap(void* storage);

  static void FASTFUNC_IRAM FASTFUNC_HOT_OPT move_heap(void* __restrict__ dest, void* __restrict__ src);

  template<typename DecayF>
  static void copy_heap(void* __restrict__ dest, const void* __restrict__ src);

  template<typename DecayF>
  FORCE_INLINE void bind_inline_ops(std::true_type /*is_trivial*/);

  template<typename DecayF>
  FORCE_INLINE void bind_inline_ops(std::false_type /*is_trivial*/);

  template<typename DecayF, typename F>
  FORCE_INLINE void construct_impl(F&& f, std::true_type /*is_inline*/);

  template<typename DecayF, typename F>
  void construct_impl(F&& f, std::false_type /*is_inline*/);

  Invoker     invoker_;
  DestroyFn   destroyer_;
  MoveOrPairs move_or_pairs_;
  CopyFn      copier_;
  Storage     storage_;
};

} // namespace uniuno
