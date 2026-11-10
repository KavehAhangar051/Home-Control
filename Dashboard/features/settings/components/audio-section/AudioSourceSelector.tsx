import React from "react";
import { Globe, HardDrive } from "@/components/ui/hugeicons";

interface Props {
  musicSource: "local" | "api";
  onSourceChange: (source: "local" | "api") => void;
}

export function AudioSourceSelector({ musicSource, onSourceChange }: Props) {
  return (
    <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
      <p className="text-xs text-[var(--text-primary)] font-bold text-right">منبع موزیک</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSourceChange("api")}
          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.96] ${
            musicSource === "api"
              ? "bg-[var(--accent3-transparent)] border-[var(--accent3)] text-[var(--accent3)]"
              : "bg-[var(--card-bg-solid)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:border-[var(--accent4)]"
          }`}
        >
          <Globe className="w-5 h-5" />
          <span className="text-xs font-semibold">موزیک‌های آنلاین</span>
          <span className="text-[11px] opacity-75">آرشیو آنلاین موسیقی بی‌کلام</span>
        </button>

        <button
          type="button"
          onClick={() => onSourceChange("local")}
          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.96] ${
            musicSource === "local"
              ? "bg-[var(--accent4-transparent)] border-[var(--accent4)] text-[var(--accent4)]"
              : "bg-[var(--card-bg-solid)] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:border-[var(--accent4)]"
          }`}
        >
          <HardDrive className="w-5 h-5" />
          <span className="text-xs font-semibold">موزیک ثابت</span>
          <span className="text-[11px] opacity-75">قطعه پیش‌فرض محلی</span>
        </button>
      </div>
    </div>
  );
}
