"use client";

import { WifiOff } from "@/components/ui/hugeicons-groups/shell";
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
    return "bg-card-hover-bg aria-pressed:bg-card-hover-bg data-[state=on]:bg-card-hover-bg border-accent3";
  }

  return "bg-card-bg border-border-color hover:bg-card-hover-bg";
}

function getLowDataTitleClass(lowDataMode: boolean, _isDark: boolean): string {
  if (lowDataMode) {
    return "text-accent3";
  }

  return "text-text-primary";
}

function getSwitchTrackClass(lowDataMode: boolean, _isDark: boolean): string {
  if (lowDataMode) {
    return "bg-accent3 border border-transparent";
  }

  return "bg-bg-main border border-border-color";
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

  const statusLabel = lowDataMode ? "حالت کم‌مصرف اینترنت · روشن" : "حالت کم‌مصرف اینترنت · خاموش";
  const surfaceClass = getLowDataSurfaceClass(lowDataMode, isDark);
  const titleClass = getLowDataTitleClass(lowDataMode, isDark);
  const switchTrackClass = getSwitchTrackClass(lowDataMode, isDark);

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <Toggle
        variant="outline"
        pressed={lowDataMode}
        onPressedChange={handleToggle}
        aria-label={statusLabel}
        className={`switch-toggle w-full h-auto gap-3 p-3 sm:p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}
      >
        <div className="min-w-0 flex-1 text-right space-y-1">
          <span
            className={`font-sans font-medium text-xs flex items-center gap-1.5 w-full justify-start transition-colors duration-150 ${titleClass}`}
          >
            <WifiOff
              strokeWidth={1.5}
              className={`size-4 shrink-0 ${lowDataMode ? "text-accent3" : "text-text-secondary"}`}
            />
            <span className="leading-5">حالت کم‌مصرف اینترنت</span>
          </span>
          <span className="text-[11px] sm:text-xs block leading-relaxed font-sans text-text-muted sm:text-text-secondary">
            {lowDataMode
              ? "روشن · همگام‌سازی فقط با درخواست دستی"
              : "خاموش · همگام‌سازی خودکار پس‌زمینه با کلودفلر"}
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
            } ${lowDataMode ? "bg-accent3-foreground -translate-x-5" : "bg-text-secondary translate-x-0"}`}
          />
        </div>
      </Toggle>
    </div>
  );
}
