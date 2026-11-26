/**
 * @file lib/sliderStyles.ts
 * @description Registry and resolution helpers for all dashboard slider styles
 * plus the context-aware `"auto"` mode selectable in dashboard appearance settings.
 */

export type SliderVariant = "inline" | "range" | "fluid" | "wave" | "bubble" | "ruler" | "elastic";

export type SliderStylePreference = "auto" | SliderVariant;

export const DEFAULT_SLIDER_STYLE: SliderStylePreference = "auto";

export interface SliderStyleOption {
  id: SliderStylePreference;
  title: string;
  englishName: string;
  description: string;
  isDefault?: boolean;
}

export const SLIDER_STYLE_OPTIONS: readonly SliderStyleOption[] = [
  {
    id: "auto",
    title: "هوشمند (پیشنهادی)",
    englishName: "Smart Auto",
    description: "بهترین مدل متناسب با هر بخش (مایع برای دیمر، خط‌کش برای تایمر، خطی برای تنظیمات)",
    isDefault: true,
  },
  {
    id: "inline",
    title: "خطی با برچسب داخلی",
    englishName: "Inline Slider",
    description: "عنوان و مقدار داخل نوار با دستگیره‌ای که هنگام عبور از روی متن دو تکه می‌شود",
  },
  {
    id: "range",
    title: "کلاسیک با نقاط گام",
    englishName: "Range Slider",
    description: "نقاط گام منظم همراه با دستگیره عمودی فنری و پرشدن نرم",
  },
  {
    id: "fluid",
    title: "مایع بدون دستگیره",
    englishName: "Fluid Slider",
    description: "کپسول یکپارچه با حرکت مایع و معکوس‌شدن رنگ متن زیر نوار پرشده",
  },
  {
    id: "wave",
    title: "اکولایزر موج‌دار",
    englishName: "Wave Slider",
    description: "میله‌های عمودی که هنگام کشیدن مانند موج صوتی حول دستگیره اوج می‌گیرند",
  },
  {
    id: "bubble",
    title: "حباب شناور",
    englishName: "Bubble Slider",
    description: "نمایش حباب مقدار بالای دستگیره با زاویه و کشسانی متناسب با سرعت حرکت",
  },
  {
    id: "ruler",
    title: "خط‌کش با اینرسی",
    englishName: "Ruler Slider",
    description: "سوزن ثابت با مقیاس متحرک زیر آن و تداوم حرکت پس از رها کردن",
  },
  {
    id: "elastic",
    title: "کشسان و غلتان",
    englishName: "Elastic Slider",
    description: "نوار کپسولی با کشش فنری، پرشدن رنگی و ارقام غلتان",
  },
] as const;

const VALID_SLIDER_STYLES = new Set<string>(SLIDER_STYLE_OPTIONS.map((option) => option.id));

/**
 * Validates any persisted or imported value and falls back safely to `"auto"`.
 */
export function resolveSliderStyle(value: unknown): SliderStylePreference {
  if (typeof value === "string" && VALID_SLIDER_STYLES.has(value)) {
    // SAFETY: membership is verified against SLIDER_STYLE_OPTIONS ids
    return value as SliderStylePreference;
  }

  return DEFAULT_SLIDER_STYLE;
}

/**
 * Resolves the concrete beUI slider component variant to render for a given control.
 * When preference is `"auto"`, returns the UI slot's context-optimized default variant.
 */
export function resolveEffectiveSliderVariant(
  preference: SliderStylePreference,
  defaultVariant: SliderVariant,
): SliderVariant {
  return preference === "auto" ? defaultVariant : preference;
}
