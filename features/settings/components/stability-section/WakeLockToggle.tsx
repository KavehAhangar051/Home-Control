"use client";

import { ToggleIndicator } from "@/components/dissolve/toggle";
import { Monitor } from "@/components/ui/hugeicons-groups/media";
import { Toggle } from "@/components/ui/toggle";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { soundManager } from "@/lib/audio";
import { triggerHaptic } from "@/lib/haptics";
import { isWakeLockSupported } from "@/lib/hooks/use-wake-lock";

interface WakeLockToggleProps {
  animationsEnabled: boolean;
}

/** Browser-local Screen Wake Lock preference for wall-mounted displays. */
export default function WakeLockToggle({ animationsEnabled }: WakeLockToggleProps) {
  const wakeLockEnabled = usePreferencesStore((s) => s.wakeLockEnabled);
  const setWakeLockEnabled = usePreferencesStore((s) => s.setWakeLockEnabled);
  const supported = isWakeLockSupported();

  const handleToggle = () => {
    const nextVal = !wakeLockEnabled;
    setWakeLockEnabled(nextVal);
    if (nextVal) {
      soundManager.playToggleOn();
      triggerHaptic("toggleOn");
    } else {
      soundManager.playToggleOff();
      triggerHaptic("toggleOff");
    }
  };

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <Toggle
        variant="outline"
        pressed={wakeLockEnabled}
        onPressedChange={handleToggle}
        aria-label={wakeLockEnabled
          ? "بیدار نگه‌داشتن نمایشگر · روشن"
          : "بیدار نگه‌داشتن نمایشگر · خاموش"}
        className={`switch-toggle flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right transition-[background-color,border-color] duration-150 sm:p-4 ${
          wakeLockEnabled
            ? "border-accent3 bg-card-hover-bg"
            : "border-border-color bg-card-bg hover:bg-card-hover-bg"
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1 text-right">
          <span className={`flex w-full items-center justify-start gap-1.5 font-sans text-xs font-medium leading-5 transition-colors duration-150 ${
            wakeLockEnabled ? "text-accent3" : "text-text-primary"
          }`}>
            <Monitor
              strokeWidth={1.6}
              aria-hidden="true"
              className={`size-4 shrink-0 ${wakeLockEnabled ? "text-accent3" : "text-text-secondary"}`}
            />
            بیدار نگه‌داشتن نمایشگر
          </span>
          <span className="block font-sans text-[11px] leading-relaxed text-text-muted sm:text-xs sm:text-text-secondary">
            {supported
              ? wakeLockEnabled
                ? "روشن · جلوگیری از خاموش‌شدن خودکار نمایشگر"
                : "خاموش · نمایشگر طبق زمان‌بندی سیستم‌عامل خاموش می‌شود"
              : "این مرورگر از قفل بیداری صفحه پشتیبانی نمی‌کند"}
          </span>
        </div>
        <ToggleIndicator
          value={wakeLockEnabled}
          size="sm"
          onColor="var(--accent3)"
          offColor="var(--bg-main)"
          reducedMotion={!animationsEnabled}
          className="shrink-0"
        />
      </Toggle>
    </div>
  );
}
