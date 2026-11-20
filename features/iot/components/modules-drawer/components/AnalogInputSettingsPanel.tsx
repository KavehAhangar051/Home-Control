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
}

/**
 * ADC1 hardware configuration section inside AddSegmentForm.
 * Includes quick sensor presets, bit resolution (8..12), sampling interval,
 * delta noise filter, and Schmitt-Trigger high/low thresholds.
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
}: AnalogInputSettingsPanelProps) {
  const maxVal = getAdcMaxValue(adcResolution);
  const hasInvalidThresholds = adcHighThreshold > 0 && adcLowThreshold > adcHighThreshold;

  return (
    <div className="space-y-3.5 rounded-xl border border-border-color bg-secondary/40 p-3">
      <div className="flex items-center justify-between gap-2 border-b border-border-color/70 pb-2">
        <span className="text-xs font-medium text-text-primary">تنظیمات ورودی آنالوگ (ADC1)</span>
        <span className="font-mono text-[11px] tabular-nums text-text-muted" dir="ltr">
          0..{maxVal} (~3.3V)
        </span>
      </div>

      {/* Quick Sensor Presets */}
      <div className="space-y-1.5">
        <span className="block text-[11px] text-text-muted">تنظیم آماده بر اساس نوع سنسور:</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {ANALOG_INPUT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className="flex flex-col items-start rounded-lg border border-border-color bg-card-bg-solid px-2.5 py-1.5 text-right transition-colors hover:border-accent3/60 hover:bg-secondary cursor-pointer"
            >
              <span className="text-[11px] font-medium text-text-primary">{preset.label}</span>
              <span className="text-[10px] text-text-muted">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Resolution & Sample Interval */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="adc-resolution-select" className="block text-xs">
            دقت ADC (Resolution)
          </Label>
          <Select
            id="adc-resolution-select"
            aria-label="دقت ADC"
            value={adcResolution}
            onChange={(e) => onResolutionChange(Number.parseInt(e.target.value, 10))}
            className="text-xs rounded-lg font-sans"
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
          <Label htmlFor="adc-interval-input" className="block text-xs">
            بازه نمونه‌برداری (ms)
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
            className="text-xs font-mono tabular-nums rounded-lg text-right"
            dir="ltr"
          />
        </div>
      </div>

      {/* Delta & Schmitt-Trigger Thresholds */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="adc-delta-input" className="block text-xs">
            حساسیت تغییر (Delta)
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
            className="text-xs font-mono tabular-nums rounded-lg text-right"
            dir="ltr"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adc-high-threshold-input" className="block text-xs">
            آستانه بالا (ATH)
          </Label>
          <Input
            id="adc-high-threshold-input"
            aria-label="آستانه بالای Schmitt-Trigger"
            type="number"
            min={0}
            max={maxVal}
            value={adcHighThreshold}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              const nextHigh = Number.isNaN(parsed) ? 0 : Math.min(maxVal, Math.max(0, parsed));
              setAdcHighThreshold(nextHigh);
              if (nextHigh === 0) {
                setAdcLowThreshold(0);
              } else if (adcLowThreshold > nextHigh) {
                setAdcLowThreshold(nextHigh);
              }
            }}
            className="text-xs font-mono tabular-nums rounded-lg text-right"
            dir="ltr"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adc-low-threshold-input" className="block text-xs">
            آستانه پایین (ATL)
          </Label>
          <Input
            id="adc-low-threshold-input"
            aria-label="آستانه پایین Schmitt-Trigger"
            type="number"
            min={0}
            max={adcHighThreshold}
            disabled={adcHighThreshold === 0}
            value={adcHighThreshold === 0 ? 0 : adcLowThreshold}
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              setAdcLowThreshold(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
            }}
            className="text-xs font-mono tabular-nums rounded-lg text-right disabled:opacity-45"
            dir="ltr"
          />
        </div>
      </div>

      {hasInvalidThresholds ? (
        <p role="alert" className="text-[11px] text-destructive leading-relaxed">
          آستانه پایین (ATL) باید کوچک‌تر یا مساوی آستانه بالا (ATH) باشد.
        </p>
      ) : (
        <p className="text-[11px] text-text-muted leading-relaxed">
          {adcHighThreshold === 0
            ? "مقدار ۰ برای ATH یعنی فقط نمایش عددی سنسور (بدون اجرای قوانین). برای استفاده در بخش قوانین، آستانه بالا و پایین را تنظیم کنید."
            : `تریگر هیسترزیس فعال است: بالای ${adcHighThreshold} حالت HIGH و پایین ${adcLowThreshold} حالت LOW فعال می‌شود.`}
        </p>
      )}
    </div>
  );
}
