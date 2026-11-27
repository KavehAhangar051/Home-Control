"use client";

import { GrainToggleEffect } from "@/components/dissolve/toggle";
import { Waves } from "@/components/ui/hugeicons-groups/controls";
import { Toggle } from "@/components/ui/toggle";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { soundManager } from "@/lib/audio";
import { isHapticsSupported, triggerHaptic } from "@/lib/haptics";

interface HapticsToggleProps {
  animationsEnabled: boolean;
}

/** Browser-local haptic preference, persisted separately from ESP32 configuration. */
export default function HapticsToggle({ animationsEnabled }: HapticsToggleProps) {
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = usePreferencesStore((s) => s.setHapticsEnabled);
  const supported = isHapticsSupported();

  const handleToggle = () => {
    const nextVal = !hapticsEnabled;
    setHapticsEnabled(nextVal);
    if (nextVal) soundManager.playToggleOn();
    else soundManager.playToggleOff();
    triggerHaptic(nextVal ? "toggleOn" : "toggleOff", { force: true });
  };

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <Toggle
        variant="outline"
        pressed={hapticsEnabled}
        onPressedChange={handleToggle}
        aria-label={hapticsEnabled ? "بازخورد لمسی · روشن" : "بازخورد لمسی · خاموش"}
        className={`switch-toggle h-auto min-h-16 flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right transition-[background-color,border-color] duration-150 sm:p-4 ${
          hapticsEnabled
            ? "border-accent3 bg-card-hover-bg"
            : "border-border-color bg-card-bg hover:bg-card-hover-bg"
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1 text-right">
          <span
            className={`flex w-full items-center justify-start gap-1.5 font-sans text-xs font-medium leading-5 transition-colors duration-150 ${
              hapticsEnabled ? "text-accent3" : "text-text-primary"
            }`}
          >
            <Waves
              strokeWidth={1.6}
              aria-hidden="true"
              className={`size-4 shrink-0 ${hapticsEnabled ? "text-accent3" : "text-text-secondary"}`}
            />
            بازخورد لمسی
          </span>
          <span className="block font-sans text-[11px] leading-relaxed text-text-muted sm:text-xs sm:text-text-secondary">
            {supported
              ? hapticsEnabled
                ? "روشن · لرزش کوتاه هنگام استفاده از کنترل‌ها و اجرای ماکروها"
                : "خاموش · بدون لرزش لمسی"
              : "این مرورگر از لرزش لمسی پشتیبانی نمی‌کند"}
          </span>
        </div>
        <GrainToggleEffect
          value={hapticsEnabled}
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
