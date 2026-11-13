"use client";

import { Check, RotateCcw, Type } from "lucide-react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { DASHBOARD_FONTS, DEFAULT_DASHBOARD_FONT, getDashboardFontFamilyCss } from "@/lib/fonts";

export default function FontSection() {
  const selectedFont = useIoTStore((state) => state.selectedFont);
  const setSelectedFont = useIoTStore((state) => state.setSelectedFont);
  const resetFont = useIoTStore((state) => state.resetFont);

  const isDefaultSelected = selectedFont === DEFAULT_DASHBOARD_FONT;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Type className="w-4 h-4 text-[var(--accent3)] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">فونت داشبورد</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              بین فونت‌های پیشنهادی، فونت دلخواه خود را برای تمام بخش‌های داشبورد انتخاب کنید
            </p>
          </div>
        </div>

        {!isDefaultSelected && (
          <button
            type="button"
            onClick={resetFont}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1 px-2 rounded-md hover:bg-[var(--card-hover-bg)] shrink-0 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>بازگشت به دانا</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DASHBOARD_FONTS.map((font) => {
          const isSelected = selectedFont === font.id;
          const fontFamilyCss = getDashboardFontFamilyCss(font.id);

          return (
            <button
              key={font.id}
              type="button"
              onClick={() => setSelectedFont(font.id)}
              aria-pressed={isSelected}
              className={`group flex flex-col justify-between gap-2.5 p-3.5 rounded-lg border text-right transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent3)] ${
                isSelected
                  ? "border-[var(--accent3)] bg-[var(--card-hover-bg)]"
                  : "border-[var(--border-color)] bg-[var(--card-bg-solid)] hover:border-[var(--text-muted)] hover:bg-[var(--card-hover-bg)]/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      data-font-preview="true"
                      style={{ fontFamily: fontFamilyCss }}
                      className="text-sm font-semibold text-[var(--text-primary)]"
                    >
                      {font.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]" aria-hidden="true">
                      ·
                    </span>
                    <span
                      data-font-preview="true"
                      style={{ fontFamily: fontFamilyCss }}
                      className="text-[11px] text-[var(--text-muted)]"
                      dir="ltr"
                    >
                      {font.englishName}
                    </span>
                    {font.isDefault && (
                      <>
                        <span className="text-[11px] text-[var(--text-muted)]" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">پیش‌فرض</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-5">
                    {font.description}
                  </p>
                </div>

                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    isSelected
                      ? "border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)]"
                      : "border-[var(--border-color)] bg-transparent text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  <Check className="w-3.5 h-3.5" />
                </span>
              </div>

              <div className="w-full pt-2 border-t border-[var(--border-color)]/70">
                <p
                  data-font-preview="true"
                  style={{ fontFamily: fontFamilyCss }}
                  className="text-xs leading-6 text-[var(--text-secondary)] truncate"
                >
                  {font.sampleText}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
