#pragma once

#include "FastFunctionDecl.h"

namespace uniuno {

template <typename R, typename... Args, size_t Capacity>
FORCE_INLINE FastFunction<R(Args...), Capacity>::~FastFunction() {
  clear();
}

/**
 * @brief Single-branch clear: skips outer invoker_ check because destroyer_ is
 * guaranteed nullptr for both empty and inline-trivial functors (3 cycles fast-path).
 */
template <typename R, typename... Args, size_t Capacity> FORCE_INLINE void FastFunction<R(Args...), Capacity>::clear() {
  if (UNLIKELY(destroyer_ != nullptr)) {
    destroyer_(&storage_);
    destroyer_ = nullptr;
  }
  invoker_ = nullptr;
}

} // namespace uniuno
