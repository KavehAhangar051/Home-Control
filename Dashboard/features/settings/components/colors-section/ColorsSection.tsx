"use client";

import { RotateCcw } from "lucide-react";
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
import { RangeSlider } from "@/components/motion/range-slider";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import FontSection from "./FontSection";

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
  const [openPicker, setOpenPicker] = useState<"accent3" | "accent4" | null>(null);

  const handleResetAppearance = () => {
    resetColors();
    resetFont();
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* هدر بخش با دکمه بازنشانی ساده */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            شخصی‌سازی ظاهر داشبورد
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            تنظیم فونت داشبورد، رنگ‌های جانبی و درجه تیرگی و روشنایی تم
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetAppearance}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1 px-2 rounded-md hover:bg-[var(--card-hover-bg)]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>بازنشانی</span>
        </button>
      </div>

      {/* ۱. فونت داشبورد */}
      <div className="pb-4 border-b border-[var(--border-color)]">
        <FontSection />
      </div>

      {/* ۲. رنگ‌های جانبی */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">رنگ‌های جانبی</h4>

        {/* رنگ جانبی اول */}
        <div
          className={`relative flex items-center justify-between gap-3 py-3 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] ${
            openPicker === "accent3" ? "z-30" : "z-0"
          }`}
        >
          <div>
            <span className="text-xs font-medium text-[var(--text-primary)]">رنگ جانبی اول</span>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              المان‌ها، کادرهای فعال و نشانگرها
            </p>
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
          className={`relative flex items-center justify-between gap-3 py-3 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] ${
            openPicker === "accent4" ? "z-30" : "z-0"
          }`}
        >
          <div>
            <span className="text-xs font-medium text-[var(--text-primary)]">رنگ جانبی دوم</span>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">اکشن‌های مکمل و هایلایت‌ها</p>
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
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
          رنگ‌های اصلی زمینه
        </h4>

        {/* مقدار سیاهی حالت شب */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)]">
          <div>
            <span className="text-xs font-medium text-[var(--text-primary)]">
              مقدار سیاهی (حالت شب)
            </span>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              از مشکی خالص OLED تا خاکستری ذغالی
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-56">
            <RangeSlider
              min={0}
              max={100}
              step={1}
              value={darkBlackness}
              onValueChange={setDarkBlackness}
              aria-label="مقدار سیاهی حالت شب"
              formatValueText={(v) => `${v} درصد`}
              className="h-9 border border-[var(--border-color)]/60"
            />
            <span className="font-mono text-xs text-[var(--text-primary)] w-9 text-left tabular-nums shrink-0">
              {darkBlackness}٪
            </span>
          </div>
        </div>

        {/* مقدار سفیدی حالت روز */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)]">
          <div>
            <span className="text-xs font-medium text-[var(--text-primary)]">
              مقدار سفیدی (حالت روز)
            </span>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              از سفید خالص تا خاکستری روشن
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-56">
            <RangeSlider
              min={0}
              max={100}
              step={1}
              value={lightWhiteness}
              onValueChange={setLightWhiteness}
              aria-label="مقدار سفیدی حالت روز"
              formatValueText={(v) => `${v} درصد`}
              className="h-9 border border-[var(--border-color)]/60"
            />
            <span className="font-mono text-xs text-[var(--text-primary)] w-9 text-left tabular-nums shrink-0">
              {lightWhiteness}٪
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
