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
    <div className="space-y-4 border-t border-border-color pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-text-primary">
            تنظیم آماده بر اساس نوع سنسور
          </span>
          <span className="font-mono text-[11px] tabular-nums text-text-muted" dir="ltr">
            {adcResolution}-bit · 0..{maxVal}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ANALOG_INPUT_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onApplyPreset(preset)}
                className={`flex min-h-11 cursor-pointer items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
                  isSelected
                    ? "border-accent3 bg-accent3-transparent text-text-primary"
                    : "border-border-color bg-bg-main text-text-secondary hover:border-text-muted/60 hover:text-text-primary"
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="block text-xs font-semibold text-text-primary">
                    {preset.label}
                  </span>
                  <span className="block text-[11px] leading-4 text-text-muted">
                    {preset.description}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? "border-accent3 bg-accent3 text-accent3-foreground"
                      : "border-border-color text-transparent"
                  }`}
                >
                  <Check className="size-2.5" strokeWidth={2.5} />
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
          className="flex min-h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-border-color bg-bg-main px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-text-muted/60 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
        >
          <span className="flex items-center gap-2">
            <Settings2 strokeWidth={1.75} className="size-4 text-accent3" aria-hidden="true" />
            <span>تنظیمات تخصصی سنسور (دقت، نمونه‌برداری و آستانه‌ها)</span>
          </span>
          <ChevronDown
            strokeWidth={1.75}
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 ${showAdvancedAdc || hasInvalidThresholds ? "rotate-180" : ""}`}
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
              <div className="space-y-4 pt-3.5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="adc-resolution-select">دقت خواندن (Resolution)</Label>
                    <Select
                      id="adc-resolution-select"
                      aria-label="دقت ADC"
                      value={adcResolution}
                      onChange={(e) => onResolutionChange(Number.parseInt(e.target.value, 10))}
                      className="font-sans text-xs"
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

                  <div className="space-y-1.5">
                    <Label htmlFor="adc-interval-input">فاصله نمونه‌برداری (میلی‌ثانیه)</Label>
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
                      className="font-mono text-xs tabular-nums text-start"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="adc-delta-input">حساسیت تغییر (Delta)</Label>
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
                      className="font-mono text-xs tabular-nums text-start"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="adc-high-threshold-input">آستانه بالا (ATH)</Label>
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
                      className="font-mono text-xs tabular-nums text-start"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="adc-low-threshold-input">آستانه پایین (ATL)</Label>
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
                      className="font-mono text-xs tabular-nums text-start disabled:opacity-45"
                      dir="ltr"
                    />
                  </div>
                </div>

                {hasInvalidThresholds ? (
                  <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>آستانه پایین (ATL) باید کوچک‌تر یا مساوی آستانه بالا (ATH) باشد.</span>
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-text-muted">
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
