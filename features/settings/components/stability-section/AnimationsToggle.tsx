"use client";

import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { soundManager } from "@/lib/audio";

interface AnimationsToggleProps {
  animationsEnabled: boolean;
  setAnimationsEnabled: (val: boolean) => void;
  animationsFps?: number;
  setAnimationsFps?: (val: number) => void;
  isDark?: boolean;
}

function getToggleSurfaceClass(animationsEnabled: boolean, _isDark: boolean): string {
  if (animationsEnabled) {
    return "bg-card-hover-bg aria-pressed:bg-card-hover-bg data-[state=on]:bg-card-hover-bg border-accent4";
  }

  return "bg-card-bg border-border-color hover:bg-card-hover-bg";
}

function getTitleTextClass(animationsEnabled: boolean, _isDark: boolean): string {
  if (animationsEnabled) return "text-accent4";

  return "text-text-primary";
}

export default function AnimationsToggle({
  animationsEnabled,
  setAnimationsEnabled,
  animationsFps = 60,
  setAnimationsFps,
  isDark = true,
}: AnimationsToggleProps) {
  const handleToggle = () => {
    const nextVal = !animationsEnabled;
    setAnimationsEnabled(nextVal);

    if (nextVal) soundManager.playToggleOn();
    else soundManager.playToggleOff();
  };

  const statusLabel = animationsEnabled
    ? "انیمیشن‌های رابط کاربری: فعال"
    : "انیمیشن‌های رابط کاربری: غیرفعال";

  const surfaceClass = getToggleSurfaceClass(animationsEnabled, isDark);
  const titleClass = getTitleTextClass(animationsEnabled, isDark);

  const trackBgClass = animationsEnabled
    ? "bg-accent4 border border-transparent"
    : "bg-bg-main border border-border-color";

  return (
    <div className="space-y-3 border-b border-border-color pb-3.5 sm:space-y-4 sm:pb-4">
      <p className="text-[11px] text-text-muted leading-relaxed sm:text-xs sm:text-text-secondary">
        اگر دستگاه شما با تاخیر یا بار پردازشی بالایی مواجه است، انیمیشن‌ها و ترنزیشن‌های حرکتی را
        متوقف کنید
      </p>
      <Toggle
        variant="outline"
        pressed={animationsEnabled}
        onPressedChange={handleToggle}
        aria-label={statusLabel}
        className={`switch-toggle w-full h-auto gap-3 p-3 sm:p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}
      >
        <span className="min-w-0 flex-1 text-right space-y-1">
          <span
            className={`font-sans font-medium text-xs block leading-5 transition-colors duration-150 ${titleClass}`}
          >
            {statusLabel}
          </span>
          <span className="text-[11px] sm:text-xs block leading-relaxed font-sans text-text-muted sm:text-text-secondary">
            {animationsEnabled
              ? "نمایش نرم جابه‌جایی کارت‌ها و بازخورد حرکتی کنترل‌ها"
              : "کاهش بار پردازشی و حذف جلوه‌های حرکتی"}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 rounded-[8px] p-0.5 items-center transition-colors duration-150 shrink-0 select-none ${trackBgClass}`}
        >
          <span
            className={`pointer-events-none inline-block h-[18px] w-[18px] rounded-[5px] shadow-sm transform ${animationsEnabled ? "bg-white transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] -translate-x-5" : "bg-text-secondary translate-x-0"}`}
          />
        </span>
      </Toggle>
      {animationsEnabled && setAnimationsFps && (
        <div className="pt-1 sm:pt-2 px-0.5 sm:px-2 flex flex-wrap justify-between items-center gap-2">
          <span className="text-xs text-text-secondary font-medium">نرخ نوسازی انیمیشن‌ها</span>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={2}
            value={[String(animationsFps)]}
            onValueChange={(vals) => {
              if (vals.length > 0) {
                setAnimationsFps(Number(vals[0]));
                soundManager.playClick();
              }
            }}
            dir="ltr"
          >
            {[30, 60].map((fps) => (
              <ToggleGroupItem
                key={fps}
                value={String(fps)}
                className="px-3 text-xs font-mono font-medium tabular-nums rounded-lg aria-pressed:bg-accent4 aria-pressed:text-white aria-pressed:border-accent4"
              >
                {fps} FPS
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );
}
