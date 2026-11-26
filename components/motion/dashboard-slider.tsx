"use client";

import { ElasticSlider } from "@/components/dissolve/elastic-slider";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import type { SliderOptions } from "@/lib/hooks/use-slider";
import { resolveEffectiveSliderVariant, type SliderVariant } from "@/lib/sliderStyles";
import { cn } from "@/lib/utils";
import { RangeSlider } from "./range-slider";
import { BubbleSlider } from "./range-slider-bubble";
import { FluidSlider } from "./range-slider-fluid";
import { InlineSlider } from "./range-slider-inline";
import { RulerSlider } from "./range-slider-ruler";
import { WaveSlider } from "./range-slider-wave";

export interface RulerScaleAdapter {
  min: number;
  max: number;
  step: number;
  majorEvery?: number;
  gap?: number;
  unit?: string;
  toDisplay: (rawValue: number) => number;
  fromDisplay: (displayValue: number) => number;
}

export interface DashboardSliderProps extends SliderOptions {
  /** Context-optimized beUI variant used when user preference is `"auto"`. */
  defaultVariant: SliderVariant;
  /** Optional explicit override (used for live previews inside Settings). */
  variantOverride?: SliderVariant;
  /** Compact inline label shown inside InlineSlider and FluidSlider. */
  label?: string;
  /** Formats numeric values shown inside InlineSlider, FluidSlider, BubbleSlider, and ElasticSlider. */
  format?: (value: number) => string;
  /** Optional unit label shown by RulerSlider and ElasticSlider when no custom formatter is provided. */
  unit?: string;
  /** Controls tick dots in RangeSlider and InlineSlider (defaults to true). */
  showTicks?: boolean;
  /** Displays the formatted value in the ElasticSlider track (defaults to true). */
  showValue?: boolean;
  /** Sizing density for tiles, popovers, and forms. */
  size?: "default" | "compact" | "ultra";
  /** Optional scale adapter for RulerSlider when raw values span > 120 ticks (e.g. 12-bit PWM). */
  rulerScale?: RulerScaleAdapter;
  className?: string;
}

/**
 * Unified adaptive slider facade over six beUI motion sliders and Dissolve ElasticSlider.
 * Honors the user's global `sliderStyle` preference (`"auto"` falls back to each
 * control's context-optimized `defaultVariant`) while keeping DOM counts bounded
 * and heights well-proportioned across full forms, popovers, and compact IoT tiles.
 */
export function DashboardSlider({
  defaultVariant,
  variantOverride,
  label,
  format,
  unit,
  showTicks = true,
  showValue = true,
  size = "default",
  rulerScale,
  className,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  disabled,
  "aria-label": ariaLabel,
  formatValueText,
}: DashboardSliderProps) {
  const preference = usePreferencesStore((s) => s.sliderStyle);
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled);
  const variant = variantOverride ?? resolveEffectiveSliderVariant(preference, defaultVariant);

  const sharedOptions: SliderOptions = {
    min,
    max,
    step,
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    disabled,
    "aria-label": ariaLabel ?? label,
    formatValueText,
  };

  const isCompact = size === "compact";
  const isUltra = size === "ultra";

  switch (variant) {
    case "inline": {
      const heightClass = isUltra ? "h-7" : isCompact ? "h-8" : "h-10";

      return (
        <InlineSlider
          {...sharedOptions}
          label={label ?? ""}
          format={format ?? ((v) => (unit ? `${v} ${unit}` : String(v)))}
          showTicks={showTicks && !isUltra}
          stopCount={11}
          snapToStops={false}
          className={cn(heightClass, className)}
        />
      );
    }

    case "fluid": {
      const heightClass = isUltra ? "h-7" : isCompact ? "h-8.5" : "h-11";

      return (
        <FluidSlider
          {...sharedOptions}
          label={isUltra ? undefined : label}
          format={format ?? ((v) => (unit ? `${v} ${unit}` : `${v}%`))}
          compact={isCompact || isUltra}
          className={cn(heightClass, className)}
        />
      );
    }

    case "wave": {
      const heightClass = isUltra ? "h-7" : isCompact ? "h-9" : "h-16";
      const barClass = isUltra ? "h-5" : isCompact ? "h-6.5" : "h-12";
      const bars = isUltra ? 16 : isCompact ? 22 : 30;

      return (
        <WaveSlider
          {...sharedOptions}
          bars={bars}
          barClassName={barClass}
          className={cn(heightClass, className)}
        />
      );
    }

    case "bubble": {
      const heightClass = isUltra
        ? "h-7 items-center px-2.5 pb-0"
        : isCompact
          ? "h-9 items-center px-3 pb-0"
          : "h-20 px-5 pb-5";

      return (
        <BubbleSlider
          {...sharedOptions}
          format={format ?? ((v) => (unit ? `${v} ${unit}` : String(v)))}
          className={cn(heightClass, className)}
        />
      );
    }

    case "elastic": {
      return (
        <ElasticSlider
          label={label ?? ariaLabel ?? "مقدار"}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          onValueCommit={onValueCommit}
          min={min}
          max={max}
          step={step}
          size={isCompact || isUltra ? "sm" : "md"}
          formatValue={format ?? ((current) => (unit ? `${current} ${unit}` : String(current)))}
          formatValueText={formatValueText}
          showTicks={showTicks}
          showValue={showValue}
          haptics={hapticsEnabled}
          disabled={disabled}
          className={cn("dashboard-elastic-slider", className)}
        />
      );
    }

    case "ruler": {
      const rawSteps = step > 0 && max > min ? (max - min) / step : 0;

      if (rulerScale) {
        const displayValue = value !== undefined ? rulerScale.toDisplay(value) : undefined;
        const displayDefault =
          defaultValue !== undefined ? rulerScale.toDisplay(defaultValue) : undefined;

        return (
          <RulerSlider
            min={rulerScale.min}
            max={rulerScale.max}
            step={rulerScale.step}
            value={displayValue}
            defaultValue={displayDefault}
            onValueChange={
              onValueChange ? (d) => onValueChange(rulerScale.fromDisplay(d)) : undefined
            }
            onValueCommit={
              onValueCommit ? (d) => onValueCommit(rulerScale.fromDisplay(d)) : undefined
            }
            disabled={disabled}
            aria-label={ariaLabel ?? label}
            formatValueText={
              formatValueText ? (d) => formatValueText(rulerScale.fromDisplay(d)) : undefined
            }
            gap={rulerScale.gap ?? (isUltra || isCompact ? 10 : 12)}
            majorEvery={rulerScale.majorEvery ?? 10}
            unit={rulerScale.unit ?? unit}
            compact={isCompact || isUltra}
            className={className}
          />
        );
      }

      // Guard DOM tick count for large raw ranges without an explicit adapter
      const safeStep = rawSteps > 140 ? Math.max(step, Math.ceil((max - min) / 120)) : step;
      const tickCount = safeStep > 0 && max > min ? Math.round((max - min) / safeStep) : 10;
      const majorEvery = tickCount >= 60 ? 10 : 5;

      return (
        <RulerSlider
          {...sharedOptions}
          step={safeStep}
          gap={isUltra || isCompact ? 10 : 12}
          majorEvery={majorEvery}
          unit={unit}
          compact={isCompact || isUltra}
          className={className}
        />
      );
    }

    default: {
      const heightClass = isUltra ? "h-7" : isCompact ? "h-8" : "h-10";

      return (
        <RangeSlider
          {...sharedOptions}
          showTicks={showTicks}
          className={cn(heightClass, className)}
        />
      );
    }
  }
}
