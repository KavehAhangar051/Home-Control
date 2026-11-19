#ifndef GPIO_PWM_H
#define GPIO_PWM_H

#include <Arduino.h>
#include <Optimization/CompilerTraits.h>
#include <cstdint>

/**
 * @class GpioPwm
 * @brief Zero-heap, inline-embeddable ESP32 LEDC PWM output driver.
 *
 * Designed to mirror GpioSwitch's footprint and performance conventions:
 * - Zero dynamic allocation (embedded inline inside PinEntry)
 * - Dual Arduino-ESP32 Core v2.x (O(1) bitmask channel allocator) and Core v3.x API support
 * - Supports both 8-bit (0..255) and 12-bit (0..4095) resolution (8..12 bit range)
 * - Preserves last non-zero duty cycle for instant ON/OFF brightness restoration
 */
class GpioPwm {
public:
    static constexpr uint8_t DEFAULT_RESOLUTION = 8;
    static constexpr uint8_t MIN_RESOLUTION = 8;
    static constexpr uint8_t MAX_RESOLUTION = 12;
    static constexpr uint16_t DEFAULT_FREQUENCY = 5000;
    static constexpr uint16_t MIN_FREQUENCY = 100;
    static constexpr uint16_t MAX_FREQUENCY = 40000;
    static constexpr uint8_t MAX_LEDC_CHANNELS = 16;

    // Bitmask of ESP32 pins that MUST NOT be used for PWM output:
    // - GPIO 6..11: internal SPI flash
    // - GPIO 34, 35, 36, 39: input-only pins (no output driver)
    static constexpr uint64_t INVALID_PWM_PIN_MASK =
        (0x3FULL << 6) | (1ULL << 34) | (1ULL << 35) | (1ULL << 36) | (1ULL << 39);

    GpioPwm();
    GpioPwm(int8_t pin, uint8_t resolution = DEFAULT_RESOLUTION, uint16_t frequency = DEFAULT_FREQUENCY, bool activeHigh = true);

    /**
     * @brief Branchless 1-cycle ESP32 PWM pin safety check.
     */
    HOT_PATH FORCE_INLINE static constexpr bool isValidPwmPin(int pin) {
        return (pin >= 0 && pin < 40) && (((INVALID_PWM_PIN_MASK >> static_cast<uint8_t>(pin)) & 1ULL) == 0ULL);
    }

    /**
     * @brief Clamp requested bit resolution into supported LEDC range [8..12].
     */
    HOT_PATH FORCE_INLINE static constexpr uint8_t normalizeResolution(int resolution) {
        return (resolution < MIN_RESOLUTION)
            ? MIN_RESOLUTION
            : ((resolution > MAX_RESOLUTION) ? MAX_RESOLUTION : static_cast<uint8_t>(resolution));
    }

    /**
     * @brief Clamp requested PWM carrier frequency into safe LEDC range [100..40000] Hz.
     */
    HOT_PATH FORCE_INLINE static constexpr uint16_t normalizeFrequency(int frequency) {
        return (frequency < MIN_FREQUENCY)
            ? MIN_FREQUENCY
            : ((frequency > MAX_FREQUENCY) ? MAX_FREQUENCY : static_cast<uint16_t>(frequency));
    }

    // Configure pin parameters prior to begin()
    void configure(int8_t pin, uint8_t resolution = DEFAULT_RESOLUTION, uint16_t frequency = DEFAULT_FREQUENCY, bool activeHigh = true);

    // Attach LEDC peripheral and initialize output to safe OFF (0) state
    bool begin();

    // Drive output to 0, detach LEDC peripheral, and release channel (Core v2.x)
    void end();

    // Set exact PWM duty cycle (clamped to [0..getMaxDuty()])
    HOT_PATH void setValue(uint16_t value);

    // Digital ON/OFF control: ON restores _lastNonZeroValue, OFF sets duty to 0 while retaining memory
    HOT_PATH void setState(bool on);

    HOT_PATH FORCE_INLINE void turnOn() { setState(true); }
    HOT_PATH FORCE_INLINE void turnOff() { setState(false); }
    HOT_PATH FORCE_INLINE void toggle() { setState(_value == 0); }

    HOT_PATH FORCE_INLINE uint16_t getMaxDuty() const {
        return static_cast<uint16_t>((1UL << _resolution) - 1UL);
    }

    HOT_PATH FORCE_INLINE uint16_t clampValue(int32_t value) const {
        if (value <= 0) return 0;
        const uint16_t maxDuty = getMaxDuty();
        return (value >= static_cast<int32_t>(maxDuty)) ? maxDuty : static_cast<uint16_t>(value);
    }

    HOT_PATH FORCE_INLINE uint16_t getValue() const { return _value; }
    HOT_PATH FORCE_INLINE uint16_t getLastNonZeroValue() const { return _lastNonZeroValue; }
    HOT_PATH FORCE_INLINE bool getState() const { return _value > 0; }
    HOT_PATH FORCE_INLINE int8_t getPin() const { return _pin; }
    HOT_PATH FORCE_INLINE int8_t getChannel() const { return _channel; }
    HOT_PATH FORCE_INLINE uint8_t getResolution() const { return _resolution; }
    HOT_PATH FORCE_INLINE uint16_t getFrequency() const { return _frequency; }
    HOT_PATH FORCE_INLINE bool isAttached() const { return _attached; }

    // Diagnostic / test helper: active LEDC channel mask (Core v2.x)
    static uint16_t getAllocatedChannelMask();

private:
    uint16_t _frequency;
    uint16_t _value;
    uint16_t _lastNonZeroValue;
    int8_t _pin;
    int8_t _channel;
    uint8_t _resolution;
    bool _activeHigh : 1;
    bool _attached : 1;

    static uint16_t _channelMask;

    static int8_t allocateChannel();
    static void releaseChannel(int8_t channel);
    HOT_PATH void updateHardware();
};

#endif // GPIO_PWM_H
