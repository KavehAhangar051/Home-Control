/**
 * @file NetworkAsm.h
 * @brief Low-level Xtensa LX6 hardware primitives for NetworkCore & WebSocket/TLS hot paths.
 *
 * Eliminates call8 memcpy overhead on small WebSocket frame headers (2-4 bytes),
 * uses Xtensa loopnez dual-word copy for aligned RX payload bursts, and replaces
 * per-loop() switch(errno) branch trees with a compile-time bitmask.
 */

#pragma once

#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <errno.h>
#include <sys/time.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/XtensaMemAsm.h>

namespace network_asm {

namespace detail {
constexpr uint32_t errnoMaskWord(uint32_t code, uint8_t wordIdx) {
  return (code < 256 && (code >> 5) == wordIdx) ? (1UL << (code & 31)) : 0UL;
}

constexpr uint32_t buildFatalErrnoWord(uint8_t wordIdx) {
  return errnoMaskWord(ENOTCONN, wordIdx) | errnoMaskWord(EPIPE, wordIdx) | errnoMaskWord(ECONNRESET, wordIdx) |
         errnoMaskWord(ECONNREFUSED, wordIdx) | errnoMaskWord(ECONNABORTED, wordIdx);
}
} // namespace detail

/**
 * @brief Branchless classification of fatal disconnect socket errnos.
 * Fast-paths EWOULDBLOCK/EAGAIN/ENOENT (99.9% of idle loop() polls), then
 * tests fatal disconnect errnos via a compile-time 256-bit bitmask.
 *
 * @param err POSIX/LwIP errno value after recv(MSG_DONTWAIT | MSG_PEEK)
 * @return true if the TCP socket is disconnected, false if still alive
 */
FORCE_INLINE bool isFatalSocketErrno(int err) {
  if (LIKELY(err == EWOULDBLOCK || err == EAGAIN || err == ENOENT)) {
    return false;
  }
  const uint32_t uerr = static_cast<uint32_t>(err);
  if (UNLIKELY(uerr >= 256)) {
    return false;
  }
  static constexpr uint32_t kFatalMask[8] = {detail::buildFatalErrnoWord(0), detail::buildFatalErrnoWord(1),
                                             detail::buildFatalErrnoWord(2), detail::buildFatalErrnoWord(3),
                                             detail::buildFatalErrnoWord(4), detail::buildFatalErrnoWord(5),
                                             detail::buildFatalErrnoWord(6), detail::buildFatalErrnoWord(7)};
  return ((kFatalMask[uerr >> 5] >> (uerr & 31)) & 1UL) != 0;
}

/**
 * @brief High-speed RX buffer copy optimized for WebSocket frame headers & payload chunks.
 * Avoids call8 memcpy overhead on 1/2/4-byte header & masking-key reads, and uses
 * Xtensa loopnez dual-word l32i/s32i for word-aligned bulk transfers.
 *
 * @param dst Destination user buffer
 * @param src Source RX ring/slab pointer
 * @param len Byte count to copy
 */
FORCE_INLINE void fastCopySmallOrAligned(uint8_t* __restrict__ dst, const uint8_t* __restrict__ src, size_t len) {
  if (len == 1) {
    dst[0] = src[0];
    return;
  }
  if (len == 2) {
    dst[0] = src[0];
    dst[1] = src[1];
    return;
  }
  if (len == 4) {
    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[3];
    return;
  }
  if (len >= 8 && (((reinterpret_cast<uintptr_t>(dst) | reinterpret_cast<uintptr_t>(src)) & 3U) == 0)) {
    const uint32_t words = static_cast<uint32_t>(len >> 2);
    uniuno::xtensa_asm::asm_copy_words(reinterpret_cast<uint32_t*>(dst), reinterpret_cast<const uint32_t*>(src), words);
    const size_t copied = static_cast<size_t>(words) << 2;
    const size_t tail = len & 3U;
    for (size_t i = 0; i < tail; ++i) {
      dst[copied + i] = src[copied + i];
    }
    return;
  }
  memcpy(dst, src, len);
}

/**
 * @brief Convert millisecond timeout into struct timeval cleanly.
 */
FORCE_INLINE void timeoutMsToTimeval(uint32_t timeoutMs, struct timeval& tv) {
  tv.tv_sec = static_cast<time_t>(timeoutMs / 1000U);
  tv.tv_usec = static_cast<suseconds_t>((timeoutMs % 1000U) * 1000U);
}

} // namespace network_asm
