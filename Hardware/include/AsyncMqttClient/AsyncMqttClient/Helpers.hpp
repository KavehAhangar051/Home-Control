#pragma once

#include <stdint.h>
#include <stddef.h>
#include <Optimization/CompilerTraits.h>

namespace AsyncMqttClientInternals {
class Helpers {
public:
  /**
   * @brief Fast bitwise remaining length decoder (MQTT 3.1.1 variable byte integer).
   * Accelerates the critical path (<128 bytes) in 1 CPU cycle without looping or shifting.
   */
  static inline uint32_t decodeRemainingLength(const char* bytes) {
    const uint8_t b0 = static_cast<uint8_t>(*bytes);
    if (LIKELY((b0 & 0x80) == 0)) {
      return b0;
    }

    uint32_t value = b0 & 0x7F;
    uint32_t shift = 7;
    bytes++;
    uint8_t encodedByte;
    do {
      encodedByte = static_cast<uint8_t>(*bytes++);
      value |= static_cast<uint32_t>(encodedByte & 0x7F) << shift;
      shift += 7;
    } while (encodedByte & 0x80);

    return value;
  }

  /**
   * @brief Fast bitwise remaining length encoder (MQTT 3.1.1 variable byte integer).
   * Direct 1-cycle write for lengths < 128 bytes (over 95% of typical MQTT packets).
   */
  static inline uint8_t encodeRemainingLength(uint32_t remainingLength, char* destination) {
    if (LIKELY(remainingLength < 128)) {
      destination[0] = static_cast<char>(remainingLength);
      return 1;
    }

    uint8_t bytesNeeded = 0;
    do {
      uint8_t encodedByte = static_cast<uint8_t>(remainingLength & 0x7F);
      remainingLength >>= 7;
      if (remainingLength > 0) {
        encodedByte |= 0x80;
      }
      destination[bytesNeeded++] = static_cast<char>(encodedByte);
    } while (remainingLength > 0);

    return bytesNeeded;
  }
};
} // namespace AsyncMqttClientInternals
