/**
 * @file FramedSpscRing.h
 * @brief Lock-free, wait-free, zero-heap Single-Producer Single-Consumer (SPSC)
 *        variable-length framed byte ring buffer for ESP32 dual-core handoff.
 *
 * Producer (e.g. Core 0 AsyncTCP / MQTT RX) pushes variable-length payloads with
 * zero heap allocation and zero FreeRTOS mutex overhead.
 * Consumer (e.g. Core 1 real-time loop()) checks hasPending() in ~2 CPU cycles
 * and reads each frame as a contiguous zero-copy slice directly from ring memory.
 */

#ifndef ACHAEMENID_OPTIMIZATION_FRAMED_SPSC_RING_H
#define ACHAEMENID_OPTIMIZATION_FRAMED_SPSC_RING_H

#include <Optimization/CompilerTraits.h>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace uniuno {

template <size_t CapacityBytes> class FramedSpscRing {
  static_assert((CapacityBytes >= 64U) && ((CapacityBytes & (CapacityBytes - 1U)) == 0U),
                "FramedSpscRing CapacityBytes must be a power of 2 >= 64");

public:
  static constexpr uint16_t kWrapSentinel = 0xFFFFU;
  static constexpr size_t kHeaderSize = sizeof(uint16_t);
  static constexpr size_t kAlign = 4U;

  FramedSpscRing() noexcept : head_(0U), tail_(0U), dropped_(0U) {}

  FramedSpscRing(const FramedSpscRing&) = delete;
  FramedSpscRing& operator=(const FramedSpscRing&) = delete;

  /**
   * @brief Ultra-fast ~2-cycle check safe to inline in IRAM_ATTR loop().
   */
  HOT_PATH FORCE_INLINE bool hasPending() const noexcept {
    return head_.load(std::memory_order_relaxed) != tail_.load(std::memory_order_acquire);
  }

  /**
   * @brief Producer-only: push a variable-length binary frame into the ring.
   *        Returns false (and increments dropped count) if the ring lacks contiguous space.
   */
  HOT_PATH bool push(const uint8_t* data, size_t len) noexcept {
    if (UNLIKELY(data == nullptr || len == 0U || len >= kWrapSentinel)) {
      return false;
    }

    const size_t recordBytes = alignUp(kHeaderSize + len + 1U);
    if (UNLIKELY(recordBytes >= CapacityBytes)) {
      dropped_.fetch_add(1U, std::memory_order_relaxed);
      return false;
    }

    const uint32_t tail = tail_.load(std::memory_order_relaxed);
    const uint32_t head = head_.load(std::memory_order_acquire);

    // Reserve at least 1 aligned slot (4B) between tail and head to distinguish full vs empty.
    const size_t tailToEnd = CapacityBytes - tail;

    if (tail >= head) {
      // Contiguous region [tail .. CapacityBytes)
      if (LIKELY(tailToEnd >= recordBytes && (tail + recordBytes < CapacityBytes || head > 0U))) {
        writeRecord(tail, data, static_cast<uint16_t>(len));
        const uint32_t nextTail =
            (tail + recordBytes == CapacityBytes) ? 0U : static_cast<uint32_t>(tail + recordBytes);
        tail_.store(nextTail, std::memory_order_release);
        return true;
      }

      // Need to wrap around to offset 0: ensure [0 .. head) has strictly more than recordBytes.
      if (UNLIKELY(head <= recordBytes)) {
        dropped_.fetch_add(1U, std::memory_order_relaxed);
        return false;
      }

      // Write wrap sentinel at tail (always >= 4 bytes available because all records are 4-byte aligned)
      if (tailToEnd >= kHeaderSize) {
        writeU16(tail, kWrapSentinel);
      }
      writeRecord(0U, data, static_cast<uint16_t>(len));
      tail_.store(static_cast<uint32_t>(recordBytes), std::memory_order_release);
      return true;
    }

    // Wrapped layout: head > tail; free contiguous space is [tail .. head - 1]
    const size_t freeBetween = static_cast<size_t>(head - tail);
    if (UNLIKELY(freeBetween <= recordBytes)) {
      dropped_.fetch_add(1U, std::memory_order_relaxed);
      return false;
    }

    writeRecord(tail, data, static_cast<uint16_t>(len));
    tail_.store(static_cast<uint32_t>(tail + recordBytes), std::memory_order_release);
    return true;
  }

  /**
   * @brief Consumer-only: invoke `fn(const uint8_t* payload, size_t len)` with zero-copy slice
   *        for the next queued frame, then advance head. Returns false if empty.
   */
  template <typename Callback> HOT_PATH bool pop(Callback&& fn) {
    uint32_t head = head_.load(std::memory_order_relaxed);
    const uint32_t tail = tail_.load(std::memory_order_acquire);
    if (head == tail) {
      return false;
    }

    if (head + kHeaderSize > CapacityBytes) {
      head = 0U;
    }

    uint16_t len = readU16(head);
    if (len == kWrapSentinel) {
      head = 0U;
      if (head == tail) {
        head_.store(0U, std::memory_order_release);
        return false;
      }
      len = readU16(0U);
    }

    const size_t recordBytes = alignUp(kHeaderSize + static_cast<size_t>(len) + 1U);
    const uint8_t* payloadPtr = buffer_ + head + kHeaderSize;

    fn(payloadPtr, static_cast<size_t>(len));

    uint32_t nextHead = static_cast<uint32_t>(head + recordBytes);
    if (nextHead >= CapacityBytes) {
      nextHead = 0U;
    }
    head_.store(nextHead, std::memory_order_release);
    return true;
  }

  /**
   * @brief Consumer-only: drain up to `maxFrames` queued frames in FIFO order.
   */
  template <typename Callback> HOT_PATH size_t drain(Callback&& fn, size_t maxFrames = 16U) {
    size_t count = 0U;
    while (count < maxFrames && pop(fn)) {
      ++count;
    }
    return count;
  }

  void clear() noexcept {
    head_.store(0U, std::memory_order_relaxed);
    tail_.store(0U, std::memory_order_release);
  }

  uint32_t droppedCount() const noexcept { return dropped_.load(std::memory_order_relaxed); }
  static constexpr size_t capacityBytes() noexcept { return CapacityBytes; }

private:
  static constexpr size_t alignUp(size_t n) noexcept { return (n + (kAlign - 1U)) & ~(kAlign - 1U); }

  FORCE_INLINE void writeU16(uint32_t offset, uint16_t value) noexcept {
    buffer_[offset] = static_cast<uint8_t>(value & 0xFFU);
    buffer_[offset + 1U] = static_cast<uint8_t>((value >> 8U) & 0xFFU);
  }

  FORCE_INLINE uint16_t readU16(uint32_t offset) const noexcept {
    return static_cast<uint16_t>(buffer_[offset]) | (static_cast<uint16_t>(buffer_[offset + 1U]) << 8U);
  }

  FORCE_INLINE void writeRecord(uint32_t offset, const uint8_t* data, uint16_t len) noexcept {
    writeU16(offset, len);
    std::memcpy(buffer_ + offset + kHeaderSize, data, len);
    buffer_[offset + kHeaderSize + len] = 0U;
  }

  alignas(4) uint8_t buffer_[CapacityBytes];
  // Separate cache-aligned producer/consumer indices to prevent Core 0 / Core 1 false sharing
  alignas(32) std::atomic<uint32_t> head_;
  alignas(32) std::atomic<uint32_t> tail_;
  std::atomic<uint32_t> dropped_;
};

} // namespace uniuno

#endif // ACHAEMENID_OPTIMIZATION_FRAMED_SPSC_RING_H
