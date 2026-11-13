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

function getToggleSurfaceClass(animationsEnabled: boolean, isDark: boolean): string {
  if (animationsEnabled) {
    return isDark
      ? "bg-emerald-950/20 aria-pressed:bg-emerald-950/20 data-[state=on]:bg-emerald-950/20 border-accent4/60 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
      : "bg-emerald-50 aria-pressed:bg-emerald-50 data-[state=on]:bg-emerald-50 border-emerald-300 shadow-[0_2px_4px_rgba(16,185,129,0.06)]";
  }

  return isDark
    ? "bg-slate-950/40 border-slate-800 hover:bg-slate-950/60 hover:border-slate-700"
    : "bg-slate-50/80 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300 shadow-sm";
}

function getTitleTextClass(animationsEnabled: boolean, isDark: boolean): string {
  if (animationsEnabled) return "text-emerald-500";

  return isDark ? "text-gray-200" : "text-slate-800";
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
    ? "bg-[var(--accent4)]"
    : isDark
      ? "bg-black/30 border border-slate-800/40"
      : "bg-slate-200 border border-slate-300";

  return (
    <div className="space-y-4 border-b border-accent3-medium/10 pb-4">
      <p className="text-[10px] theme-text-tertiary leading-relaxed">
        اگر دستگاه شما با تاخیر یا بار پردازشی بالایی مواجه است، انیمیشن‌های سنگین یا ترنزیشن‌های
        حرکتی را متوقف کنید:
      </p>
      <Toggle
        variant="outline"
        pressed={animationsEnabled}
        onPressedChange={handleToggle}
        aria-label={statusLabel}
        className={`switch-toggle w-full h-auto p-4 rounded-2xl border whitespace-normal transition-[background-color,border-color,box-shadow] duration-300 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}
      >
        <span className="text-right space-y-0.5 max-w-[70%]">
          <span
            className={`font-sans font-bold text-xs block transition-colors duration-200 ${titleClass}`}
          >
            {statusLabel}
          </span>
          <span
            className={`text-[11px] block leading-normal font-sans transition-colors duration-200 ${isDark ? "text-gray-400 group-hover:text-gray-300" : "text-slate-500 group-hover:text-slate-600"}`}
          >
            {animationsEnabled
              ? "نمایش نرم جابه‌جایی کارت‌ها و بازخورد حرکتی کنترل‌ها"
              : "کاهش بار پردازشی و حذف جلوه‌های حرکتی"}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 rounded-full p-0.5 items-center transition-colors duration-200 shrink-0 select-none ${trackBgClass}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full shadow-md transform ${animationsEnabled ? "bg-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-x-5" : "bg-[var(--text-secondary)] translate-x-0"}`}
          />
        </span>
      </Toggle>
      {animationsEnabled && setAnimationsFps && (
        <div className="pt-2 px-2 flex justify-between items-center">
          <span className="text-xs theme-text-secondary font-medium">نرخ نوسازی انیمیشن‌ها</span>
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
                className="px-3 text-xs font-sans font-bold tabular-nums aria-pressed:bg-[var(--accent4)] aria-pressed:text-white aria-pressed:border-[var(--accent4)]"
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
