#pragma once

#include <algorithm>
#include <cctype>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <freertos/FreeRTOS.h>

#ifndef ARDUINO
#define ARDUINO 10812
#endif

#ifndef INPUT
#define INPUT 0x01
#endif
#ifndef OUTPUT
#define OUTPUT 0x02
#endif
#ifndef INPUT_PULLUP
#define INPUT_PULLUP 0x05
#endif
#ifndef LOW
#define LOW 0x0
#endif
#ifndef HIGH
#define HIGH 0x1
#endif

typedef enum {
    ADC_0db = 0,
    ADC_2_5db = 1,
    ADC_6db = 2,
    ADC_11db = 3
} adc_attenuation_t;

#ifndef IRAM_ATTR
#define IRAM_ATTR
#endif
#ifndef PROGMEM
#define PROGMEM
#endif
#ifndef PSTR
#define PSTR(s) (s)
#endif
#ifndef pgm_read_byte
#define pgm_read_byte(addr) (*reinterpret_cast<const uint8_t*>(addr))
#endif

class __FlashStringHelper;
#define FPSTR(p) (reinterpret_cast<const __FlashStringHelper*>(p))
#define F(s) (reinterpret_cast<const __FlashStringHelper*>(s))

class Print {
public:
    virtual ~Print() = default;
    virtual size_t write(uint8_t) { return 1; }
    virtual size_t write(const uint8_t*, size_t size) { return size; }
};

class Printable {
public:
    virtual ~Printable() = default;
    virtual size_t printTo(Print& p) const = 0;
};

class Stream : public Print {
public:
    virtual int available() { return 0; }
    virtual int read() { return -1; }
    virtual int peek() { return -1; }
    virtual size_t readBytes(char*, size_t) { return 0; }
};

inline size_t strlcpy(char* dst, const char* src, size_t size) {
    if (!src) src = "";
    const size_t srclen = std::strlen(src);
    if (size > 0) {
        const size_t copyLen = (srclen >= size) ? (size - 1) : srclen;
        std::memcpy(dst, src, copyLen);
        dst[copyLen] = '\0';
    }
    return srclen;
}

class String {
public:
    String() = default;
    String(const char* s) : _s(s ? s : "") {}
    String(const std::string& s) : _s(s) {}
    explicit String(int v) : _s(std::to_string(v)) {}
    explicit String(unsigned int v) : _s(std::to_string(v)) {}
    explicit String(long v) : _s(std::to_string(v)) {}
    explicit String(unsigned long v) : _s(std::to_string(v)) {}

    const char* c_str() const { return _s.c_str(); }
    size_t length() const { return _s.size(); }
    bool isEmpty() const { return _s.empty(); }
    void reserve(size_t cap) { _s.reserve(cap); }
    void clear() { _s.clear(); }

    bool concat(const char* data, size_t len) {
        if (data && len > 0) _s.append(data, len);
        return true;
    }
    bool concat(const char* data) {
        if (data) _s.append(data);
        return true;
    }
    bool concat(char c) {
        _s.push_back(c);
        return true;
    }

    bool startsWith(const char* prefix) const {
        if (!prefix) return false;
        const size_t n = std::strlen(prefix);
        return _s.size() >= n && _s.compare(0, n, prefix) == 0;
    }
    bool startsWith(const String& prefix) const {
        return startsWith(prefix.c_str());
    }

    int indexOf(const char* needle, size_t fromIndex = 0) const {
        if (!needle) return -1;
        const size_t pos = _s.find(needle, fromIndex);
        return (pos == std::string::npos) ? -1 : static_cast<int>(pos);
    }
    int indexOf(const String& needle, size_t fromIndex = 0) const {
        return indexOf(needle.c_str(), fromIndex);
    }
    int indexOf(char ch, size_t fromIndex = 0) const {
        const size_t pos = _s.find(ch, fromIndex);
        return (pos == std::string::npos) ? -1 : static_cast<int>(pos);
    }

    String substring(size_t beginIndex) const {
        if (beginIndex >= _s.size()) return String("");
        return String(_s.substr(beginIndex));
    }
    String substring(size_t beginIndex, size_t endIndex) const {
        if (beginIndex >= _s.size() || endIndex <= beginIndex) return String("");
        const size_t len = std::min(endIndex, _s.size()) - beginIndex;
        return String(_s.substr(beginIndex, len));
    }

    void replace(const char* findStr, const char* replaceStr) {
        if (!findStr || !*findStr || !replaceStr) return;
        const std::string needle(findStr);
        const std::string rep(replaceStr);
        size_t pos = 0;
        while ((pos = _s.find(needle, pos)) != std::string::npos) {
            _s.replace(pos, needle.size(), rep);
            pos += rep.size();
        }
    }

    void trim() {
        size_t start = 0;
        while (start < _s.size() && std::isspace(static_cast<unsigned char>(_s[start]))) ++start;
        size_t end = _s.size();
        while (end > start && std::isspace(static_cast<unsigned char>(_s[end - 1]))) --end;
        _s = _s.substr(start, end - start);
    }

    char operator[](size_t idx) const { return idx < _s.size() ? _s[idx] : '\0'; }

    String& operator+=(const char* rhs) { if (rhs) _s += rhs; return *this; }
    String& operator+=(const String& rhs) { _s += rhs._s; return *this; }
    String& operator+=(char c) { _s.push_back(c); return *this; }
    String& operator+=(int v) { _s += std::to_string(v); return *this; }

    friend String operator+(const String& lhs, const String& rhs) { return String(lhs._s + rhs._s); }
    friend String operator+(const String& lhs, const char* rhs) { return String(lhs._s + (rhs ? rhs : "")); }
    friend String operator+(const char* lhs, const String& rhs) { return String(std::string(lhs ? lhs : "") + rhs._s); }

    bool operator==(const String& rhs) const { return _s == rhs._s; }
    bool operator==(const char* rhs) const { return _s == (rhs ? rhs : ""); }
    bool operator!=(const String& rhs) const { return _s != rhs._s; }
    bool operator!=(const char* rhs) const { return !(*this == rhs); }

private:
    std::string _s;
};

struct MockLedcChannelState {
    bool configured = false;
    double freq = 0.0;
    uint8_t resolution = 0;
    uint32_t duty = 0;
    int8_t attachedPin = -1;
};

struct MockLedcPinState {
    bool attached = false;
    uint32_t freq = 0;
    uint8_t resolution = 0;
    uint32_t duty = 0;
};

struct MockHardwareState {
    unsigned long fakeMillis = 1000;
    uint8_t pinModes[64]{};
    int digitalStates[64]{};
    int analogValues[64]{};
    adc_attenuation_t analogAttenuation[64]{};
    uint8_t adcReadResolution = 12;
    int analogReadCalls = 0;
    int analogSetAttenCalls = 0;
    MockLedcChannelState ledcChannels[16]{};
    MockLedcPinState ledcPins[64]{};
    int ledcSetupCalls = 0;
    int ledcAttachPinCalls = 0;
    int ledcDetachPinCalls = 0;
    int ledcAttachCalls = 0;
    int ledcDetachCalls = 0;
    int ledcWriteCalls = 0;
    int analogWriteCalls = 0;
    bool failNextLedcAttach = false;
    bool failNextLedcSetup = false;

    void reset() {
        *this = MockHardwareState{};
    }
};

inline MockHardwareState& mockHw() {
    static MockHardwareState instance;
    return instance;
}

class MockSerial {
public:
    void begin(unsigned long) {}
    void print(const char*) {}
    void print(const __FlashStringHelper*) {}
    void print(int) {}
    void println(const char* = "") {}
    void println(const __FlashStringHelper*) {}
    void println(const String&) {}
    void printf(const char*, ...) {}
    void printf_P(const char*, ...) {}
};

inline MockSerial& getMockSerial() {
    static MockSerial instance;
    return instance;
}
#define Serial (getMockSerial())

inline unsigned long millis() { return mockHw().fakeMillis; }
inline unsigned long micros() { return mockHw().fakeMillis * 1000UL; }
inline void delay(unsigned long ms) { mockHw().fakeMillis += ms; }

inline void pinMode(uint8_t pin, uint8_t mode) {
    if (pin < 64) mockHw().pinModes[pin] = mode;
}
inline void digitalWrite(uint8_t pin, uint8_t val) {
    if (pin < 64) mockHw().digitalStates[pin] = (val != LOW) ? HIGH : LOW;
}
inline int digitalRead(uint8_t pin) {
    return (pin < 64) ? mockHw().digitalStates[pin] : LOW;
}
inline void analogWrite(uint8_t pin, int value) {
    mockHw().analogWriteCalls++;
    if (pin < 64) mockHw().ledcPins[pin].duty = static_cast<uint32_t>(value < 0 ? 0 : value);
}
inline int analogRead(uint8_t pin) {
    mockHw().analogReadCalls++;
    return (pin < 64) ? mockHw().analogValues[pin] : 0;
}
inline void analogReadResolution(uint8_t bits) {
    mockHw().adcReadResolution = bits;
}
inline void analogSetPinAttenuation(uint8_t pin, adc_attenuation_t attenuation) {
    mockHw().analogSetAttenCalls++;
    if (pin < 64) mockHw().analogAttenuation[pin] = attenuation;
}

// ESP32 LEDC API stubs (both Core v2 and Core v3 signatures)
inline double ledcSetup(uint8_t chan, double freq, uint8_t bit_num) {
    mockHw().ledcSetupCalls++;
    if (mockHw().failNextLedcSetup) {
        mockHw().failNextLedcSetup = false;
        return 0.0;
    }
    if (chan >= 16) return 0.0;
    mockHw().ledcChannels[chan].configured = true;
    mockHw().ledcChannels[chan].freq = freq;
    mockHw().ledcChannels[chan].resolution = bit_num;
    return freq;
}

inline void ledcAttachPin(uint8_t pin, uint8_t chan) {
    mockHw().ledcAttachPinCalls++;
    if (chan < 16) {
        mockHw().ledcChannels[chan].attachedPin = static_cast<int8_t>(pin);
    }
    if (pin < 64 && chan < 16) {
        mockHw().ledcPins[pin].attached = true;
        mockHw().ledcPins[pin].freq = static_cast<uint32_t>(mockHw().ledcChannels[chan].freq);
        mockHw().ledcPins[pin].resolution = mockHw().ledcChannels[chan].resolution;
    }
}

inline void ledcDetachPin(uint8_t pin) {
    mockHw().ledcDetachPinCalls++;
    for (int i = 0; i < 16; ++i) {
        if (mockHw().ledcChannels[i].attachedPin == static_cast<int8_t>(pin)) {
            mockHw().ledcChannels[i].attachedPin = -1;
        }
    }
    if (pin < 64) mockHw().ledcPins[pin].attached = false;
}

inline bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t resolution) {
    mockHw().ledcAttachCalls++;
    if (mockHw().failNextLedcAttach) {
        mockHw().failNextLedcAttach = false;
        return false;
    }
    if (pin >= 64) return false;
    mockHw().ledcPins[pin].attached = true;
    mockHw().ledcPins[pin].freq = freq;
    mockHw().ledcPins[pin].resolution = resolution;
    return true;
}

inline bool ledcDetach(uint8_t pin) {
    mockHw().ledcDetachCalls++;
    if (pin >= 64) return false;
    mockHw().ledcPins[pin].attached = false;
    return true;
}

inline bool ledcWrite(uint8_t pinOrChan, uint32_t duty) {
    mockHw().ledcWriteCalls++;
#if defined(UNIUNO_TEST_ESP32_CORE_V3)
    if (pinOrChan < 64) {
        mockHw().ledcPins[pinOrChan].duty = duty;
        return true;
    }
    return false;
#else
    if (pinOrChan < 16) {
        mockHw().ledcChannels[pinOrChan].duty = duty;
        const int8_t pin = mockHw().ledcChannels[pinOrChan].attachedPin;
        if (pin >= 0 && pin < 64) {
            mockHw().ledcPins[pin].duty = duty;
        }
        return true;
    }
    return false;
#endif
}

struct MockEspClass {
    void restart() {}
};
inline MockEspClass& getMockEsp() {
    static MockEspClass instance;
    return instance;
}
#define ESP (getMockEsp())
