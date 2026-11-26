import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { Check, Info } from "@/components/ui/hugeicons-groups/controls";
import { ChevronDown, Settings2 } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ANALOG_INPUT_PRESETS,
  type AnalogInputPreset,
  getAdcMaxValue,
  MAX_ADC_SAMPLE_INTERVAL_MS,
  MIN_ADC_DELTA_THRESHOLD,
  MIN_ADC_SAMPLE_INTERVAL_MS,
} from "@/features/iot/utils/analogInput";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";

interface AnalogInputSettingsPanelProps {
  adcResolution: number;
  onResolutionChange: (resolution: number) => void;
  adcSampleIntervalMs: number;
  setAdcSampleIntervalMs: (val: number) => void;
  adcDeltaThreshold: number;
  setAdcDeltaThreshold: (val: number) => void;
  adcHighThreshold: number;
  setAdcHighThreshold: (val: number) => void;
  adcLowThreshold: number;
  setAdcLowThreshold: (val: number) => void;
  onApplyPreset: (preset: AnalogInputPreset) => void;
  animationsEnabled?: boolean;
}

/**
 * ADC1 hardware configuration section inside AddSegmentForm Step 2.
 * Surfaces quick sensor presets upfront while keeping low-level ADC parameters
 * inside a collapsible disclosure to avoid overwhelming non-technical users.
 */
export default function AnalogInputSettingsPanel({
  adcResolution,
  onResolutionChange,
  adcSampleIntervalMs,
  setAdcSampleIntervalMs,
  adcDeltaThreshold,
  setAdcDeltaThreshold,
  adcHighThreshold,
  setAdcHighThreshold,
  adcLowThreshold,
  setAdcLowThreshold,
  onApplyPreset,
  animationsEnabled = true,
}: AnalogInputSettingsPanelProps) {
  const [showAdvancedAdc, setShowAdvancedAdc] = useState(false);
  const maxVal = getAdcMaxValue(adcResolution);
  const hasInvalidThresholds = adcHighThreshold > 0 && adcLowThreshold > adcHighThreshold;

  const activePresetId =
    ANALOG_INPUT_PRESETS.find(
      (p) =>
        p.config.adcResolution === adcResolution &&
        p.config.adcSampleIntervalMs === adcSampleIntervalMs &&
        p.config.adcDeltaThreshold === adcDeltaThreshold &&
        p.config.adcHighThreshold === adcHighThreshold &&
        p.config.adcLowThreshold === adcLowThreshold,
    )?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-text-primary">پروفایل آماده سنسور</span>
          <span
            className="font-mono text-xs font-medium tabular-nums text-text-secondary"
            dir="ltr"
          >
            {adcResolution}-bit · 0..{maxVal}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ANALOG_INPUT_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onApplyPreset(preset)}
                className={`flex min-h-16 cursor-pointer items-start justify-between gap-2.5 rounded-xl border p-3.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
                  isSelected
                    ? "border-accent3 bg-accent3/10 ring-1 ring-accent3/25"
                    : "border-border-color bg-bg-main hover:border-text-muted/50 hover:bg-card-hover-bg"
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <span className="block text-sm font-bold text-text-primary">{preset.label}</span>
                  <span className="block text-xs leading-5 text-text-secondary">
                    {preset.description}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? "border-accent3 bg-accent3 text-accent3-foreground"
                      : "border-border-color text-transparent"
                  }`}
                >
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showAdvancedAdc || hasInvalidThresholds}
          onClick={() => setShowAdvancedAdc((prev) => !prev)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-border-color bg-bg-main px-3.5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
        >
          <span className="flex items-center gap-2">
            <Settings2 strokeWidth={1.75} className="size-4 text-accent3" aria-hidden="true" />
            <span>تنظیمات ADC و آستانه‌ها</span>
          </span>
          <ChevronDown
            strokeWidth={1.75}
            aria-hidden="true"
            className={`size-4 text-text-secondary transition-transform duration-200 ${showAdvancedAdc || hasInvalidThresholds ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {(showAdvancedAdc || hasInvalidThresholds) && (
            <m.div
              key="adc-advanced-panel"
              initial={animationsEnabled ? { height: 0, opacity: 0 } : false}
              animate={{ height: "auto", opacity: 1 }}
              exit={
                animationsEnabled
                  ? { height: 0, opacity: 0 }
                  : { opacity: 0, transition: { duration: 0 } }
              }
              transition={
                animationsEnabled
                  ? {
                      height: { duration: 0.22, ease: TRANSITION_ENTER_QUICK.ease },
                      opacity: { duration: 0.16, ease: TRANSITION_EXIT_QUICK.ease },
                    }
                  : { duration: 0 }
              }
              className="overflow-hidden"
              style={{ contain: "layout style", backfaceVisibility: "hidden" }}
            >
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="adc-resolution-select"
                      className="text-sm font-bold text-text-primary"
                    >
                      وضوح خواندن ADC (بیت)
                    </Label>
                    <Select
                      id="adc-resolution-select"
                      aria-label="دقت ADC"
                      value={adcResolution}
                      onChange={(e) => onResolutionChange(Number.parseInt(e.target.value, 10))}
                      className="h-11 font-sans text-base sm:text-sm"
                    >
                      <option value={12} className="bg-card-bg-solid">
                        ۱۲ بیت (۰ تا ۴۰۹۵ — پیش‌فرض)
                      </option>
                      <option value={11} className="bg-card-bg-solid">
                        ۱۱ بیت (۰ تا ۲۰۴۷)
                      </option>
                      <option value={10} className="bg-card-bg-solid">
                        ۱۰ بیت (۰ تا ۱۰۲۳)
                      </option>
                      <option value={9} className="bg-card-bg-solid">
                        ۹ بیت (۰ تا ۵۱۱)
                      </option>
                      <option value={8} className="bg-card-bg-solid">
                        ۸ بیت (۰ تا ۲۵۵)
                      </option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="adc-interval-input"
                      className="text-sm font-bold text-text-primary"
                    >
                      فاصله نمونه‌برداری (ms)
                    </Label>
                    <Input
                      id="adc-interval-input"
                      aria-label="بازه نمونه‌برداری بر حسب میلی‌ثانیه"
                      type="number"
                      min={MIN_ADC_SAMPLE_INTERVAL_MS}
                      max={MAX_ADC_SAMPLE_INTERVAL_MS}
                      step={50}
                      value={adcSampleIntervalMs}
                      onChange={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        if (!Number.isNaN(parsed)) setAdcSampleIntervalMs(parsed);
                      }}
                      className="h-11 font-mono text-base tabular-nums text-start sm:text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label
                      htmlFor="adc-delta-input"
                      className="text-sm font-bold text-text-primary"
                    >
                      حداقل تغییر برای ارسال مقدار
                    </Label>
                    <Input
                      id="adc-delta-input"
                      aria-label="حداقل تغییر برای ارسال مقدار جدید"
                      type="number"
                      min={MIN_ADC_DELTA_THRESHOLD}
                      max={maxVal}
                      value={adcDeltaThreshold}
                      onChange={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        if (!Number.isNaN(parsed)) setAdcDeltaThreshold(parsed);
                      }}
                      className="h-11 font-mono text-base tabular-nums text-start sm:text-sm"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="adc-high-threshold-input"
                      className="text-sm font-bold text-text-primary"
                    >
                      آستانه فعال‌سازی (ATH)
                    </Label>
                    <Input
                      id="adc-high-threshold-input"
                      aria-label="آستانه بالای تریگر"
                      type="number"
                      min={0}
                      max={maxVal}
                      value={adcHighThreshold}
                      onChange={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        const nextHigh = Number.isNaN(parsed)
                          ? 0
                          : Math.min(maxVal, Math.max(0, parsed));
                        setAdcHighThreshold(nextHigh);
                        if (nextHigh === 0) {
                          setAdcLowThreshold(0);
                        } else if (adcLowThreshold > nextHigh) {
                          setAdcLowThreshold(nextHigh);
                        }
                      }}
                      className="h-11 font-mono text-base tabular-nums text-start sm:text-sm"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="adc-low-threshold-input"
                      className="text-sm font-bold text-text-primary"
                    >
                      آستانه غیرفعال‌سازی (ATL)
                    </Label>
                    <Input
                      id="adc-low-threshold-input"
                      aria-label="آستانه پایین تریگر"
                      type="number"
                      min={0}
                      max={adcHighThreshold}
                      disabled={adcHighThreshold === 0}
                      value={adcHighThreshold === 0 ? 0 : adcLowThreshold}
                      onChange={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        setAdcLowThreshold(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                      }}
                      className="h-11 font-mono text-base tabular-nums text-start disabled:opacity-45 sm:text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>

                <p className="text-xs leading-5 text-text-secondary">فاصله نمونه‌برداری زمان بین دو خواندن ADC را تعیین می‌کند. مقدار Delta حداقل تغییر لازم برای ارسال مقدار جدید است؛ ATH وضعیت را فعال و ATL آن را غیرفعال می‌کند.</p>
                {hasInvalidThresholds ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 text-xs leading-6 text-destructive sm:text-[13px]"
                  >
                    <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
                    <span>آستانه پایین (ATL) باید کوچک‌تر یا مساوی آستانه بالا (ATH) باشد.</span>
                  </p>
                ) : (
                  <p className="text-xs leading-6 text-text-secondary">
                    {adcHighThreshold === 0
                      ? "با مقدار ۰ برای ATH فقط عدد سنسور نمایش داده می‌شود. برای اجرای شرط، آستانه بالا و پایین را تنظیم کنید."
                      : `تریگر هیسترزیس فعال است: بالای ${adcHighThreshold} وضعیت فعال و پایین ${adcLowThreshold} وضعیت غیرفعال می‌شود.`}
                  </p>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
