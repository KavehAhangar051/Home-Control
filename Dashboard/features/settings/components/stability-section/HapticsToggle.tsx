"use client";

import { Waves } from "@/components/ui/hugeicons-groups/controls";
import { Toggle } from "@/components/ui/toggle";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { soundManager } from "@/lib/audio";
import { isHapticsSupported, triggerHaptic } from "@/lib/haptics";

interface HapticsToggleProps {
  animationsEnabled: boolean;
}

/**
 * Browser-local Vibration API haptic feedback toggle inside Stability settings.
 * Persisted via `usePreferencesStore` (Zustand `persist`) without polluting ESP32 config.
 */
export default function HapticsToggle({ animationsEnabled }: HapticsToggleProps) {
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = usePreferencesStore((s) => s.setHapticsEnabled);
  const supported = isHapticsSupported();

  const handleToggle = () => {
    const nextVal = !hapticsEnabled;
    setHapticsEnabled(nextVal);

    if (nextVal) {
      soundManager.playToggleOn();
      triggerHaptic("toggleOn", { force: true });
    } else {
      soundManager.playToggleOff();
    }
  };

  const statusLabel = hapticsEnabled ? "بازخورد لمسی · روشن" : "بازخورد لمسی · خاموش";

  const surfaceClass = hapticsEnabled
    ? "bg-card-hover-bg aria-pressed:bg-card-hover-bg data-[state=on]:bg-card-hover-bg border-accent3"
    : "bg-card-bg border-border-color hover:bg-card-hover-bg";

  const titleClass = hapticsEnabled ? "text-accent3" : "text-text-primary";

  const switchTrackClass = hapticsEnabled
    ? "bg-accent3 border border-transparent"
    : "bg-bg-main border border-border-color";

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <Toggle
        variant="outline"
        pressed={hapticsEnabled}
        onPressedChange={handleToggle}
        aria-label={statusLabel}
        className={`switch-toggle w-full h-auto gap-3 p-3 sm:p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}
      >
        <div className="min-w-0 flex-1 text-right space-y-1">
          <span
            className={`font-sans font-medium text-xs flex items-center gap-1.5 w-full justify-start transition-colors duration-150 ${titleClass}`}
          >
            <Waves
              strokeWidth={1.6}
              aria-hidden="true"
              className={`size-4 shrink-0 ${hapticsEnabled ? "text-accent3" : "text-text-secondary"}`}
            />
            <span className="leading-5">بازخورد لمسی</span>
          </span>
          <span className="text-[11px] sm:text-xs block leading-relaxed font-sans text-text-muted sm:text-text-secondary">
            {supported
              ? hapticsEnabled
                ? "روشن · لرزش کوتاه هنگام استفاده از کنترل‌ها و اجرای ماکروها"
                : "خاموش · بدون لرزش لمسی"
              : "این مرورگر از لرزش لمسی پشتیبانی نمی‌کند"}
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
            } ${hapticsEnabled ? "bg-accent3-foreground -translate-x-5" : "bg-text-secondary translate-x-0"}`}
          />
        </div>
      </Toggle>
    </div>
  );
}
