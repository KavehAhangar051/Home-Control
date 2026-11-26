"use client";

import { Monitor } from "@/components/ui/hugeicons-groups/media";
import { Toggle } from "@/components/ui/toggle";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { soundManager } from "@/lib/audio";
import { triggerHaptic } from "@/lib/haptics";
import { isWakeLockSupported } from "@/lib/hooks/use-wake-lock";

interface WakeLockToggleProps {
  animationsEnabled: boolean;
}

/**
 * Browser-local Screen Wake Lock API toggle inside Stability settings.
 * Ideal for wall-mounted tablets and dedicated smart-home displays.
 */
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

  const statusLabel = wakeLockEnabled
    ? "بیدار نگه‌داشتن نمایشگر · روشن"
    : "بیدار نگه‌داشتن نمایشگر · خاموش";

  const surfaceClass = wakeLockEnabled
    ? "bg-card-hover-bg aria-pressed:bg-card-hover-bg data-[state=on]:bg-card-hover-bg border-accent3"
    : "bg-card-bg border-border-color hover:bg-card-hover-bg";

  const titleClass = wakeLockEnabled ? "text-accent3" : "text-text-primary";

  const switchTrackClass = wakeLockEnabled
    ? "bg-accent3 border border-transparent"
    : "bg-bg-main border border-border-color";

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <Toggle
        variant="outline"
        pressed={wakeLockEnabled}
        onPressedChange={handleToggle}
        aria-label={statusLabel}
        className={`switch-toggle w-full h-auto gap-3 p-3 sm:p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}
      >
        <div className="min-w-0 flex-1 text-right space-y-1">
          <span
            className={`font-sans font-medium text-xs flex items-center gap-1.5 w-full justify-start transition-colors duration-150 ${titleClass}`}
          >
            <Monitor
              strokeWidth={1.6}
              aria-hidden="true"
              className={`size-4 shrink-0 ${wakeLockEnabled ? "text-accent3" : "text-text-secondary"}`}
            />
            <span className="leading-5">بیدار نگه‌داشتن نمایشگر</span>
          </span>
          <span className="text-[11px] sm:text-xs block leading-relaxed font-sans text-text-muted sm:text-text-secondary">
            {supported
              ? wakeLockEnabled
                ? "روشن · جلوگیری از خاموش‌شدن خودکار نمایشگر"
                : "خاموش · نمایشگر طبق زمان‌بندی سیستم‌عامل خاموش می‌شود"
              : "این مرورگر از قفل بیداری صفحه پشتیبانی نمی‌کند"}
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
            } ${wakeLockEnabled ? "bg-accent3-foreground -translate-x-5" : "bg-text-secondary translate-x-0"}`}
          />
        </div>
      </Toggle>
    </div>
  );
}
