import {
  isLocalGpioPin,
  isValidManagedPin,
  isVirtualPin,
  LOCAL_GPIO_MAX,
  LOCAL_GPIO_MIN,
  VIRTUAL_PIN_MAX,
  VIRTUAL_PIN_MIN,
} from "./auxNodeUtils";

export {
  isLocalGpioPin,
  isValidManagedPin,
  isVirtualPin,
  LOCAL_GPIO_MAX,
  LOCAL_GPIO_MIN,
  VIRTUAL_PIN_MAX,
  VIRTUAL_PIN_MIN,
};

export interface PinValidationResult {
  isValid: boolean;
  message: string;
  isWarning?: boolean;
}

const FLAG_FLASH_RESERVED = 1;
const FLAG_INPUT_ONLY = 2;
const FLAG_BOOT_UART = 4;
const FLAG_ADC1 = 8;

// Bit-packed lookup table for GPIO 0..39 capabilities
const PIN_FLAGS = (() => {
  const table = new Uint8Array(40);

  table[0] = FLAG_BOOT_UART;
  table[1] = FLAG_BOOT_UART;
  table[3] = FLAG_BOOT_UART;

  for (let p = 6; p <= 11; p++) {
    table[p] = FLAG_FLASH_RESERVED;
  }

  table[32] = FLAG_ADC1;
  table[33] = FLAG_ADC1;
  table[34] = FLAG_INPUT_ONLY | FLAG_ADC1;
  table[35] = FLAG_INPUT_ONLY | FLAG_ADC1;
  table[36] = FLAG_INPUT_ONLY | FLAG_ADC1;
  table[39] = FLAG_INPUT_ONLY | FLAG_ADC1;

  return table;
})();

// Pre-allocated monomorphic validation results (identical V8 hidden class: { isValid, message, isWarning })
const RESULT_VALID: PinValidationResult = {
  isValid: true,
  message: "",
  isWarning: undefined,
};

const RESULT_OUT_OF_RANGE: PinValidationResult = {
  isValid: false,
  message: "شماره پایه نامعتبر است (باید بین ۰ تا ۳۹ باشد).",
  isWarning: undefined,
};

const RESULT_FLASH_RESERVED: PinValidationResult = {
  isValid: false,
  message:
    "این پایه‌ها برای حافظه فلش داخلی رزرو شده‌اند و استفاده از آن‌ها باعث اختلال دستگاه می‌شود.",
  isWarning: undefined,
};

const RESULT_INPUT_ONLY_ERROR: PinValidationResult = {
  isValid: false,
  message: "پایه‌های ۳۴، ۳۵، ۳۶ و ۳۹ فقط ورودی هستند و نمی‌توانند خروجی باشند.",
  isWarning: undefined,
};

const RESULT_INPUT_ONLY_WARNING: PinValidationResult = {
  isValid: true,
  message: "توجه: این پایه مقاومت Pull-Up داخلی ندارد. باید مقاومت خارجی (حداقل 10k) متصل کنید.",
  isWarning: true,
};

const RESULT_PWM_BOOT_UART_WARNING: PinValidationResult = {
  isValid: true,
  message:
    "توجه: پایه‌های ۰، ۱ و ۳ مربوط به Boot/UART هستند؛ برای خروجی PWM استفاده از پایه‌های پیشنهادی ایمن‌تر است.",
  isWarning: true,
};

const RESULT_ADC1_ONLY_ERROR: PinValidationResult = {
  isValid: false,
  message:
    "برای ورودی آنالوگ (ADC) فقط پایه‌های ADC1 یعنی ۳۲، ۳۳، ۳۴، ۳۵، ۳۶ و ۳۹ مجاز هستند (پایه‌های ADC2 با WiFi تداخل دارند).",
  isWarning: undefined,
};

function parsePinIndex(pinStr: string): number {
  const len = pinStr.length;

  if (len === 1) {
    const d0 = pinStr.charCodeAt(0) - 48;

    return d0 >= 0 && d0 <= 9 ? d0 : -1;
  }

  if (len === 2) {
    const d0 = pinStr.charCodeAt(0) - 48;
    const d1 = pinStr.charCodeAt(1) - 48;

    if (d0 >= 1 && d0 <= 3 && d1 >= 0 && d1 <= 9) {
      return d0 * 10 + d1;
    }
  }

  return -1;
}

export const validateEsp32Pin = (pinStr: string, type: string): PinValidationResult => {
  const pin = parsePinIndex(pinStr);

  if (pin < 0) {
    return RESULT_OUT_OF_RANGE;
  }

  const flags = PIN_FLAGS[pin];

  if ((flags & FLAG_FLASH_RESERVED) !== 0) {
    return RESULT_FLASH_RESERVED;
  }

  if (type === "analog_input") {
    return (flags & FLAG_ADC1) !== 0 ? RESULT_VALID : RESULT_ADC1_ONLY_ERROR;
  }

  if ((flags & FLAG_INPUT_ONLY) !== 0) {
    return type === "input" ? RESULT_INPUT_ONLY_WARNING : RESULT_INPUT_ONLY_ERROR;
  }

  if ((flags & FLAG_BOOT_UART) !== 0 && (type === "analog_output" || type === "pwm_output")) {
    return RESULT_PWM_BOOT_UART_WARNING;
  }

  return RESULT_VALID;
};

/**
 * Validates any managed pin in the unified space (`0..39` local ESP32 GPIO or `40..127` virtual pin).
 * Local pins enforce full ESP32 hardware rules; virtual pins (`40..127`) pass directly.
 */
export const validateManagedPin = (pinStr: string, type: string): PinValidationResult => {
  const trimmed = pinStr.trim();
  const numeric = trimmed !== "" ? Number(trimmed) : Number.NaN;

  if (isVirtualPin(numeric)) {
    return RESULT_VALID;
  }

  return validateEsp32Pin(trimmed, type);
};
