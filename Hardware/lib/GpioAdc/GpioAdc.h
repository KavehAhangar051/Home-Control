#ifndef GPIO_ADC_H
#define GPIO_ADC_H

#include <Arduino.h>
#include <Optimization/CompilerTraits.h>
#include <cstdint>

/**
 * @struct AdcSampleResult
 * @brief Lightweight value-returned result from GpioAdc::sample() / readNow().
 */
struct AdcSampleResult {
    uint16_t value;
    bool sampled : 1;          // True when hardware ADC was sampled during this call
    bool valueChanged : 1;     // True when filtered value crossed deltaThreshold or hit rail
    bool thresholdChanged : 1; // True when Schmitt-trigger logical state flipped
    bool thresholdState : 1;   // Current logical state (true = HIGH, false = LOW)

    AdcSampleResult()
        : value(0),
          sampled(false),
          valueChanged(false),
          thresholdChanged(false),
          thresholdState(false) {}
};

/**
 * @class GpioAdc
 * @brief Zero-heap, inline-embeddable ESP32 ADC1 analog input driver.
 *
 * Designed to mirror GpioPwm and GpioSwitch conventions:
 * - Zero dynamic allocation (embedded inline inside PinEntry)
 * - Strictly validates ESP32 ADC1 pins (32, 33, 34, 35, 36, 39) to avoid
 *   ADC2/WiFi hardware peripheral conflicts
 * - Compatible with both Arduino-ESP32 Core v2.x and Core v3.x
 * - 4x oversampling + integer EMA smoothing (zero floating-point overhead)
 * - Configurable resolution (8..12 bits), sample interval, change deadband,
 *   and Schmitt-trigger hysteresis thresholds for RuleEngine automation
 */
class GpioAdc {
public:
    static constexpr uint8_t DEFAULT_RESOLUTION = 12;
    static constexpr uint8_t MIN_RESOLUTION = 8;
    static constexpr uint8_t MAX_RESOLUTION = 12;

    static constexpr uint16_t DEFAULT_SAMPLE_INTERVAL_MS = 500;
    static constexpr uint16_t MIN_SAMPLE_INTERVAL_MS = 50;
    static constexpr uint16_t MAX_SAMPLE_INTERVAL_MS = 60000;

    static constexpr uint16_t DEFAULT_DELTA_THRESHOLD = 40;
    static constexpr uint16_t MIN_DELTA_THRESHOLD = 1;
    static constexpr uint16_t MAX_ADC_VALUE = 4095;

    static constexpr uint8_t OVERSAMPLE_COUNT = 4;

    // Bitmask of WiFi-safe ESP32 ADC1 GPIO pins (ADC1_CH0, CH3, CH4, CH5, CH6, CH7):
    // GPIO 32, 33, 34, 35, 36 (VP), 39 (VN).
    // ADC2 pins (0, 2, 4, 12..15, 25..27) are intentionally excluded because
    // ESP32 WiFi claims ADC2 during active radio operation.
    static constexpr uint64_t VALID_ADC1_PIN_MASK =
        (1ULL << 32) | (1ULL << 33) | (1ULL << 34) | (1ULL << 35) | (1ULL << 36) | (1ULL << 39);

    GpioAdc();
    GpioAdc(
        int8_t pin,
        uint8_t resolution = DEFAULT_RESOLUTION,
        uint16_t sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
        uint16_t deltaThreshold = DEFAULT_DELTA_THRESHOLD,
        uint16_t highThreshold = 0,
        uint16_t lowThreshold = 0
    );

    /**
     * @brief Branchless 1-cycle ESP32 ADC1 pin safety check.
     */
    HOT_PATH FORCE_INLINE static constexpr bool isValidAdcPin(int pin) {
        return (pin >= 0 && pin < 40) &&
               (((VALID_ADC1_PIN_MASK >> static_cast<uint8_t>(pin)) & 1ULL) != 0ULL);
    }

    /**
     * @brief Clamp requested ADC bit resolution into supported range [8..12].
     */
    HOT_PATH FORCE_INLINE static constexpr uint8_t normalizeResolution(int resolution) {
        return (resolution < MIN_RESOLUTION)
            ? MIN_RESOLUTION
            : ((resolution > MAX_RESOLUTION) ? MAX_RESOLUTION : static_cast<uint8_t>(resolution));
    }

    /**
     * @brief Clamp sampling interval into safe range [50..60000] ms.
     */
    HOT_PATH FORCE_INLINE static constexpr uint16_t normalizeSampleInterval(int intervalMs) {
        return (intervalMs < MIN_SAMPLE_INTERVAL_MS)
            ? MIN_SAMPLE_INTERVAL_MS
            : ((intervalMs > MAX_SAMPLE_INTERVAL_MS) ? MAX_SAMPLE_INTERVAL_MS : static_cast<uint16_t>(intervalMs));
    }

    /**
     * @brief Maximum raw count for a given bit resolution.
     */
    HOT_PATH FORCE_INLINE static constexpr uint16_t maxValueForResolution(uint8_t resolution) {
        return static_cast<uint16_t>((1UL << normalizeResolution(resolution)) - 1UL);
    }

    /**
     * @brief Clamp change deadband threshold into [1..maxValueForResolution(res)].
     */
    HOT_PATH FORCE_INLINE static constexpr uint16_t normalizeDelta(int delta, uint8_t resolution = DEFAULT_RESOLUTION) {
        return (delta < MIN_DELTA_THRESHOLD)
            ? MIN_DELTA_THRESHOLD
            : ((delta > static_cast<int>(maxValueForResolution(resolution)))
                   ? maxValueForResolution(resolution)
                   : static_cast<uint16_t>(delta));
    }

    /**
     * @brief Clamp Schmitt-trigger thresholds to [0..maxValue] and guarantee low <= high.
     */
    HOT_PATH FORCE_INLINE static void normalizeThresholds(uint16_t& highThreshold, uint16_t& lowThreshold, uint8_t resolution) {
        const uint16_t maxVal = maxValueForResolution(resolution);
        if (highThreshold > maxVal) highThreshold = maxVal;
        if (highThreshold == 0) {
            lowThreshold = 0;
            return;
        }
        if (lowThreshold > highThreshold) {
            lowThreshold = highThreshold;
        }
    }

    // Configure parameters prior to begin()
    void configure(
        int8_t pin,
        uint8_t resolution = DEFAULT_RESOLUTION,
        uint16_t sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
        uint16_t deltaThreshold = DEFAULT_DELTA_THRESHOLD,
        uint16_t highThreshold = 0,
        uint16_t lowThreshold = 0
    );

    // Update runtime parameters without detaching the pin
    void updateParameters(
        uint16_t sampleIntervalMs,
        uint16_t deltaThreshold,
        uint16_t highThreshold,
        uint16_t lowThreshold,
        uint8_t resolution = 0 // 0 = keep current resolution
    );

    // Configure hardware pin attenuation/mode and capture initial baseline sample
    bool begin();

    // Detach and reset internal state
    void end();

    /**
     * @brief Poll ADC if sampleIntervalMs has elapsed since last sample.
     * @param nowMs Current millis() timestamp.
     */
    HOT_PATH AdcSampleResult sample(unsigned long nowMs);

    /**
     * @brief Force an immediate ADC reading regardless of sampleIntervalMs or deltaThreshold.
     * @param nowMs Current millis() timestamp.
     */
    HOT_PATH AdcSampleResult readNow(unsigned long nowMs);

    HOT_PATH FORCE_INLINE uint16_t getMaxValue() const {
        return static_cast<uint16_t>((1UL << _resolution) - 1UL);
    }

    HOT_PATH FORCE_INLINE uint16_t getValue() const { return _filteredValue; }
    HOT_PATH FORCE_INLINE uint16_t getLastReportedValue() const { return _lastReportedValue; }
    HOT_PATH FORCE_INLINE bool getThresholdState() const { return _thresholdState; }
    HOT_PATH FORCE_INLINE bool hasThreshold() const { return _highThreshold > 0; }
    HOT_PATH FORCE_INLINE int8_t getPin() const { return _pin; }
    HOT_PATH FORCE_INLINE uint8_t getResolution() const { return _resolution; }
    HOT_PATH FORCE_INLINE uint16_t getSampleIntervalMs() const { return _sampleIntervalMs; }
    HOT_PATH FORCE_INLINE uint16_t getDeltaThreshold() const { return _deltaThreshold; }
    HOT_PATH FORCE_INLINE uint16_t getHighThreshold() const { return _highThreshold; }
    HOT_PATH FORCE_INLINE uint16_t getLowThreshold() const { return _lowThreshold; }
    HOT_PATH FORCE_INLINE unsigned long getLastSampleTime() const { return _lastSampleTime; }
    HOT_PATH FORCE_INLINE bool isAttached() const { return _attached; }

private:
    unsigned long _lastSampleTime;
    uint16_t _sampleIntervalMs;
    uint16_t _deltaThreshold;
    uint16_t _highThreshold;
    uint16_t _lowThreshold;
    uint16_t _filteredValue;
    uint16_t _lastReportedValue;
    int8_t _pin;
    uint8_t _resolution;
    bool _thresholdState : 1;
    bool _initialized : 1;
    bool _attached : 1;

    HOT_PATH uint16_t readHardwareSample() const;
    HOT_PATH AdcSampleResult processReading(uint16_t rawSample, unsigned long nowMs, bool forceReport);
};

#endif // GPIO_ADC_H
