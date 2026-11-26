"use client";

import { Toggle as DissolveToggle } from "@/components/dissolve/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { soundManager } from "@/lib/audio";
import { triggerHaptic } from "@/lib/haptics";

interface AnimationsToggleProps {
  animationsEnabled: boolean;
  setAnimationsEnabled: (val: boolean) => void;
  animationsFps?: number;
  setAnimationsFps?: (val: number) => void;
  isDark?: boolean;
}

export default function AnimationsToggle({
  animationsEnabled,
  setAnimationsEnabled,
  animationsFps = 60,
  setAnimationsFps,
}: AnimationsToggleProps) {
  const handleToggle = () => {
    const nextVal = !animationsEnabled;
    setAnimationsEnabled(nextVal);
    if (nextVal) soundManager.playToggleOn();
    else soundManager.playToggleOff();
    triggerHaptic(nextVal ? "toggleOn" : "toggleOff");
  };

  return (
    <div className="space-y-3 border-b border-border-color pb-3.5 sm:space-y-3.5 sm:pb-4">
      <div
        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right sm:p-4 ${
          animationsEnabled
            ? "border-accent3 bg-card-hover-bg"
            : "border-border-color bg-card-bg"
        }`}
      >
        <span className="min-w-0 flex-1 space-y-1 text-right">
          <span className={`block font-sans text-xs font-medium leading-5 transition-colors duration-150 ${
            animationsEnabled ? "text-accent3" : "text-text-primary"
          }`}>
            انیمیشن‌های رابط کاربری
          </span>
          <span className="block font-sans text-[11px] leading-relaxed text-text-muted sm:text-xs sm:text-text-secondary">
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 sm:px-2">
          <span className="text-xs font-medium text-text-secondary">نرخ فریم انیمیشن</span>
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
                className="rounded-lg px-3 text-xs font-mono font-medium tabular-nums aria-pressed:border-accent3 aria-pressed:bg-accent3 aria-pressed:text-accent3-foreground"
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
