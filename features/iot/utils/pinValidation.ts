export interface PinValidationResult {
  isValid: boolean;
  message: string;
  isWarning?: boolean;
}

const INPUT_ONLY_PINS = new Set([34, 35, 36, 39]);

export const validateEsp32Pin = (pinStr: string, type: string): PinValidationResult => {
  const pin = Number(pinStr);

  if (!Number.isInteger(pin) || pin < 0 || pin > 39) {
    return { isValid: false, message: "شماره پایه نامعتبر است (باید بین ۰ تا ۳۹ باشد)." };
  }

  // Flash pins (strictly forbidden: GPIO 6 through 11)
  if (pin >= 6 && pin <= 11) {
    return {
      isValid: false,
      message:
        "این پایه‌ها برای حافظه فلش داخلی رزرو شده‌اند و استفاده از آن‌ها باعث اختلال دستگاه می‌شود.",
    };
  }

  // Input-only pins (no internal pull-up/pull-down, no output capability)
  if (INPUT_ONLY_PINS.has(pin)) {
    if (type !== "input") {
      return {
        isValid: false,
        message: "پایه‌های ۳۴، ۳۵، ۳۶ و ۳۹ فقط ورودی هستند و نمی‌توانند خروجی باشند.",
      };
    }
    return {
      isValid: true,
      message:
        "توجه: این پایه مقاومت Pull-Up داخلی ندارد. باید مقاومت خارجی (حداقل 10k) متصل کنید.",
      isWarning: true,
    };
  }

  return { isValid: true, message: "" };
};
