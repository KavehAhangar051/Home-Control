#include "GpioAdc.h"
#include <Timer/Optimization/TimerAsm.h>

#if defined(ESP32) || defined(UNIUNO_TEST_ESP32_ADC)
#define GPIO_ADC_HAS_ESP32_HAL 1
#else
#define GPIO_ADC_HAS_ESP32_HAL 0
#endif

#if defined(ESP32)
#define GPIO_ADC_IRAM IRAM_ATTR
#else
#define GPIO_ADC_IRAM
#endif

namespace {
// SENS.sar_meas_start1 bit layout (verified across ESP-IDF v4.4 & v5.x soc/sens_struct.h):
//   bits  0..15: meas1_data_sar (12-bit result in bits 0..11)
//   bit  16:     meas1_done_sar
//   bit  17:     meas1_start_sar
//   bit  18:     meas1_start_force
//   bits 19..30: sar1_en_pad (1 << adc1_channel)
//   bit  31:     sar1_en_pad_force
static constexpr uint32_t SAR1_DONE_MASK       = (1UL << 16);
static constexpr uint32_t SAR1_START_BIT       = (1UL << 17);
static constexpr uint32_t SAR1_START_FORCE_BIT = (1UL << 18);
static constexpr uint32_t SAR1_PAD_FORCE_BIT   = (1UL << 31);
static constexpr uint32_t SAR1_DATA_MASK       = 0x0FFFUL;
static constexpr uint32_t SAR1_TIMEOUT_CYCLES  = uniuno::asm_opt::ms_to_cycles(2);
} // namespace

GpioAdc::GpioAdc()
    : _sarStartLow(0),
      _sarStartHigh(0),
      _burstStartCycle(0),
      _lastSampleTime(0),
      _osSum(0),
      _sampleIntervalMs(DEFAULT_SAMPLE_INTERVAL_MS),
      _deltaThreshold(DEFAULT_DELTA_THRESHOLD),
      _highThreshold(0),
      _lowThreshold(0),
      _maxValue(maxValueForResolution(DEFAULT_RESOLUTION)),
      _filteredValue(0),
      _lastReportedValue(0),
      _pin(-1),
      _adc1Channel(-1),
      _resolution(DEFAULT_RESOLUTION),
      _resShift(static_cast<uint8_t>(MAX_RESOLUTION - DEFAULT_RESOLUTION)),
      _osCount(0),
      _thresholdState(false),
      _initialized(false),
      _attached(false),
      _burstActive(false),
      _awaitingTrigger(false) {}

GpioAdc::GpioAdc(
    int8_t pin,
    uint8_t resolution,
    uint16_t sampleIntervalMs,
    uint16_t deltaThreshold,
    uint16_t highThreshold,
    uint16_t lowThreshold
) : _sarStartLow(0),
    _sarStartHigh(0),
    _burstStartCycle(0),
    _lastSampleTime(0),
    _osSum(0),
    _sampleIntervalMs(normalizeSampleInterval(sampleIntervalMs)),
    _deltaThreshold(normalizeDelta(deltaThreshold, resolution)),
    _highThreshold(highThreshold),
    _lowThreshold(lowThreshold),
    _maxValue(maxValueForResolution(resolution)),
    _filteredValue(0),
    _lastReportedValue(0),
    _pin(pin),
    _adc1Channel(pinToAdc1Channel(pin)),
    _resolution(normalizeResolution(resolution)),
    _resShift(static_cast<uint8_t>(MAX_RESOLUTION - normalizeResolution(resolution))),
    _osCount(0),
    _thresholdState(false),
    _initialized(false),
    _attached(false),
    _burstActive(false),
    _awaitingTrigger(false) {
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
    _adc1Channel = pinToAdc1Channel(pin);
    _resolution = normalizeResolution(resolution);
    _maxValue = maxValueForResolution(_resolution);
    _resShift = static_cast<uint8_t>(MAX_RESOLUTION - _resolution);
    _sampleIntervalMs = normalizeSampleInterval(sampleIntervalMs);
    _deltaThreshold = normalizeDelta(deltaThreshold, _resolution);
    _highThreshold = highThreshold;
    _lowThreshold = lowThreshold;
    normalizeThresholds(_highThreshold, _lowThreshold, _resolution);
    _filteredValue = 0;
    _lastReportedValue = 0;
    _thresholdState = false;
    _initialized = false;
    _burstActive = false;
    _awaitingTrigger = false;
    _osSum = 0;
    _osCount = 0;
    _lastSampleTime = 0;
    _sarStartLow = 0;
    _sarStartHigh = 0;
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
        _maxValue = maxValueForResolution(_resolution);
        _resShift = static_cast<uint8_t>(MAX_RESOLUTION - _resolution);
    }

    _sampleIntervalMs = normalizeSampleInterval(sampleIntervalMs);
    _deltaThreshold = normalizeDelta(deltaThreshold, _resolution);
    _highThreshold = highThreshold;
    _lowThreshold = lowThreshold;
    normalizeThresholds(_highThreshold, _lowThreshold, _resolution);

    if (_initialized) {
        _thresholdState = uniuno::xtensa_asm::asm_schmitt_eval(
            _filteredValue, _highThreshold, _lowThreshold, _thresholdState);
    } else if (_highThreshold == 0) {
        _thresholdState = false;
    }
}

bool GpioAdc::begin() {
    if (UNLIKELY(!isValidAdcPin(_pin))) {
        return false;
    }

    if (_attached) {
        end();
    }

    _adc1Channel = pinToAdc1Channel(_pin);
    _maxValue = maxValueForResolution(_resolution);
    _resShift = static_cast<uint8_t>(MAX_RESOLUTION - _resolution);
    _burstActive = false;
    _awaitingTrigger = false;
    _osSum = 0;
    _osCount = 0;

    pinMode(static_cast<uint8_t>(_pin), INPUT);

#if GPIO_ADC_HAS_ESP32_HAL
    // One-time HAL initialization configures 12-bit width and ADC_11db attenuation (~0..3.3V)
    // identically on Core v2 & Core v3.
    analogReadResolution(MAX_RESOLUTION);
    analogSetPinAttenuation(static_cast<uint8_t>(_pin), ADC_11db);
#endif

#if GPIO_ADC_DIRECT_SAR1
    // Prime real ESP32 RTC pad analog mux & ADC1 clock via Arduino HAL once before direct SAR1 access
    (void)analogRead(static_cast<uint8_t>(_pin));
    if (LIKELY(_adc1Channel >= 0 && _adc1Channel < 8)) {
        // Ensure RTC SAR1 controller owns ADC1 with standard non-inverted 12-bit output
        SENS.sar_read_ctrl.sar1_dig_force = 0;
        SENS.sar_read_ctrl.sar1_data_inv = 1;
        SENS.sar_read_ctrl.sar1_sample_bit = 3; // 12-bit

        // Precompute the two single-store 32-bit trigger words (4-cycle start, zero RMW!)
        _sarStartLow = SAR1_PAD_FORCE_BIT |
                       (static_cast<uint32_t>(1U << static_cast<uint8_t>(_adc1Channel)) << 19) |
                       SAR1_START_FORCE_BIT;
        _sarStartHigh = _sarStartLow | SAR1_START_BIT;
    }
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
    _burstActive = false;
    _awaitingTrigger = false;
    _osSum = 0;
    _osCount = 0;
    _filteredValue = 0;
    _lastReportedValue = 0;
    _thresholdState = false;
    _lastSampleTime = 0;
    _sarStartLow = 0;
    _sarStartHigh = 0;
}

HOT_PATH GPIO_ADC_IRAM bool GpioAdc::triggerSar1Conversion() {
#if GPIO_ADC_DIRECT_SAR1
    if (UNLIKELY(_sarStartHigh == 0UL)) {
        return false;
    }
    // Non-blocking busy check: if SAR1 FSM is momentarily busy, yield back to loop()!
    if (UNLIKELY(SENS.sar_slave_addr1.meas_status != 0)) {
        return false;
    }
    SENS.sar_meas_start1.val = _sarStartLow;
    SENS.sar_meas_start1.val = _sarStartHigh;
    _burstStartCycle = uniuno::asm_opt::get_cpu_cycle_count();
    return true;
#else
    return true;
#endif
}

HOT_PATH GPIO_ADC_IRAM bool GpioAdc::startAsyncBurst() {
    if (UNLIKELY(!_attached || _pin < 0)) {
        return false;
    }
    _osSum = 0;
    _osCount = 0;
    _awaitingTrigger = false;
    if (!triggerSar1Conversion()) {
        _burstActive = false;
        return false;
    }
    _burstActive = true;
    return true;
}

HOT_PATH GPIO_ADC_IRAM bool GpioAdc::pollAsyncBurst(unsigned long nowMs, AdcSampleResult& outResult) {
    if (UNLIKELY(!_burstActive || !_attached || _pin < 0)) {
        return false;
    }

#if GPIO_ADC_DIRECT_SAR1
    if (UNLIKELY(_awaitingTrigger)) {
        if (triggerSar1Conversion()) {
            _awaitingTrigger = false;
            return false;
        }
        const uint32_t elapsed = uniuno::asm_opt::get_cpu_cycle_count() - _burstStartCycle;
        if (LIKELY(elapsed < SAR1_TIMEOUT_CYCLES)) {
            return false;
        }
        _burstActive = false;
        _awaitingTrigger = false;
        const uint16_t fallback = readHardwareSample();
        outResult = processReading(fallback, nowMs, false);
        return true;
    }

    const uint32_t reg = SENS.sar_meas_start1.val;
    if ((reg & SAR1_DONE_MASK) == 0UL) {
        // Still converting in silicon -> return immediately (ZERO CPU stall!) unless safety timeout trips
        const uint32_t elapsed = uniuno::asm_opt::get_cpu_cycle_count() - _burstStartCycle;
        if (LIKELY(elapsed < SAR1_TIMEOUT_CYCLES)) {
            return false;
        }
        // Rare timeout safeguard: fall back to Arduino HAL so conversion can never stall indefinitely
        _burstActive = false;
        _awaitingTrigger = false;
        const uint16_t fallback = readHardwareSample();
        outResult = processReading(fallback, nowMs, false);
        return true;
    }

    _osSum += (reg & SAR1_DATA_MASK);
    ++_osCount;

    if (_osCount < OVERSAMPLE_COUNT) {
        // Immediately fire next oversample conversion (~4 cycles) and yield back to loop()
        if (UNLIKELY(!triggerSar1Conversion())) {
            _awaitingTrigger = true;
            _burstStartCycle = uniuno::asm_opt::get_cpu_cycle_count();
        }
        return false;
    }

    _burstActive = false;
    const uint16_t avg12 = uniuno::xtensa_asm::asm_clamp_u16(
        static_cast<int32_t>((_osSum + (OVERSAMPLE_COUNT >> 1)) >> 2), 0, MAX_ADC_VALUE);
    const uint16_t scaled = static_cast<uint16_t>(avg12 >> _resShift);
    outResult = processReading(scaled, nowMs, false);
    return true;
#else
    // Deterministic native mock path
    _burstActive = false;
    const uint16_t raw = readHardwareSample();
    outResult = processReading(raw, nowMs, false);
    return true;
#endif
}

HOT_PATH GPIO_ADC_IRAM uint16_t GpioAdc::readHardwareSample() const {
    if (UNLIKELY(_pin < 0)) {
        return 0;
    }

    uint32_t sum = 0;

#if GPIO_ADC_DIRECT_SAR1
    if (LIKELY(_sarStartHigh != 0UL)) {
        bool hwOk = true;
        UNROLL_LOOP(4)
        for (uint8_t i = 0; i < OVERSAMPLE_COUNT; ++i) {
            uint32_t busyGuard = 4096;
            while (UNLIKELY(SENS.sar_slave_addr1.meas_status != 0) && --busyGuard) {}
            if (UNLIKELY(busyGuard == 0)) {
                hwOk = false;
                break;
            }
            SENS.sar_meas_start1.val = _sarStartLow;
            SENS.sar_meas_start1.val = _sarStartHigh;

            uint32_t doneGuard = 8192;
            uint32_t reg = 0;
            while (((reg = SENS.sar_meas_start1.val) & SAR1_DONE_MASK) == 0UL && --doneGuard) {}
            if (UNLIKELY(doneGuard == 0)) {
                hwOk = false;
                break;
            }
            sum += (reg & SAR1_DATA_MASK);
        }

        if (LIKELY(hwOk)) {
            const uint16_t avg12 = uniuno::xtensa_asm::asm_clamp_u16(
                static_cast<int32_t>((sum + (OVERSAMPLE_COUNT >> 1)) >> 2), 0, MAX_ADC_VALUE);
            return static_cast<uint16_t>(avg12 >> _resShift);
        }
        sum = 0; // Fallback to Arduino HAL if direct guard ever tripped
    }
#endif

    // Portable / fallback 4x oversampling via Arduino HAL
    UNROLL_LOOP(4)
    for (uint8_t i = 0; i < OVERSAMPLE_COUNT; ++i) {
        const int raw = analogRead(static_cast<uint8_t>(_pin));
        sum += uniuno::xtensa_asm::asm_clamp_u16(raw, 0, MAX_ADC_VALUE);
    }

    const uint16_t avg12 = uniuno::xtensa_asm::asm_clamp_u16(
        static_cast<int32_t>((sum + (OVERSAMPLE_COUNT >> 1)) >> 2), 0, MAX_ADC_VALUE);
    return static_cast<uint16_t>(avg12 >> _resShift);
}

HOT_PATH GPIO_ADC_IRAM AdcSampleResult GpioAdc::processReading(uint16_t rawSample, unsigned long nowMs, bool forceReport) {
    AdcSampleResult result;
    result.sampled = true;
    _lastSampleTime = nowMs;

    if (UNLIKELY(!_initialized)) {
        _filteredValue = rawSample;
        _initialized = true;
    } else {
        // Branchless Xtensa LX6 integer EMA (alpha = 0.5) with exact 0 / _maxValue rail snapping
        _filteredValue = uniuno::xtensa_asm::asm_ema50_rail_snap(_filteredValue, rawSample, _maxValue);
    }

    result.value = _filteredValue;

    // 1. Branchless Xtensa LX6 Schmitt-trigger hysteresis evaluation
    const bool nextThresholdState = uniuno::xtensa_asm::asm_schmitt_eval(
        _filteredValue, _highThreshold, _lowThreshold, _thresholdState);
    result.thresholdChanged = (nextThresholdState != _thresholdState);
    _thresholdState = nextThresholdState;
    result.thresholdState = nextThresholdState;

    // 2. Branchless 2-cycle Xtensa ABS-DIFF reporting deadband + exact rail hits + threshold flip
    const uint16_t diff = uniuno::xtensa_asm::asm_abs_diff_u16(_filteredValue, _lastReportedValue);
    const bool railTransition =
        (_filteredValue == 0 && _lastReportedValue != 0) ||
        (_filteredValue == _maxValue && _lastReportedValue != _maxValue);

    if (forceReport || result.thresholdChanged || diff >= _deltaThreshold || railTransition) {
        _lastReportedValue = _filteredValue;
        result.valueChanged = true;
    }

    return result;
}

HOT_PATH GPIO_ADC_IRAM AdcSampleResult GpioAdc::sample(unsigned long nowMs) {
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

HOT_PATH GPIO_ADC_IRAM AdcSampleResult GpioAdc::readNow(unsigned long nowMs) {
    AdcSampleResult result;
    if (UNLIKELY(!_attached || _pin < 0)) {
        return result;
    }

    // Cancel any in-flight async burst before doing an immediate fresh sample
    abortAsyncBurst();

    // Immediate fresh reading bypasses EMA lag and deadband so on-demand queries reflect true live level
    const uint16_t raw = readHardwareSample();
    _filteredValue = raw;
    _initialized = true;
    return processReading(raw, nowMs, true);
}
