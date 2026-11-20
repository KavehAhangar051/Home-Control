#pragma once
#include <cstdint>

class Ticker {
public:
    template <typename TArg>
    void once_ms(uint32_t, void (*)(TArg), TArg) {}
    template <typename TArg>
    void once(float, void (*)(TArg), TArg) {}
    void detach() {}
    bool active() const { return false; }
};
