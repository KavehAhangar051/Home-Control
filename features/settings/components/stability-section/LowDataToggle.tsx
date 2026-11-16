"use client";

import { WifiOff } from "@/components/ui/hugeicons";
import { Toggle } from "@/components/ui/toggle";
import { soundManager } from "@/lib/audio";

interface LowDataToggleProps {
  lowDataMode: boolean;
  setLowDataMode: (val: boolean) => void;
  animationsEnabled: boolean;
  isDark?: boolean;
}

function getLowDataSurfaceClass(lowDataMode: boolean, _isDark: boolean): string {
  if (lowDataMode) {
    return "bg-[var(--card-hover-bg)] aria-pressed:bg-[var(--card-hover-bg)] data-[state=on]:bg-[var(--card-hover-bg)] border-[var(--accent3)]";
  }

  return "bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--card-hover-bg)]";
}

function getLowDataTitleClass(lowDataMode: boolean, _isDark: boolean): string {
  if (lowDataMode) {
    return "text-[var(--accent3)]";
  }

  return "text-[var(--text-primary)]";
}

function getSwitchTrackClass(lowDataMode: boolean, _isDark: boolean): string {
  if (lowDataMode) {
    return "bg-[var(--accent4)] border border-transparent";
  }

  return "bg-[var(--bg-main)] border border-[var(--border-color)]";
}

export default function LowDataToggle({
  lowDataMode,
  setLowDataMode,
  animationsEnabled,
  isDark = true,
}: LowDataToggleProps) {
  const handleToggle = () => {
    const nextVal = !lowDataMode;
    setLowDataMode(nextVal);

    if (nextVal) soundManager.playToggleOn();
    else soundManager.playToggleOff();
  };

  const statusLabel = lowDataMode ? "حالت کم‌مصرف اینترنت: روشن" : "حالت کم‌مصرف اینترنت: خاموش";
  const surfaceClass = getLowDataSurfaceClass(lowDataMode, isDark);
  const titleClass = getLowDataTitleClass(lowDataMode, isDark);
  const switchTrackClass = getSwitchTrackClass(lowDataMode, isDark);

  return (
    <div className="border-b border-[var(--border-color)] pb-4 space-y-2">
      <p className="text-xs theme-text-secondary leading-relaxed">
        در صورت محدودیت حجم اینترنت، سامانه را در حالت کم‌مصرف قرار دهید تا دریافت خودکار پس‌زمینه
        متوقف شود
      </p>

      <Toggle
        variant="outline"
        pressed={lowDataMode}
        onPressedChange={handleToggle}
        aria-label={statusLabel}
        className={`switch-toggle w-full h-auto p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}
      >
        <div className="text-right space-y-1 max-w-[75%]">
          <span
            className={`font-sans font-medium text-xs flex items-center gap-1.5 w-full justify-end transition-colors duration-150 ${titleClass}`}
          >
            <span>{statusLabel}</span>
            <WifiOff
              strokeWidth={1.5}
              className={`size-4 ${lowDataMode ? "text-[var(--accent3)]" : "text-[var(--text-secondary)]"}`}
            />
          </span>
          <span className="text-xs block leading-normal font-sans text-[var(--text-secondary)]">
            {lowDataMode
              ? "دریافت اطلاعات فقط با به‌روزرسانی دستی"
              : "همگام‌سازی خودکار با سرور ابری"}
          </span>
        </div>

        <div
          className={`relative inline-flex h-6 w-11 rounded-[8px] p-0.5 items-center transition-colors duration-150 shrink-0 cursor-pointer focus:outline-none select-none ${switchTrackClass}`}
        >
          <span
            className={`pointer-events-none inline-block h-[18px] w-[18px] rounded-[5px] shadow-sm transform ${
              animationsEnabled
                ? "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
                : ""
            } ${lowDataMode ? "bg-white -translate-x-5" : "bg-[var(--text-secondary)] translate-x-0"}`}
          />
        </div>
      </Toggle>
    </div>
  );
}
