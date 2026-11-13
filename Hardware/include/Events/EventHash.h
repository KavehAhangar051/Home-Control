#pragma once

#include <cstdint>

namespace uniuno {

/**
 * @brief Compile-time and runtime djb2 hash for event names.
 * When called with a constexpr string literal, the compiler evaluates
 * this entirely at compile-time — zero runtime cost.
 */
constexpr uint32_t hash_event_name(const char* str) {
    if (!str) return 0;
    uint32_t hash = 5381;
    while (*str) {
        hash = ((hash << 5) + hash) + static_cast<uint32_t>(*str++);
    }
    return hash;
}

/**
 * @brief Compile-time event hash — evaluated once per EventType, stored in Flash.
 * Usage: kEventHash<MyEvent>  instead of  hash_event_name(MyEvent::Name)
 * Eliminates the runtime string loop from every dispatch<T> and on<T> call.
 */
template<typename EventType>
static constexpr uint32_t kEventHash = hash_event_name(EventType::Name);

} // namespace uniuno
