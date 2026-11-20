#include "GpioAdc.h"
#include <Timer/Optimization/TimerAsm.h>

#if defined(ESP32) || defined(UNIUNO_TEST_ESP32_ADC)
#define GPIO_ADC_HAS_ESP32_HAL 1
#else
#define GPIO_ADC_HAS_ESP32_HAL 0
#endif

GpioAdc::GpioAdc()
    : _lastSampleTime(0),
      _sampleIntervalMs(DEFAULT_SAMPLE_INTERVAL_MS),
      _deltaThreshold(DEFAULT_DELTA_THRESHOLD),
      _highThreshold(0),
      _lowThreshold(0),
      _filteredValue(0),
      _lastReportedValue(0),
      _pin(-1),
      _resolution(DEFAULT_RESOLUTION),
      _thresholdState(false),
      _initialized(false),
      _attached(false) {}

GpioAdc::GpioAdc(
    int8_t pin,
    uint8_t resolution,
    uint16_t sampleIntervalMs,
    uint16_t deltaThreshold,
    uint16_t highThreshold,
    uint16_t lowThreshold
) : _lastSampleTime(0),
    _sampleIntervalMs(normalizeSampleInterval(sampleIntervalMs)),
    _deltaThreshold(normalizeDelta(deltaThreshold, resolution)),
    _highThreshold(highThreshold),
    _lowThreshold(lowThreshold),
    _filteredValue(0),
    _lastReportedValue(0),
    _pin(pin),
    _resolution(normalizeResolution(resolution)),
    _thresholdState(false),
    _initialized(false),
    _attached(false) {
    normalizeThresholds(_highThreshold, _lowThreshold, _resolution);
}

void GpioAdc::configure(
    int8_t pin,
    uint8_t resolution,
    uint16_t sampleIntervalMs,
    uint16_t deltaThreshold,
    uint16_t highThreshold,
    uint16_t lowThreshold
) {
    if (_attached) {
        end();
    }
    _pin = pin;
    _resolution = normalizeResolution(resolution);
    _sampleIntervalMs = normalizeSampleInterval(sampleIntervalMs);
    _deltaThreshold = normalizeDelta(deltaThreshold, _resolution);
    _highThreshold = highThreshold;
    _lowThreshold = lowThreshold;
    normalizeThresholds(_highThreshold, _lowThreshold, _resolution);
    _filteredValue = 0;
    _lastReportedValue = 0;
    _thresholdState = false;
    _initialized = false;
    _lastSampleTime = 0;
}

void GpioAdc::updateParameters(
    uint16_t sampleIntervalMs,
    uint16_t deltaThreshold,
    uint16_t highThreshold,
    uint16_t lowThreshold,
    uint8_t resolution
) {
    if (resolution >= MIN_RESOLUTION && resolution <= MAX_RESOLUTION && resolution != _resolution) {
        // Rescale current cached values proportionally to the new bit depth
        if (resolution > _resolution) {
            const uint8_t shift = static_cast<uint8_t>(resolution - _resolution);
            _filteredValue = static_cast<uint16_t>(_filteredValue << shift);
            _lastReportedValue = static_cast<uint16_t>(_lastReportedValue << shift);
        } else {
            const uint8_t shift = static_cast<uint8_t>(_resolution - resolution);
            _filteredValue = static_cast<uint16_t>(_filteredValue >> shift);
            _lastReportedValue = static_cast<uint16_t>(_lastReportedValue >> shift);
        }
        _resolution = resolution;
    }

    _sampleIntervalMs = normalizeSampleInterval(sampleIntervalMs);
    _deltaThreshold = normalizeDelta(deltaThreshold, _resolution);
    _highThreshold = highThreshold;
    _lowThreshold = lowThreshold;
    normalizeThresholds(_highThreshold, _lowThreshold, _resolution);

    if (_highThreshold == 0) {
        _thresholdState = false;
    } else if (_initialized) {
        if (!_thresholdState && _filteredValue >= _highThreshold) {
            _thresholdState = true;
        } else if (_thresholdState) {
            const bool belowLow = (_lowThreshold < _highThreshold)
                ? (_filteredValue <= _lowThreshold)
                : (_filteredValue < _highThreshold);
            if (belowLow) {
                _thresholdState = false;
            }
        }
    }
}

bool GpioAdc::begin() {
    if (UNLIKELY(!isValidAdcPin(_pin))) {
        return false;
    }

    if (_attached) {
        end();
    }

    pinMode(static_cast<uint8_t>(_pin), INPUT);

#if GPIO_ADC_HAS_ESP32_HAL
    // Configure native 12-bit hardware resolution and full-scale ~3.3V attenuation (ADC_11db).
    // Works identically across Arduino-ESP32 Core v2.x and Core v3.x.
    analogReadResolution(MAX_RESOLUTION);
    analogSetPinAttenuation(static_cast<uint8_t>(_pin), ADC_11db);
#endif

    _attached = true;

    // Capture an initial clean baseline reading without triggering false boot edge events
    const uint16_t baseline = readHardwareSample();
    _filteredValue = baseline;
    _lastReportedValue = baseline;
    _thresholdState = (_highThreshold > 0) ? (baseline >= _highThreshold) : false;
    _initialized = true;
    _lastSampleTime = millis();
    return true;
}

void GpioAdc::end() {
    if (!_attached) {
        return;
    }
    _attached = false;
    _initialized = false;
    _filteredValue = 0;
    _lastReportedValue = 0;
    _thresholdState = false;
    _lastSampleTime = 0;
}

HOT_PATH uint16_t GpioAdc::readHardwareSample() const {
    if (UNLIKELY(_pin < 0)) {
        return 0;
    }

    // 4x oversampling with branchless shift average (zero heap, zero float division)
    uint32_t sum = 0;
    for (uint8_t i = 0; i < OVERSAMPLE_COUNT; ++i) {
        const int raw = analogRead(static_cast<uint8_t>(_pin));
        if (raw > 0) {
            sum += static_cast<uint32_t>(raw > MAX_ADC_VALUE ? MAX_ADC_VALUE : raw);
        }
    }

    uint16_t avg12 = static_cast<uint16_t>((sum + (OVERSAMPLE_COUNT >> 1)) >> 2);
    if (avg12 > MAX_ADC_VALUE) {
        avg12 = MAX_ADC_VALUE;
    }

    // Scale 12-bit hardware reading to segment's configured resolution [8..12]
    if (_resolution < MAX_RESOLUTION) {
        return static_cast<uint16_t>(avg12 >> (MAX_RESOLUTION - _resolution));
    }
    return avg12;
}

HOT_PATH AdcSampleResult GpioAdc::processReading(uint16_t rawSample, unsigned long nowMs, bool forceReport) {
    AdcSampleResult result;
    result.sampled = true;
    _lastSampleTime = nowMs;

    if (UNLIKELY(!_initialized)) {
        _filteredValue = rawSample;
        _initialized = true;
    } else {
        // Fast integer EMA low-pass filter (alpha = 0.5)
        // Snaps immediately to exact rail endpoints (0 or maxValue) so sensors reach 0% / 100% cleanly.
        const uint16_t maxVal = getMaxValue();
        if (rawSample == 0 && _filteredValue <= 1) {
            _filteredValue = 0;
        } else if (rawSample == maxVal && _filteredValue + 1 >= maxVal) {
            _filteredValue = maxVal;
        } else {
            _filteredValue = static_cast<uint16_t>((static_cast<uint32_t>(_filteredValue) + rawSample + 1UL) >> 1);
        }
    }

    result.value = _filteredValue;

    // 1. Evaluate Schmitt-trigger hysteresis thresholds (if enabled)
    if (_highThreshold > 0) {
        if (!_thresholdState && _filteredValue >= _highThreshold) {
            _thresholdState = true;
            result.thresholdChanged = true;
        } else if (_thresholdState) {
            const bool belowLow = (_lowThreshold < _highThreshold)
                ? (_filteredValue <= _lowThreshold)
                : (_filteredValue < _highThreshold);
            if (belowLow) {
                _thresholdState = false;
                result.thresholdChanged = true;
            }
        }
    } else {
        _thresholdState = false;
    }
    result.thresholdState = _thresholdState;

    // 2. Evaluate reporting deadband (deltaThreshold) + exact rail hits + threshold flip
    const uint16_t diff = (_filteredValue >= _lastReportedValue)
        ? static_cast<uint16_t>(_filteredValue - _lastReportedValue)
        : static_cast<uint16_t>(_lastReportedValue - _filteredValue);

    const uint16_t maxVal = getMaxValue();
    const bool railTransition =
        (_filteredValue == 0 && _lastReportedValue != 0) ||
        (_filteredValue == maxVal && _lastReportedValue != maxVal);

    if (forceReport || result.thresholdChanged || diff >= _deltaThreshold || railTransition) {
        _lastReportedValue = _filteredValue;
        result.valueChanged = true;
    }

    return result;
}

HOT_PATH AdcSampleResult GpioAdc::sample(unsigned long nowMs) {
    AdcSampleResult result;
    if (UNLIKELY(!_attached || _pin < 0)) {
        return result;
    }

    if (LIKELY(!uniuno::asm_opt::is_timer_expired(nowMs, _lastSampleTime + _sampleIntervalMs))) {
        result.value = _filteredValue;
        result.thresholdState = _thresholdState;
        return result;
    }

    const uint16_t raw = readHardwareSample();
    return processReading(raw, nowMs, false);
}

HOT_PATH AdcSampleResult GpioAdc::readNow(unsigned long nowMs) {
    AdcSampleResult result;
    if (UNLIKELY(!_attached || _pin < 0)) {
        return result;
    }

    // Immediate fresh reading bypasses EMA lag and deadband so on-demand queries reflect true live level
    const uint16_t raw = readHardwareSample();
    _filteredValue = raw;
    _initialized = true;
    return processReading(raw, nowMs, true);
}
