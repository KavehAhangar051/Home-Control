/**
 * @file AsyncTcpAsm.h
 * @brief Low-level Xtensa LX6 assembly and pipeline micro-optimizations for AsyncTCP.
 * @author uniuno
 * 
 * PURPOSE: Accelerate AsyncTCP hot-paths using Xtensa LX6 hardware instructions.
 * BENEFITS:
 *   - Zero-branch conditional moves (movltz) eliminating pipeline misprediction bubbles.
 *   - Single-cycle pointer bounds validation.
 *   - Pure branchless arithmetic on packet buffering and TCP window clamping.
 */

#pragma once

#include <cstddef>
#include <cstdint>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "Optimization/CompilerTraits.h"

namespace uniuno {
namespace asynctcp_asm {

/**
 * @brief Division-free millisecond timestamp for ESP32 FreeRTOS (1000 Hz tick).
 * @return uint32_t Current uptime in milliseconds.
 * @note Avoids 64-bit software division (__udivdi3 in millis()) inside packet hot paths.
 */
FORCE_INLINE uint32_t fast_millis() {
#if defined(CONFIG_FREERTOS_HZ) && (CONFIG_FREERTOS_HZ == 1000)
    return static_cast<uint32_t>(xTaskGetTickCount());
#elif defined(portTICK_PERIOD_MS)
    return static_cast<uint32_t>(xTaskGetTickCount() * portTICK_PERIOD_MS);
#else
    return 0U;
#endif
}

/**
 * @brief Fast 4-byte aligned string length scanner for AsyncClient::write(const char*).
 * @param str Null-terminated C-string.
 * @return size_t Number of characters before null terminator.
 * @note Uses word-wise zero-byte detection to scan 4 bytes per iteration.
 */
FORCE_INLINE size_t asm_strlen(const char* str) {
    if (UNLIKELY(str == nullptr)) {
        return 0;
    }
    const char* p = str;
    while ((reinterpret_cast<uintptr_t>(p) & 3U) != 0U) {
        if (*p == '\0') {
            return static_cast<size_t>(p - str);
        }
        ++p;
    }
    const uint32_t* wp = reinterpret_cast<const uint32_t*>(p);
    for (;;) {
        const uint32_t v = *wp;
        if (UNLIKELY(((v - 0x01010101U) & ~v & 0x80808080U) != 0U)) {
            const char* bp = reinterpret_cast<const char*>(wp);
            if (bp[0] == '\0') return static_cast<size_t>(bp - str);
            if (bp[1] == '\0') return static_cast<size_t>(bp + 1 - str);
            if (bp[2] == '\0') return static_cast<size_t>(bp + 2 - str);
            return static_cast<size_t>(bp + 3 - str);
        }
        ++wp;
    }
}

/**
 * @brief Branchless minimum calculation using Xtensa LX6 movltz conditional move instruction.
 * 
 * @param a First value (e.g. available TCP window space).
 * @param b Second value (e.g. payload length).
 * @return size_t Minimum of a and b.
 * 
 * @details On Xtensa LX6, a conditional branch misprediction costs 2-3 CPU cycles.
 *          This function subtracts b from a and conditionally moves b to res if diff < 0
 *          using the hardware movltz instruction with zero branches and zero pipeline stalls.
 */
FORCE_INLINE size_t asm_min(size_t a, size_t b) {
#if defined(__XTENSA__) || defined(ESP32)
    size_t res = a;
    int32_t diff;
    asm volatile (
        "sub    %[diff], %[b], %[a]    \n"
        "movltz %[res],  %[b], %[diff] \n"
        : [res] "+r" (res), [diff] "=&r" (diff)
        : [a] "r" (a), [b] "r" (b)
    );
    return res;
#else
    return (a < b) ? a : b;
#endif
}

/**
 * @brief Fast single-check pointer range verification.
 * 
 * @param ptr Pointer to test.
 * @param base Base address of memory block.
 * @param total_bytes Total size of block in bytes.
 * @return true if ptr lies inside [base, base + total_bytes), false otherwise.
 * 
 * @details Replaces two conditional branches (ptr >= base && ptr < end) with a
 *          single unsigned subtraction and comparison (offset < total_bytes).
 *          If ptr < base, the unsigned offset wraps to a huge number (> 0x80000000)
 *          failing the check automatically in 1 CPU cycle.
 */
FORCE_INLINE bool asm_in_range(const void* ptr, const void* base, size_t total_bytes) {
    uint32_t offset = reinterpret_cast<uintptr_t>(ptr) - reinterpret_cast<uintptr_t>(base);
    return LIKELY(offset < total_bytes);
}

} // namespace asynctcp_asm
} // namespace uniuno
