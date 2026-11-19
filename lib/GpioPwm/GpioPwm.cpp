#include "GpioPwm.h"

#if defined(ESP32) && __has_include(<esp_arduino_version.h>)
#include <esp_arduino_version.h>
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

uint16_t GpioPwm::_channelMask = 0;

GpioPwm::GpioPwm()
    : _frequency(DEFAULT_FREQUENCY),
      _value(0),
      _lastNonZeroValue(static_cast<uint16_t>((1UL << DEFAULT_RESOLUTION) - 1UL)),
      _pin(-1),
      _channel(-1),
      _resolution(DEFAULT_RESOLUTION),
      _activeHigh(true),
      _attached(false) {}

GpioPwm::GpioPwm(int8_t pin, uint8_t resolution, uint16_t frequency, bool activeHigh)
    : _frequency(normalizeFrequency(frequency)),
      _value(0),
      _lastNonZeroValue(0),
      _pin(pin),
      _channel(-1),
      _resolution(normalizeResolution(resolution)),
      _activeHigh(activeHigh),
      _attached(false) {
    _lastNonZeroValue = getMaxDuty();
}

void GpioPwm::configure(int8_t pin, uint8_t resolution, uint16_t frequency, bool activeHigh) {
    if (_attached) {
        end();
    }
    _pin = pin;
    _resolution = normalizeResolution(resolution);
    _frequency = normalizeFrequency(frequency);
    _activeHigh = activeHigh;
    _value = 0;
    _lastNonZeroValue = getMaxDuty();
}

uint16_t GpioPwm::getAllocatedChannelMask() {
    return _channelMask;
}

int8_t GpioPwm::allocateChannel() {
    const uint16_t freeMask = static_cast<uint16_t>(~_channelMask);
    if (UNLIKELY(freeMask == 0)) {
        return -1;
    }
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

    _value = 0;
    if (_lastNonZeroValue == 0 || _lastNonZeroValue > getMaxDuty()) {
        _lastNonZeroValue = getMaxDuty();
    }

#if GPIO_PWM_HAS_ESP32_LEDC
#if GPIO_PWM_USE_LEDC_V3
    if (UNLIKELY(!ledcAttach(_pin, _frequency, _resolution))) {
        return false;
    }
    _channel = -1;
#else
    const int8_t ch = allocateChannel();
    if (UNLIKELY(ch < 0)) {
        return false;
    }
    _channel = ch;
    const double actualFreq = ledcSetup(_channel, _frequency, _resolution);
    if (UNLIKELY(actualFreq <= 0.0)) {
        releaseChannel(_channel);
        _channel = -1;
        return false;
    }
    ledcAttachPin(_pin, _channel);
#endif
#else
    pinMode(_pin, OUTPUT);
    _channel = -1;
#endif

    _attached = true;
    updateHardware();
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
    ledcDetach(_pin);
#else
    if (_channel >= 0) {
        ledcDetachPin(_pin);
        releaseChannel(_channel);
        _channel = -1;
    }
#endif
#else
    if (_pin >= 0) {
        digitalWrite(_pin, _activeHigh ? LOW : HIGH);
    }
#endif

    _attached = false;
}

HOT_PATH void GpioPwm::setValue(uint16_t value) {
    const uint16_t clamped = clampValue(static_cast<int32_t>(value));
    _value = clamped;
    if (clamped > 0) {
        _lastNonZeroValue = clamped;
    }
    updateHardware();
}

HOT_PATH void GpioPwm::setState(bool on) {
    if (on) {
        const uint16_t restored = (_lastNonZeroValue > 0 && _lastNonZeroValue <= getMaxDuty())
            ? _lastNonZeroValue
            : getMaxDuty();
        _value = restored;
    } else {
        _value = 0;
    }
    updateHardware();
}

HOT_PATH void GpioPwm::updateHardware() {
    if (UNLIKELY(!_attached || _pin < 0)) {
        return;
    }

    const uint16_t maxDuty = getMaxDuty();
    const uint16_t hwDuty = _activeHigh ? _value : static_cast<uint16_t>(maxDuty - _value);

#if GPIO_PWM_HAS_ESP32_LEDC
#if GPIO_PWM_USE_LEDC_V3
    ledcWrite(_pin, hwDuty);
#else
    if (LIKELY(_channel >= 0)) {
        ledcWrite(_channel, hwDuty);
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
