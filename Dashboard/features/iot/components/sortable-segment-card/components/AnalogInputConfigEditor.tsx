"use client";

import { useState } from "react";
import { useOptionalDashboard } from "@/features/dashboard/context/DashboardContext";
import {
  ANALOG_INPUT_PRESETS,
  type AnalogInputPreset,
  clampAdcDeltaThreshold,
  clampAdcResolution,
  clampAdcSampleInterval,
  getAdcMaxValue,
  MAX_ADC_RESOLUTION,
  MAX_ADC_SAMPLE_INTERVAL_MS,
  MIN_ADC_DELTA_THRESHOLD,
  MIN_ADC_RESOLUTION,
  MIN_ADC_SAMPLE_INTERVAL_MS,
  normalizeAnalogInputConfig,
} from "@/features/iot/utils/analogInput";
import type { SegmentData } from "../core/types";

interface AnalogInputConfigEditorProps {
  segment: SegmentData;
  onApplied?: () => void;
}

const RESOLUTION_OPTIONS = [8, 9, 10, 11, 12] as const;

/**
 * Compact live ADC1 parameter editor inside SegmentSettingsMenu.
 * Dispatches Opcode `0x0C` / Local WS `config_analog_input` without deleting the segment or losing rules.
 */
export default function AnalogInputConfigEditor({
  segment,
  onApplied,
}: AnalogInputConfigEditorProps) {
  const dashboard = useOptionalDashboard();
  const initial = normalizeAnalogInputConfig({
    adcResolution: segment.adcResolution,
    adcSampleIntervalMs: segment.adcSampleIntervalMs,
    adcDeltaThreshold: segment.adcDeltaThreshold,
    adcHighThreshold: segment.adcHighThreshold,
    adcLowThreshold: segment.adcLowThreshold,
  });

  const [resolution, setResolution] = useState(initial.adcResolution);
  const [sampleIntervalMs, setSampleIntervalMs] = useState(initial.adcSampleIntervalMs);
  const [deltaThreshold, setDeltaThreshold] = useState(initial.adcDeltaThreshold);
  const [highThreshold, setHighThreshold] = useState(initial.adcHighThreshold);
  const [lowThreshold, setLowThreshold] = useState(initial.adcLowThreshold);

  const maxVal = getAdcMaxValue(resolution);
  const hasInvalidThresholds = highThreshold > 0 && lowThreshold > highThreshold;

  const handleResolutionChange = (nextRes: number) => {
    const clampedRes = clampAdcResolution(nextRes);
    const nextMax = getAdcMaxValue(clampedRes);
    setResolution(clampedRes);
    setDeltaThreshold((prev) => clampAdcDeltaThreshold(prev, clampedRes));
    setHighThreshold((prev) => Math.min(nextMax, prev));
    setLowThreshold((prev) => Math.min(nextMax, prev));
  };

  const applyPreset = (preset: AnalogInputPreset) => {
    setResolution(preset.config.adcResolution);
    setSampleIntervalMs(preset.config.adcSampleIntervalMs);
    setDeltaThreshold(preset.config.adcDeltaThreshold);
    setHighThreshold(preset.config.adcHighThreshold);
    setLowThreshold(preset.config.adcLowThreshold);
  };

  const handleSave = () => {
    if (!dashboard?.handleUpdateAnalogInputConfig || hasInvalidThresholds) return;

    const normalized = normalizeAnalogInputConfig({
      adcResolution: resolution,
      adcSampleIntervalMs: sampleIntervalMs,
      adcDeltaThreshold: deltaThreshold,
      adcHighThreshold: highThreshold,
      adcLowThreshold: highThreshold === 0 ? 0 : lowThreshold,
    });

    setResolution(normalized.adcResolution);
    setSampleIntervalMs(normalized.adcSampleIntervalMs);
    setDeltaThreshold(normalized.adcDeltaThreshold);
    setHighThreshold(normalized.adcHighThreshold);
    setLowThreshold(normalized.adcLowThreshold);

    dashboard.handleUpdateAnalogInputConfig(segment.id, normalized);
    onApplied?.();
  };

  return (
    <div className="flex flex-col gap-2.5 text-right" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-text-secondary">
          تنظیم زنده سنسور (ADC1)
        </span>
        <span className="font-mono text-[10px] text-text-muted tabular-nums" dir="ltr">
          0..{maxVal}
        </span>
      </div>

      {/* Quick Sensor Presets */}
      <div className="grid grid-cols-3 gap-1">
        {ANALOG_INPUT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-lg border border-border-color bg-secondary px-1.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:border-accent3/60 hover:text-text-primary cursor-pointer truncate"
            title={preset.description}
          >
            {preset.id === "potentiometer"
              ? "پتانسیومتر"
              : preset.id === "ldr"
                ? "نور (LDR)"
                : "رطوبت/دما"}
          </button>
        ))}
      </div>

      {/* Resolution Selector */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border-color bg-secondary px-2.5 py-1.5">
        <span className="text-[11px] text-text-secondary">رزولوشن</span>
        <div className="flex items-center gap-1" dir="ltr">
          {RESOLUTION_OPTIONS.map((bits) => (
            <button
              key={bits}
              type="button"
              onClick={() => handleResolutionChange(bits)}
              aria-pressed={resolution === bits}
              className={`h-6 min-w-7 rounded-md px-1.5 font-mono text-[10px] font-semibold transition-colors cursor-pointer ${
                resolution === bits
                  ? "bg-accent3 text-accent3-foreground"
                  : "bg-card-bg-solid text-text-muted hover:text-text-primary"
              }`}
            >
              {bits}b
            </button>
          ))}
        </div>
      </div>

      {/* Sample Interval & Delta */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted">بازه خواندن (ms)</span>
          <input
            type="number"
            dir="ltr"
            min={MIN_ADC_SAMPLE_INTERVAL_MS}
            max={MAX_ADC_SAMPLE_INTERVAL_MS}
            value={sampleIntervalMs}
            onChange={(e) => setSampleIntervalMs(Number(e.target.value))}
            onBlur={() => setSampleIntervalMs((v) => clampAdcSampleInterval(v))}
            className="h-7.5 w-full rounded-lg border border-border-color bg-secondary px-2 font-mono text-xs tabular-nums text-text-primary outline-none focus:border-accent3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted">حساسیت تغییر (Delta)</span>
          <input
            type="number"
            dir="ltr"
            min={MIN_ADC_DELTA_THRESHOLD}
            max={maxVal}
            value={deltaThreshold}
            onChange={(e) => setDeltaThreshold(Number(e.target.value))}
            onBlur={() => setDeltaThreshold((v) => clampAdcDeltaThreshold(v, resolution))}
            className="h-7.5 w-full rounded-lg border border-border-color bg-secondary px-2 font-mono text-xs tabular-nums text-text-primary outline-none focus:border-accent3"
          />
        </label>
      </div>

      {/* Schmitt-Trigger High & Low Thresholds */}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted">آستانه بالا (ATH)</span>
          <input
            type="number"
            dir="ltr"
            min={0}
            max={maxVal}
            value={highThreshold}
            onChange={(e) => {
              const nextHigh = Math.min(maxVal, Math.max(0, Math.round(Number(e.target.value) || 0)));
              setHighThreshold(nextHigh);
              if (nextHigh === 0) {
                setLowThreshold(0);
              } else if (lowThreshold > nextHigh) {
                setLowThreshold(nextHigh);
              }
            }}
            className="h-7.5 w-full rounded-lg border border-border-color bg-secondary px-2 font-mono text-xs tabular-nums text-text-primary outline-none focus:border-accent3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-text-muted">آستانه پایین (ATL)</span>
          <input
            type="number"
            dir="ltr"
            min={0}
            max={highThreshold}
            disabled={highThreshold === 0}
            value={highThreshold === 0 ? 0 : lowThreshold}
            onChange={(e) =>
              setLowThreshold(Math.max(0, Math.round(Number(e.target.value) || 0)))
            }
            className="h-7.5 w-full rounded-lg border border-border-color bg-secondary px-2 font-mono text-xs tabular-nums text-text-primary outline-none focus:border-accent3 disabled:opacity-45"
          />
        </label>
      </div>

      {hasInvalidThresholds ? (
        <p className="text-[10px] text-destructive">
          آستانه پایین (ATL) نمی‌تواند از آستانه بالا (ATH) بزرگ‌تر باشد.
        </p>
      ) : (
        <p className="text-[10px] text-text-muted leading-4">
          {highThreshold === 0
            ? "ATH = 0: نمایش عددی بدون تریگر قانون (Rule)."
            : `هیسترزیس فعال: بالای ${highThreshold} ← HIGH | پایین ${lowThreshold} ← LOW`}
        </p>
      )}

      <button
        type="button"
        disabled={
          hasInvalidThresholds ||
          resolution < MIN_ADC_RESOLUTION ||
          resolution > MAX_ADC_RESOLUTION
        }
        onClick={handleSave}
        className="h-8 w-full rounded-xl bg-accent3 px-3 text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
      >
        اعمال تنظیمات روی دستگاه
      </button>
    </div>
  );
}
