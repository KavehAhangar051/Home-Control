export interface PinValidationResult {
  isValid: boolean;
  message: string;
  isWarning?: boolean;
}

const FLAG_FLASH_RESERVED = 1;
const FLAG_INPUT_ONLY = 2;

// Bit-packed lookup table for GPIO 0..39 capabilities
const PIN_FLAGS = (() => {
  const table = new Uint8Array(40);
  for (let p = 6; p <= 11; p++) {
    table[p] = FLAG_FLASH_RESERVED;
  }
  table[34] = FLAG_INPUT_ONLY;
  table[35] = FLAG_INPUT_ONLY;
  table[36] = FLAG_INPUT_ONLY;
  table[39] = FLAG_INPUT_ONLY;
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

  if ((flags & FLAG_INPUT_ONLY) !== 0) {
    return type === "input" ? RESULT_INPUT_ONLY_WARNING : RESULT_INPUT_ONLY_ERROR;
  }

  return RESULT_VALID;
};
