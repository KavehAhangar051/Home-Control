import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAnalogOutputType, RECOMMENDED_PWM_PINS } from "@/features/iot/utils/analogOutput";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";
import { toAsciiDigits } from "@/lib/persianText";

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
  const isAnalog = isAnalogOutputType(selectedType);
  const isInvalid = Boolean(validation && !validation.isValid);
  const hasWarning = Boolean(validation?.isValid && validation.isWarning);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="esp32-hardware-pin" className="w-full text-start">
          پایه سخت‌افزاری (GPIO)
        </Label>
      </div>
      <Input
        id="esp32-hardware-pin"
        type="text"
        inputMode="numeric"
        aria-invalid={isInvalid || undefined}
        aria-describedby={isInvalid || hasWarning ? "esp32-hardware-pin-feedback" : undefined}
        placeholder={isAnalog ? "مثال: 16 یا 25" : "مثال: 14"}
        value={customPin}
        onChange={(e) => setCustomPin(toAsciiDigits(e.target.value).replace(/[^0-9]/g, ""))}
        className="text-xs font-mono tabular-nums rounded-lg text-start placeholder:font-sans"
        dir="ltr"
      />

      {isInvalid && validation && (
        <p
          id="esp32-hardware-pin-feedback"
          role="alert"
          className="text-[11px] leading-relaxed text-destructive font-sans"
        >
          {validation.message}
        </p>
      )}
      {hasWarning && validation && (
        <p
          id="esp32-hardware-pin-feedback"
          role="status"
          className="rounded-lg border border-warning/40 bg-warning-soft px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 font-sans"
        >
          {validation.message}
        </p>
      )}

      {isAnalog && (
        <div className="space-y-1.5 pt-0.5">
          <span className="block text-[11px] text-text-muted font-sans">
            پایه‌های پیشنهادی PWM (انتخاب سریع):
          </span>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
            {RECOMMENDED_PWM_PINS.map((pinNum) => {
              const pinStr = String(pinNum);
              const isSelected = trimmedPin === pinStr;
              const isUsed = usedPins?.has(pinStr) ?? false;

              return (
                <button
                  key={pinNum}
                  type="button"
                  disabled={isUsed}
                  aria-pressed={isSelected}
                  onClick={() => setCustomPin(pinStr)}
                  title={isUsed ? `GPIO ${pinStr} در حال استفاده است` : `انتخاب GPIO ${pinStr}`}
                  className={`min-w-8 rounded-md border px-1.5 py-1 font-mono text-[11px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
                    isSelected
                      ? "border-accent3 bg-accent3 text-accent3-foreground font-semibold"
                      : isUsed
                        ? "border-border-color/50 bg-secondary/40 text-text-muted/45 line-through cursor-not-allowed"
                        : "border-border-color bg-secondary text-text-secondary hover:border-accent3/60 hover:text-text-primary cursor-pointer"
                  }`}
                >
                  {pinStr}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
