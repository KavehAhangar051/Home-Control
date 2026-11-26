"use client";

import { Toggle as DissolveToggle } from "@/components/dissolve/toggle";
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
    return "bg-card-hover-bg border-accent3";
  }

  return "bg-card-bg border-border-color hover:bg-card-hover-bg";
}

function getTitleTextClass(animationsEnabled: boolean, _isDark: boolean): string {
  if (animationsEnabled) return "text-accent3";

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

    const surfaceClass = getToggleSurfaceClass(animationsEnabled, isDark);
  const titleClass = getTitleTextClass(animationsEnabled, isDark);

  return (
    <div className="space-y-3 border-b border-border-color pb-3.5 sm:space-y-3.5 sm:pb-4">
      <div className={`w-full h-auto gap-3 p-3 sm:p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}>

        <span className="min-w-0 flex-1 text-right space-y-1">
          <span
            className={`font-sans font-medium text-xs block leading-5 transition-colors duration-150 ${titleClass}`}
          >
            انیمیشن‌های رابط کاربری
          </span>
          <span className="text-[11px] sm:text-xs block leading-relaxed font-sans text-text-muted sm:text-text-secondary">
            {animationsEnabled
              ? "فعال · جابه‌جایی نرم کارت‌ها و کنترل‌ها"
              : "غیرفعال · کاهش بار پردازشی دستگاه"}
          </span>
        </span>
        <DissolveToggle
          value={animationsEnabled}
          onValueChange={handleToggle}
          size="sm"
          onColor="var(--accent3)"
          offColor="var(--bg-main)"
          haptics={false}
          reducedMotion={!animationsEnabled}
          accessibilityLabel="انیمیشن‌های رابط کاربری"
          className="shrink-0"
        />
      </div>
      {animationsEnabled && setAnimationsFps && (
        <div className="px-0.5 sm:px-2 flex flex-wrap justify-between items-center gap-2">
          <span className="text-xs text-text-secondary font-medium">نرخ فریم انیمیشن</span>
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
                className="px-3 text-xs font-mono font-medium tabular-nums rounded-lg aria-pressed:bg-accent3 aria-pressed:text-accent3-foreground aria-pressed:border-accent3"
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
