/**
 * @file AsyncMqttAsm.h
 * @brief Low-level Xtensa LX6 optimized primitives for AsyncMqttClient.
 * @author uniuno
 * 
 * PURPOSE: Accelerate MQTT protocol hot paths safely and with zero pipeline stalls.
 */

#pragma once

#include <cstddef>
#include <cstdint>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <Optimization/CompilerTraits.h>
#include <Optimization/XtensaMemAsm.h>

namespace uniuno {
namespace asyncmqtt_asm {

/**
 * @brief Division-free millisecond timestamp using FreeRTOS 1000Hz tick count.
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
 * @brief Fast branchless minimum calculation.
 * GCC on Xtensa LX6 automatically lowers this to sub + movltz instructions.
 */
FORCE_INLINE size_t asm_min(size_t a, size_t b) {
    return (a < b) ? a : b;
}

/**
 * @brief Fast 1-cycle MQTT fixed header nibble extraction.
 * Extracts Packet Type (bits 7:4) and Header Flags (bits 3:0).
 * Handled safely in C++ so GCC can optimize register allocation without early-clobber hazards.
 */
template <typename TType, typename TFlags>
FORCE_INLINE void asm_extract_header(uint8_t byte, TType& type, TFlags& flags) {
    type = static_cast<TType>(byte >> 4);
    flags = static_cast<TFlags>(byte & 0x0F);
}

/**
 * @brief Fast 16-bit big-endian network integer composition.
 */
FORCE_INLINE uint16_t asm_make_uint16(uint8_t msb, uint8_t lsb) {
    return static_cast<uint16_t>((static_cast<uint16_t>(msb) << 8) | lsb);
}

/**
 * @brief Fast 16-bit network integer splitting into network byte order (MSB, LSB).
 */
FORCE_INLINE void asm_split_uint16(uint16_t val, char& msb, char& lsb) {
    msb = static_cast<char>(val >> 8);
    lsb = static_cast<char>(val & 0xFF);
}

} // namespace asyncmqtt_asm
} // namespace uniuno
