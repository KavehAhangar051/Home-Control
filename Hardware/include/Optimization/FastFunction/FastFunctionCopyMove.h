#pragma once

#include "FastFunctionDecl.h"

namespace uniuno {

// ---------------------------------------------------------------------------
// Copy constructor
// ---------------------------------------------------------------------------

template<typename R, typename... Args, size_t Capacity>
FORCE_INLINE FastFunction<R(Args...), Capacity>::FastFunction(const FastFunction& other)
  : invoker_(other.invoker_)
  , destroyer_(other.destroyer_) {
  if (LIKELY(invoker_ != nullptr)) {
    if (UNLIKELY(destroyer_ != nullptr)) {
      move_or_pairs_.mover = other.move_or_pairs_.mover;
      copier_              = other.copier_;
      copier_(&storage_, &other.storage_);
    } else {
      const uint32_t pairs         = other.move_or_pairs_.trivial_pairs;
      move_or_pairs_.trivial_pairs = pairs;
      detail::fast_copy_pairs(&storage_, &other.storage_, pairs);
    }
  }
}

// ---------------------------------------------------------------------------
// Move constructor
// ---------------------------------------------------------------------------

template<typename R, typename... Args, size_t Capacity>
FORCE_INLINE FastFunction<R(Args...), Capacity>::FastFunction(FastFunction&& other) noexcept
  : invoker_(other.invoker_)
  , destroyer_(other.destroyer_) {
  if (LIKELY(invoker_ != nullptr)) {
    if (UNLIKELY(destroyer_ != nullptr)) {
      move_or_pairs_.mover = other.move_or_pairs_.mover;
      copier_              = other.copier_;
      move_or_pairs_.mover(&storage_, &other.storage_);
      other.destroyer_ = nullptr;
    } else {
      const uint32_t pairs         = other.move_or_pairs_.trivial_pairs;
      move_or_pairs_.trivial_pairs = pairs;
      detail::fast_copy_pairs(&storage_, &other.storage_, pairs);
    }
    other.invoker_ = nullptr;
  }
}

// ---------------------------------------------------------------------------
// Copy assignment
// ---------------------------------------------------------------------------

template<typename R, typename... Args, size_t Capacity>
FORCE_INLINE FastFunction<R(Args...), Capacity>&
FastFunction<R(Args...), Capacity>::operator=(const FastFunction& other) {
  if (LIKELY(this != &other)) {
    clear();
    invoker_   = other.invoker_;
    destroyer_ = other.destroyer_;
    if (LIKELY(invoker_ != nullptr)) {
      if (UNLIKELY(destroyer_ != nullptr)) {
        move_or_pairs_.mover = other.move_or_pairs_.mover;
        copier_              = other.copier_;
        copier_(&storage_, &other.storage_);
      } else {
        const uint32_t pairs         = other.move_or_pairs_.trivial_pairs;
        move_or_pairs_.trivial_pairs = pairs;
        detail::fast_copy_pairs(&storage_, &other.storage_, pairs);
      }
    }
  }
  return *this;
}

// ---------------------------------------------------------------------------
// Move assignment
// ---------------------------------------------------------------------------

template<typename R, typename... Args, size_t Capacity>
FORCE_INLINE FastFunction<R(Args...), Capacity>&
FastFunction<R(Args...), Capacity>::operator=(FastFunction&& other) noexcept {
  if (LIKELY(this != &other)) {
    clear();
    invoker_   = other.invoker_;
    destroyer_ = other.destroyer_;
    if (LIKELY(invoker_ != nullptr)) {
      if (UNLIKELY(destroyer_ != nullptr)) {
        move_or_pairs_.mover = other.move_or_pairs_.mover;
        copier_              = other.copier_;
        move_or_pairs_.mover(&storage_, &other.storage_);
        other.destroyer_ = nullptr;
      } else {
        const uint32_t pairs         = other.move_or_pairs_.trivial_pairs;
        move_or_pairs_.trivial_pairs = pairs;
        detail::fast_copy_pairs(&storage_, &other.storage_, pairs);
      }
      other.invoker_ = nullptr;
    }
  }
  return *this;
}

} // namespace uniuno
