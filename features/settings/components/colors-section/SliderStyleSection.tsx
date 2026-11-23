"use client";

import { useState } from "react";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { Grid } from "@/components/ui/grid";
import { Check } from "@/components/ui/hugeicons-groups/controls";
import { RefreshCw, Sliders } from "@/components/ui/hugeicons-groups/shell";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { DEFAULT_SLIDER_STYLE, SLIDER_STYLE_OPTIONS, type SliderVariant } from "@/lib/sliderStyles";

const AUTO_CONTEXT_BADGES = [
  { context: "کارت دیمر PWM", style: "Fluid" },
  { context: "تنظیمات ظاهر", style: "Inline" },
  { context: "تایمر خاموشی", style: "Ruler" },
  { context: "ساخت قطعه", style: "Bubble" },
  { context: "شروط و قوانین", style: "Range" },
] as const;

export default function SliderStyleSection() {
  const sliderStyle = usePreferencesStore((state) => state.sliderStyle);
  const setSliderStyle = usePreferencesStore((state) => state.setSliderStyle);
  const resetSliderStyle = usePreferencesStore((state) => state.resetSliderStyle);
  const [previewValue, setPreviewValue] = useState(64);

  const isDefaultSelected = sliderStyle === DEFAULT_SLIDER_STYLE;
  const activeOption =
    SLIDER_STYLE_OPTIONS.find((item) => item.id === sliderStyle) ?? SLIDER_STYLE_OPTIONS[0];
  const previewVariant: SliderVariant = sliderStyle === "auto" ? "inline" : sliderStyle;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="size-4 text-accent3 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-text-secondary">سبک اسلایدرهای داشبورد</h4>
            <p className="text-[11px] text-text-muted mt-0.5">
              حالت هوشمند مدل مناسب هر بخش را انتخاب می‌کند؛ در غیر این صورت کل داشبورد یک مدل ثابت
              می‌گیرد.
            </p>
          </div>
        </div>

        {!isDefaultSelected && (
          <button
            type="button"
            onClick={resetSliderStyle}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors py-1 px-2 rounded-md hover:bg-card-hover-bg shrink-0 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            <span>بازگشت به هوشمند</span>
          </button>
        )}
      </div>

      {/* Live interactive preview for the currently selected slider style */}
      <div className="rounded-xl border border-border-color bg-card-bg-solid p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-text-primary truncate">
              پیش‌نمایش زنده: {activeOption.title}
            </span>
            <span className="text-[11px] text-text-muted shrink-0" dir="ltr">
              ({activeOption.englishName})
            </span>
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums text-accent3" dir="ltr">
            {previewValue}%
          </span>
        </div>

        <DashboardSlider
          defaultVariant="inline"
          variantOverride={previewVariant}
          min={0}
          max={100}
          step={1}
          value={previewValue}
          onValueChange={setPreviewValue}
          label="روشنایی نمونه"
          format={(v) => `${v}%`}
          unit="%"
          aria-label="پیش‌نمایش زنده اسلایدر"
          formatValueText={(v) => `${v} درصد`}
        />

        {sliderStyle === "auto" && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-color/60">
            {AUTO_CONTEXT_BADGES.map((item) => (
              <span
                key={item.context}
                className="inline-flex items-center gap-1 rounded-md border border-border-color bg-bg-main px-2 py-0.5 text-[10px] text-text-secondary"
              >
                <span>{item.context}:</span>
                <span className="font-mono text-text-primary" dir="ltr">
                  {item.style}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <Grid cols={2} gap="sm" className="gap-2.5">
        {SLIDER_STYLE_OPTIONS.map((option) => {
          const isSelected = sliderStyle === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSliderStyle(option.id)}
              aria-pressed={isSelected}
              className={`group flex flex-col justify-between gap-2 p-3 rounded-lg border text-right transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
                option.id === "auto" ? "col-span-full" : ""
              } ${
                isSelected
                  ? "border-accent3 bg-card-hover-bg"
                  : "border-border-color bg-card-bg-solid hover:border-text-muted hover:bg-card-hover-bg/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold text-text-primary">
                      {option.title}
                    </span>
                    <span className="text-[11px] text-text-muted" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[11px] font-mono text-text-muted" dir="ltr">
                      {option.englishName}
                    </span>
                    {option.isDefault && (
                      <>
                        <span className="text-[11px] text-text-muted" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[11px] text-accent3">پیش‌فرض</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 leading-5">{option.description}</p>
                </div>

                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    isSelected
                      ? "border-accent3 bg-accent3 text-accent3-foreground"
                      : "border-border-color bg-transparent text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  <Check className="size-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </Grid>
    </div>
  );
}
