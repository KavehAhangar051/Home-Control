"use client";

import type React from "react";
import { useState } from "react";
import {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerHexInput,
  ColorPickerHue,
  ColorPickerPreset,
  ColorPickerPresets,
  ColorPickerTrigger,
} from "@/components/motion/color-picker";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { useThemeToggle } from "@/components/motion/theme-toggle";
import { Moon, RefreshCw, Sun } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { triggerHaptic } from "@/lib/haptics";
import FontSection from "./FontSection";
import SliderStyleSection from "./SliderStyleSection";

const QUICK_SWATCHES = [
  "#E5E7EB",
  "#3B82F6",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#F97316",
];

export default function ColorsSection() {
  const accent3 = useIoTStore((state) => state.accent3);
  const setAccent3 = useIoTStore((state) => state.setAccent3);
  const accent4 = useIoTStore((state) => state.accent4);
  const setAccent4 = useIoTStore((state) => state.setAccent4);
  const darkBlackness = useIoTStore((state) => state.darkBlackness);
  const setDarkBlackness = useIoTStore((state) => state.setDarkBlackness);
  const lightWhiteness = useIoTStore((state) => state.lightWhiteness);
  const setLightWhiteness = useIoTStore((state) => state.setLightWhiteness);
  const resetColors = useIoTStore((state) => state.resetColors);
  const resetFont = useIoTStore((state) => state.resetFont);
  const resetSliderStyle = usePreferencesStore((state) => state.resetSliderStyle);
  const [openPicker, setOpenPicker] = useState<"accent3" | "accent4" | null>(null);
  const {
    isDark,
    mounted,
    toggle: toggleTheme,
  } = useThemeToggle({
    variant: "circle-blur",
    start: "center",
  });

  const handleSelectTheme = (targetDark: boolean, e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDark === targetDark) return;

    triggerHaptic("toggleOn");
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 100);
    const y = Math.round(((rect.top + rect.height / 2) / window.innerHeight) * 100);
    toggleTheme(`${x}% ${y}%`);
  };

  const handleResetAppearance = () => {
    resetColors();
    resetFont();
    resetSliderStyle();
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleResetAppearance}
          className="inline-flex min-h-10 sm:min-h-8 cursor-pointer items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors py-1.5 px-2.5 rounded-lg hover:bg-card-hover-bg shrink-0"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          <span>بازنشانی پیش‌فرض</span>
        </button>
      </div>

      {/* تغییر تم شب و روز (ویژه موبایل؛ در دسکتاپ دکمه تم در فوتر باقی می‌ماند) */}
      <div className="space-y-2.5 pb-4 border-b border-border-color md:hidden">
        <h4 className="text-xs font-semibold text-text-secondary">حالت نمایش</h4>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={mounted ? !isDark : false}
            onClick={(event) => handleSelectTheme(false, event)}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
              mounted && !isDark
                ? "border-accent3 bg-card-hover-bg text-text-primary"
                : "border-border-color bg-card-bg-solid text-text-secondary hover:text-text-primary"
            }`}
          >
            <Sun
              aria-hidden="true"
              className={`size-4 shrink-0 ${mounted && !isDark ? "text-accent3" : "text-text-muted"}`}
              strokeWidth={1.7}
            />
            <span>حالت روز</span>
          </button>

          <button
            type="button"
            aria-pressed={mounted ? isDark : true}
            onClick={(event) => handleSelectTheme(true, event)}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
              !mounted || isDark
                ? "border-accent3 bg-card-hover-bg text-text-primary"
                : "border-border-color bg-card-bg-solid text-text-secondary hover:text-text-primary"
            }`}
          >
            <Moon
              aria-hidden="true"
              className={`size-4 shrink-0 ${!mounted || isDark ? "text-accent3" : "text-text-muted"}`}
              strokeWidth={1.7}
            />
            <span>حالت شب</span>
          </button>
        </div>
      </div>

      {/* ۱. فونت داشبورد */}
      <div className="pb-4 border-b border-border-color">
        <FontSection />
      </div>

      {/* ۲. سبک اسلایدرهای داشبورد */}
      <div className="pb-4 border-b border-border-color">
        <SliderStyleSection />
      </div>

      {/* ۲. رنگ‌های جانبی */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-text-secondary mb-2">رنگ‌های جانبی</h4>

        {/* رنگ جانبی اول */}
        <div
          className={`relative flex items-center justify-between gap-3 py-3 px-3 rounded-lg border border-border-color bg-card-bg-solid ${
            openPicker === "accent3" ? "z-30" : "z-0"
          }`}
        >
          <div>
            <span className="text-xs font-medium text-text-primary">رنگ جانبی اول</span>
            <p className="text-[11px] text-text-muted mt-0.5">المان‌ها، کادرهای فعال و نشانگرها</p>
          </div>

          <div className="relative shrink-0">
            <ColorPicker
              value={accent3}
              onValueChange={setAccent3}
              open={openPicker === "accent3"}
              onOpenChange={(isOpen) => setOpenPicker(isOpen ? "accent3" : null)}
            >
              <ColorPickerTrigger />
              <ColorPickerContent align="start">
                <ColorPickerArea />
                <div className="flex items-center gap-2">
                  <ColorPickerEyeDropper />
                  <div className="flex flex-1 flex-col gap-2">
                    <ColorPickerHue />
                    <ColorPickerAlpha />
                  </div>
                </div>
                <ColorPickerHexInput />
                <ColorPickerPresets>
                  {QUICK_SWATCHES.map((color) => (
                    <ColorPickerPreset key={color} value={color} />
                  ))}
                </ColorPickerPresets>
              </ColorPickerContent>
            </ColorPicker>
          </div>
        </div>

        {/* رنگ جانبی دوم */}
        <div
          className={`relative flex items-center justify-between gap-3 py-3 px-3 rounded-lg border border-border-color bg-card-bg-solid ${
            openPicker === "accent4" ? "z-30" : "z-0"
          }`}
        >
          <div>
            <span className="text-xs font-medium text-text-primary">رنگ جانبی دوم</span>
            <p className="text-[11px] text-text-muted mt-0.5">اکشن‌های مکمل و هایلایت‌ها</p>
          </div>

          <div className="relative shrink-0">
            <ColorPicker
              value={accent4}
              onValueChange={setAccent4}
              open={openPicker === "accent4"}
              onOpenChange={(isOpen) => setOpenPicker(isOpen ? "accent4" : null)}
            >
              <ColorPickerTrigger />
              <ColorPickerContent align="start">
                <ColorPickerArea />
                <div className="flex items-center gap-2">
                  <ColorPickerEyeDropper />
                  <div className="flex flex-1 flex-col gap-2">
                    <ColorPickerHue />
                    <ColorPickerAlpha />
                  </div>
                </div>
                <ColorPickerHexInput />
                <ColorPickerPresets>
                  {QUICK_SWATCHES.map((color) => (
                    <ColorPickerPreset key={color} value={color} />
                  ))}
                </ColorPickerPresets>
              </ColorPickerContent>
            </ColorPicker>
          </div>
        </div>
      </div>

      {/* ۳. رنگ‌های اصلی (تنظیم مقدار سیاهی و سفیدی) */}
      <div className="space-y-1 pt-2">
        <h4 className="text-xs font-semibold text-text-secondary mb-2">رنگ‌های اصلی زمینه</h4>

        {/* مقدار سیاهی حالت شب */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-3 rounded-lg border border-border-color bg-card-bg-solid">
          <div>
            <span className="text-xs font-medium text-text-primary">سیاهی حالت شب</span>
            <p className="text-[11px] text-text-muted mt-0.5">از OLED مشکی تا خاکستری ذغالی</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-64">
            <div className="min-w-0 flex-1">
              <DashboardSlider
                defaultVariant="inline"
                min={0}
                max={100}
                step={1}
                value={darkBlackness}
                onValueChange={setDarkBlackness}
                label="سیاهی"
                format={(v) => `${v}%`}
                unit="%"
                aria-label="مقدار سیاهی حالت شب"
                formatValueText={(v) => `${v} درصد`}
              />
            </div>
            <span className="font-mono text-xs text-text-primary w-9 text-left tabular-nums shrink-0">
              {darkBlackness}٪
            </span>
          </div>
        </div>

        {/* مقدار سفیدی حالت روز */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-3 rounded-lg border border-border-color bg-card-bg-solid">
          <div>
            <span className="text-xs font-medium text-text-primary">سفیدی حالت روز</span>
            <p className="text-[11px] text-text-muted mt-0.5">از سفید خالص تا خاکستری روشن</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-64">
            <div className="min-w-0 flex-1">
              <DashboardSlider
                defaultVariant="inline"
                min={0}
                max={100}
                step={1}
                value={lightWhiteness}
                onValueChange={setLightWhiteness}
                label="سفیدی"
                format={(v) => `${v}%`}
                unit="%"
                aria-label="مقدار سفیدی حالت روز"
                formatValueText={(v) => `${v} درصد`}
              />
            </div>
            <span className="font-mono text-xs text-text-primary w-9 text-left tabular-nums shrink-0">
              {lightWhiteness}٪
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
