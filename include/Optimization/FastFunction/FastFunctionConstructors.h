#pragma once

#include "FastFunctionDecl.h"

namespace uniuno {

// ---------------------------------------------------------------------------
// Default constructors (2 cycles: only null invoker_ and destroyer_)
// ---------------------------------------------------------------------------

template <typename R, typename... Args, size_t Capacity>
FORCE_INLINE FastFunction<R(Args...), Capacity>::FastFunction() : invoker_(nullptr), destroyer_(nullptr) {}

template <typename R, typename... Args, size_t Capacity>
FORCE_INLINE FastFunction<R(Args...), Capacity>::FastFunction(std::nullptr_t)
    : invoker_(nullptr), destroyer_(nullptr) {}

// ---------------------------------------------------------------------------
// Static IRAM -O3 invokers — compile-time inline vs heap dispatch
// ---------------------------------------------------------------------------

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
R FastFunction<R(Args...), Capacity>::invoke_inline(void* storage, Args... args) {
  return (*static_cast<DecayF*>(storage))(std::forward<Args>(args)...);
}

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
R FastFunction<R(Args...), Capacity>::invoke_heap(void* storage, Args... args) {
  return (*static_cast<DecayF*>(*static_cast<void**>(storage)))(std::forward<Args>(args)...);
}

// ---------------------------------------------------------------------------
// Direct lifecycle ops (no Flash RODATA vtable indirection!)
// ---------------------------------------------------------------------------

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
void FastFunction<R(Args...), Capacity>::destroy_inline(void* storage) {
  static_cast<DecayF*>(storage)->~DecayF();
}

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
void FastFunction<R(Args...), Capacity>::move_inline(void* __restrict__ dest, void* __restrict__ src) {
  DecayF* s = static_cast<DecayF*>(src);
  new (dest) DecayF(std::move(*s));
  s->~DecayF();
}

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
void FastFunction<R(Args...), Capacity>::copy_inline(void* __restrict__ dest, const void* __restrict__ src) {
  new (dest) DecayF(*static_cast<const DecayF*>(src));
}

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
void FastFunction<R(Args...), Capacity>::destroy_heap(void* storage) {
  delete *static_cast<DecayF**>(storage);
}

template <typename R, typename... Args, size_t Capacity>
void FastFunction<R(Args...), Capacity>::move_heap(void* __restrict__ dest, void* __restrict__ src) {
  *static_cast<void**>(dest) = *static_cast<void**>(src);
  *static_cast<void**>(src) = nullptr;
}

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
void FastFunction<R(Args...), Capacity>::copy_heap(void* __restrict__ dest, const void* __restrict__ src) {
  *static_cast<DecayF**>(dest) = new DecayF(**static_cast<DecayF* const*>(src));
}

// ---------------------------------------------------------------------------
// Compile-time trivial vs non-trivial binding (zero dead instantiations!)
// ---------------------------------------------------------------------------

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
FORCE_INLINE void FastFunction<R(Args...), Capacity>::bind_inline_ops(std::true_type /*is_trivial*/) {
  destroyer_ = nullptr;
  // Exact 8-byte pair count: 0 for stateless/empty lambdas, 1 for 1..8B, 2 for 9..16B, etc.
  move_or_pairs_.trivial_pairs = std::is_empty<DecayF>::value ? 0U : static_cast<uint32_t>((sizeof(DecayF) + 7) / 8);
}

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF>
FORCE_INLINE void FastFunction<R(Args...), Capacity>::bind_inline_ops(std::false_type /*is_trivial*/) {
  destroyer_ = &destroy_inline<DecayF>;
  move_or_pairs_.mover = &move_inline<DecayF>;
  copier_ = &copy_inline<DecayF>;
}

// ---------------------------------------------------------------------------
// Main functor constructor — compile-time SBO dispatch
// ---------------------------------------------------------------------------

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF, typename F>
FORCE_INLINE void FastFunction<R(Args...), Capacity>::construct_impl(F&& f, std::true_type /*is_inline*/) {
  new (&storage_.inline_buf) DecayF(std::forward<F>(f));
  invoker_ = &invoke_inline<DecayF>;

  using IsTrivial = std::integral_constant<bool, std::is_trivially_destructible<DecayF>::value &&
                                                     std::is_trivially_move_constructible<DecayF>::value &&
                                                     std::is_trivially_copy_constructible<DecayF>::value>;
  bind_inline_ops<DecayF>(IsTrivial{});
}

template <typename R, typename... Args, size_t Capacity>
template <typename DecayF, typename F>
void FastFunction<R(Args...), Capacity>::construct_impl(F&& f, std::false_type /*is_inline*/) {
  storage_.heap_ptr = new DecayF(std::forward<F>(f));
  invoker_ = &invoke_heap<DecayF>;
  destroyer_ = &destroy_heap<DecayF>;
  move_or_pairs_.mover = &move_heap;
  copier_ = &copy_heap<DecayF>;
}

template <typename R, typename... Args, size_t Capacity>
template <typename F, typename>
FORCE_INLINE FastFunction<R(Args...), Capacity>::FastFunction(F&& f) {
  static_assert(sizeof(FastFunction<R(Args...), Capacity>) == kTotalBytes,
                "FastFunction total object size must remain an exact power of 2");
  using DecayF = typename std::decay<F>::type;
  using IsInline =
      std::integral_constant<bool, (sizeof(DecayF) <= kStorageBytes) && (alignof(DecayF) <= alignof(Storage))>;
  construct_impl<DecayF>(std::forward<F>(f), IsInline{});
}

} // namespace uniuno
