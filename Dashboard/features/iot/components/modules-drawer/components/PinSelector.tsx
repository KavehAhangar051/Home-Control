import { Info } from "@/components/ui/hugeicons-groups/controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADC1_ALLOWED_PINS,
  ADC_INPUT_ONLY_PINS,
  isAnalogInputType,
} from "@/features/iot/utils/analogInput";
import { isAnalogOutputType, RECOMMENDED_PWM_PINS } from "@/features/iot/utils/analogOutput";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";
import { toAsciiDigits } from "@/lib/persianText";

const RECOMMENDED_DIGITAL_OUTPUT_PINS = [
  4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33,
] as const;
const RECOMMENDED_DIGITAL_INPUT_PINS = [
  34, 35, 36, 39, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33,
] as const;

interface PinSelectorProps {
  customPin: string;
  setCustomPin: (val: string) => void;
  selectedType?: string;
  usedPins?: ReadonlySet<string>;
}

export default function PinSelector({
  customPin,
  setCustomPin,
  selectedType = "gpio_toggle",
  usedPins,
}: PinSelectorProps) {
  const trimmedPin = customPin.trim();
  const validation = trimmedPin ? validateEsp32Pin(trimmedPin, selectedType) : null;
  const isAnalogOutput = isAnalogOutputType(selectedType);
  const isAnalogInput = isAnalogInputType(selectedType);
  const isDigitalInput = selectedType === "input";
  const isInvalid = Boolean(validation && !validation.isValid);
  const hasWarning = Boolean(validation?.isValid && validation.isWarning);

  const suggestedPins: readonly number[] = isAnalogInput
    ? ADC1_ALLOWED_PINS
    : isAnalogOutput
      ? RECOMMENDED_PWM_PINS
      : isDigitalInput
        ? RECOMMENDED_DIGITAL_INPUT_PINS
        : RECOMMENDED_DIGITAL_OUTPUT_PINS;

  const suggestionTitle = isAnalogInput
    ? "پایه‌های مجاز ADC1 (بدون تداخل با WiFi)"
    : isAnalogOutput
      ? "پایه‌های پیشنهادی دیمر (PWM)"
      : isDigitalInput
        ? "پایه‌های پیشنهادی ورودی دیجیتال"
        : "پایه‌های ایمن و پیشنهادی ESP32";

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="esp32-hardware-pin"
            className="text-start text-sm font-bold text-text-primary"
          >
            شماره پایه سخت‌افزاری (GPIO)
          </Label>
          {trimmedPin && validation?.isValid && (
            <span className="font-mono text-xs font-semibold tabular-nums text-accent3" dir="ltr">
              GPIO {trimmedPin}
            </span>
          )}
        </div>

        <Input
          id="esp32-hardware-pin"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={isInvalid || undefined}
          aria-describedby={isInvalid || hasWarning ? "esp32-hardware-pin-feedback" : undefined}
          placeholder={
            isAnalogInput
              ? "مثال: 34 یا 32"
              : isAnalogOutput
                ? "مثال: 16 یا 25"
                : isDigitalInput
                  ? "مثال: 34 یا 18"
                  : "مثال: 14 یا 23"
          }
          value={customPin}
          onChange={(e) => setCustomPin(toAsciiDigits(e.target.value).replace(/[^0-9]/g, ""))}
          className="h-11 font-mono text-base tabular-nums text-start placeholder:font-sans placeholder:text-sm sm:text-sm sm:placeholder:text-xs"
          dir="ltr"
        />

        {isInvalid && validation && (
          <p
            id="esp32-hardware-pin-feedback"
            role="alert"
            className="flex items-start gap-2 text-xs leading-6 text-destructive sm:text-[13px]"
          >
            <Info className="mt-1 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{validation.message}</span>
          </p>
        )}

        {hasWarning && validation && (
          <p
            id="esp32-hardware-pin-feedback"
            role="status"
            className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-xs leading-6 text-amber-800 dark:text-amber-300 sm:text-[13px]"
          >
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>{validation.message}</span>
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        <span className="block text-xs font-semibold text-text-secondary sm:text-[13px]">
          {suggestionTitle}
        </span>
        <div className="flex flex-wrap gap-2" dir="ltr">
          {suggestedPins.map((pinNum) => {
            const pinStr = String(pinNum);
            const isSelected = trimmedPin === pinStr;
            const isUsed = usedPins?.has(pinStr) ?? false;
            const isInputOnly = ADC_INPUT_ONLY_PINS.has(pinNum);

            return (
              <button
                key={pinNum}
                type="button"
                disabled={isUsed}
                aria-pressed={isSelected}
                onClick={() => setCustomPin(pinStr)}
                title={
                  isUsed
                    ? `GPIO ${pinStr} در حال استفاده است`
                    : isInputOnly
                      ? `GPIO ${pinStr} (فقط ورودی — ایده‌آل برای سنسور)`
                      : `انتخاب GPIO ${pinStr}`
                }
                className={`min-h-10 min-w-11 rounded-xl border px-3 font-mono text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
                  isSelected
                    ? "border-accent3 bg-accent3 font-bold text-accent3-foreground"
                    : isUsed
                      ? "cursor-not-allowed border-border-color/60 bg-bg-main text-text-muted/45 line-through"
                      : "cursor-pointer border-border-color bg-bg-main text-text-primary hover:border-accent3/60 hover:bg-card-hover-bg"
                }`}
              >
                {pinStr}
              </button>
            );
          })}
        </div>

        {isAnalogInput && (
          <p className="text-xs leading-6 text-text-secondary">
            GPIOهای ۳۴، ۳۵، ۳۶ و ۳۹ فقط ورودی‌اند و مقاومت Pull-up/Pull-down داخلی ندارند. ولتاژ
            سنسور متصل‌شده باید بین ۰ تا ۳.۳ ولت باشد.
          </p>
        )}
      </div>
    </div>
  );
}
