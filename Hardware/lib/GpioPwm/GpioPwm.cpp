#include "GpioPwm.h"

#if defined(ESP32) && __has_include(<esp_arduino_version.h>)
#include <esp_arduino_version.h>
#endif

#if defined(ESP32) && __has_include(<soc/ledc_struct.h>)
#include <soc/ledc_struct.h>
#define GPIO_PWM_DIRECT_REG 1
#else
#define GPIO_PWM_DIRECT_REG 0
#endif

#if (defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)) || defined(UNIUNO_TEST_ESP32_CORE_V3)
#define GPIO_PWM_USE_LEDC_V3 1
#else
#define GPIO_PWM_USE_LEDC_V3 0
#endif

#if defined(ESP32) || defined(UNIUNO_TEST_ESP32_LEDC)
#define GPIO_PWM_HAS_ESP32_LEDC 1
#else
#define GPIO_PWM_HAS_ESP32_LEDC 0
#endif

#if defined(ESP32)
#define GPIO_PWM_IRAM IRAM_ATTR
#else
#define GPIO_PWM_IRAM
#endif

namespace {
// ESP32 LEDC conf1 constant for immediate non-fading duty latch:
// duty_scale = 0 (bits 0..9), duty_cycle = 1 (bit 10), duty_num = 1 (bit 20),
// duty_inc = 1 (bit 30), duty_start = 1 (bit 31).
static constexpr uint32_t LEDC_CONF1_START_NOW =
    (1UL << 31) | (1UL << 30) | (1UL << 20) | (1UL << 10);
static constexpr uint32_t LEDC_CONF1_DUTY_START_MASK = (1UL << 31);
static constexpr uint32_t LEDC_CONF0_SIG_OUT_EN_MASK = (1UL << 2);
static constexpr uint32_t LEDC_CONF0_LS_UPDATE_MASK  = (1UL << 4);
} // namespace

uint16_t GpioPwm::_channelMask = 0;

GpioPwm::GpioPwm()
    : _regDuty(nullptr),
      _regConf1(nullptr),
      _regConf0(nullptr),
      _conf0UpdateVal(0),
      _frequency(DEFAULT_FREQUENCY),
      _maxDuty(static_cast<uint16_t>((1UL << DEFAULT_RESOLUTION) - 1UL)),
      _value(0),
      _lastNonZeroValue(static_cast<uint16_t>((1UL << DEFAULT_RESOLUTION) - 1UL)),
      _lastHwDuty(HW_DUTY_UNSET),
      _pin(-1),
      _channel(-1),
      _resolution(DEFAULT_RESOLUTION),
      _activeHigh(true),
      _attached(false) {}

GpioPwm::GpioPwm(int8_t pin, uint8_t resolution, uint16_t frequency, bool activeHigh)
    : _regDuty(nullptr),
      _regConf1(nullptr),
      _regConf0(nullptr),
      _conf0UpdateVal(0),
      _frequency(normalizeFrequency(frequency)),
      _maxDuty(0),
      _value(0),
      _lastNonZeroValue(0),
      _lastHwDuty(HW_DUTY_UNSET),
      _pin(pin),
      _channel(-1),
      _resolution(normalizeResolution(resolution)),
      _activeHigh(activeHigh),
      _attached(false) {
    _maxDuty = static_cast<uint16_t>((1UL << _resolution) - 1UL);
    _lastNonZeroValue = _maxDuty;
}

void GpioPwm::configure(int8_t pin, uint8_t resolution, uint16_t frequency, bool activeHigh) {
    if (_attached) {
        end();
    }
    _pin = pin;
    _resolution = normalizeResolution(resolution);
    _frequency = normalizeFrequency(frequency);
    _maxDuty = static_cast<uint16_t>((1UL << _resolution) - 1UL);
    _activeHigh = activeHigh;
    _value = 0;
    _lastNonZeroValue = _maxDuty;
    _lastHwDuty = HW_DUTY_UNSET;
}

uint16_t GpioPwm::getAllocatedChannelMask() {
    return _channelMask;
}

int8_t GpioPwm::allocateChannel() {
    const uint16_t freeMask = static_cast<uint16_t>(~_channelMask);
    if (UNLIKELY(freeMask == 0)) {
        return -1;
    }
    // __builtin_ctz always selects lowest free bit first -> High-Speed channels 0..7 prioritized!
    const int8_t ch = static_cast<int8_t>(__builtin_ctz(static_cast<unsigned int>(freeMask)));
    if (UNLIKELY(ch >= MAX_LEDC_CHANNELS)) {
        return -1;
    }
    _channelMask |= static_cast<uint16_t>(1U << ch);
    return ch;
}

void GpioPwm::releaseChannel(int8_t channel) {
    if (channel >= 0 && channel < MAX_LEDC_CHANNELS) {
        _channelMask &= static_cast<uint16_t>(~(1U << channel));
    }
}

bool GpioPwm::begin() {
    if (UNLIKELY(!isValidPwmPin(_pin))) {
        return false;
    }

    if (_attached) {
        end();
    }

    _maxDuty = static_cast<uint16_t>((1UL << _resolution) - 1UL);
    _value = 0;
    _lastHwDuty = HW_DUTY_UNSET;
    if (_lastNonZeroValue == 0 || _lastNonZeroValue > _maxDuty) {
        _lastNonZeroValue = _maxDuty;
    }

    _regDuty = nullptr;
    _regConf1 = nullptr;
    _regConf0 = nullptr;
    _conf0UpdateVal = 0;

#if GPIO_PWM_HAS_ESP32_LEDC
    const int8_t ch = allocateChannel();
    if (UNLIKELY(ch < 0)) {
        return false;
    }
    _channel = ch;

#if GPIO_PWM_USE_LEDC_V3
    if (UNLIKELY(!ledcAttachChannel(
            static_cast<uint8_t>(_pin),
            static_cast<uint32_t>(_frequency),
            _resolution,
            static_cast<uint8_t>(_channel)))) {
        releaseChannel(_channel);
        _channel = -1;
        return false;
    }
    // One-time HAL prime ensures sig_out_en=1, hpoint=0, and driver shadow state are initialized.
    const uint16_t initialHwDuty = uniuno::xtensa_asm::asm_active_low_duty(0, _maxDuty, _activeHigh);
    ledcWrite(static_cast<uint8_t>(_pin), initialHwDuty);
#else
    const double actualFreq = ledcSetup(static_cast<uint8_t>(_channel), _frequency, _resolution);
    if (UNLIKELY(actualFreq <= 0.0)) {
        releaseChannel(_channel);
        _channel = -1;
        return false;
    }
    ledcAttachPin(static_cast<uint8_t>(_pin), static_cast<uint8_t>(_channel));
    const uint16_t initialHwDuty = uniuno::xtensa_asm::asm_active_low_duty(0, _maxDuty, _activeHigh);
    ledcWrite(static_cast<uint8_t>(_channel), initialHwDuty);
#endif

#if GPIO_PWM_DIRECT_REG
    // Precompute direct hardware register pointers (Space-for-Time optimization).
    // Channels 0..7 are High-Speed (group 0) -> only 2 register stores per duty update!
    // Channels 8..15 are Low-Speed (group 1) -> 3 register stores (adds conf0 ls_update).
    const uint8_t group = static_cast<uint8_t>(_channel >> 3);
    const uint8_t chInGroup = static_cast<uint8_t>(_channel & 0x07);
    auto& hwCh = LEDC.channel_group[group].channel[chInGroup];
    _regDuty = &hwCh.duty.val;
    _regConf1 = &hwCh.conf1.val;
    if (group != 0) {
        _regConf0 = &hwCh.conf0.val;
        _conf0UpdateVal = hwCh.conf0.val | LEDC_CONF0_SIG_OUT_EN_MASK | LEDC_CONF0_LS_UPDATE_MASK;
    }
#endif

    _lastHwDuty = initialHwDuty;
#else
    pinMode(_pin, OUTPUT);
    _channel = -1;
#endif

    _attached = true;
#if !GPIO_PWM_HAS_ESP32_LEDC
    updateHardware();
#endif
    return true;
}

void GpioPwm::end() {
    if (!_attached) {
        return;
    }

    _value = 0;
    updateHardware();

#if GPIO_PWM_HAS_ESP32_LEDC
#if GPIO_PWM_USE_LEDC_V3
    ledcDetach(static_cast<uint8_t>(_pin));
#else
    if (_channel >= 0) {
        ledcDetachPin(static_cast<uint8_t>(_pin));
    }
#endif
    if (_channel >= 0) {
        releaseChannel(_channel);
        _channel = -1;
    }
#else
    if (_pin >= 0) {
        digitalWrite(_pin, _activeHigh ? LOW : HIGH);
    }
#endif

    _regDuty = nullptr;
    _regConf1 = nullptr;
    _regConf0 = nullptr;
    _conf0UpdateVal = 0;
    _lastHwDuty = HW_DUTY_UNSET;
    _attached = false;
}

HOT_PATH GPIO_PWM_IRAM void GpioPwm::setValue(uint16_t value) {
    // 2-cycle branchless Xtensa MAX/MIN clamp
    const uint16_t clamped = uniuno::xtensa_asm::asm_clamp_u16(static_cast<int32_t>(value), 0, _maxDuty);
    _value = clamped;
    if (LIKELY(clamped > 0)) {
        _lastNonZeroValue = clamped;
    }
    updateHardware();
}

HOT_PATH GPIO_PWM_IRAM void GpioPwm::setState(bool on) {
    if (on) {
        const uint16_t restored = (_lastNonZeroValue > 0 && _lastNonZeroValue <= _maxDuty)
            ? _lastNonZeroValue
            : _maxDuty;
        _value = restored;
    } else {
        _value = 0;
    }
    updateHardware();
}

HOT_PATH GPIO_PWM_IRAM void GpioPwm::updateHardware() {
    if (UNLIKELY(!_attached || _pin < 0)) {
        return;
    }

    // Branchless active-high / active-low polarity transform (2 cycles, zero pipeline flush)
    const uint16_t hwDuty = uniuno::xtensa_asm::asm_active_low_duty(_value, _maxDuty, _activeHigh);

    // Hardware deduplication: skip APB peripheral bus write if duty is already latched (2 cycles)
    if (UNLIKELY(_lastHwDuty == hwDuty)) {
        return;
    }
    _lastHwDuty = hwDuty;

#if GPIO_PWM_DIRECT_REG
    if (LIKELY(_regDuty != nullptr)) {
        // Branchless ESP32 21.4 fixed-point duty with full-ON (maxDuty -> maxDuty + 1) rule (4 cycles)
        const uint32_t dutyFixed = uniuno::xtensa_asm::asm_ledc_duty_fixed(hwDuty, _maxDuty);

        // Respect ESP32 silicon erratum: wait if previous duty_start latch is still active (bounded guard)
        uint32_t guard = 256;
        while (UNLIKELY((*_regConf1 & LEDC_CONF1_DUTY_START_MASK) != 0UL) && --guard) {}

        *_regDuty = dutyFixed;
        *_regConf1 = LEDC_CONF1_START_NOW;
        if (UNLIKELY(_regConf0 != nullptr)) {
            *_regConf0 = _conf0UpdateVal;
        }
        return;
    }
#endif

#if GPIO_PWM_HAS_ESP32_LEDC
#if GPIO_PWM_USE_LEDC_V3
    ledcWrite(static_cast<uint8_t>(_pin), hwDuty);
#else
    if (LIKELY(_channel >= 0)) {
        ledcWrite(static_cast<uint8_t>(_channel), hwDuty);
    }
#endif
#else
    // Scale to 8-bit for generic Arduino fallback
    const uint8_t scaled = (_resolution > 8)
        ? static_cast<uint8_t>(hwDuty >> (_resolution - 8))
        : static_cast<uint8_t>(hwDuty);
    analogWrite(_pin, scaled);
#endif
}
