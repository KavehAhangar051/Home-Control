"use client";

import { Vibrate } from "lucide-react";
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

  const statusLabel = hapticsEnabled
    ? "بازخورد لمسی (لرزش موبایل): روشن"
    : "بازخورد لمسی (لرزش موبایل): خاموش";

  const surfaceClass = hapticsEnabled
    ? "bg-card-hover-bg aria-pressed:bg-card-hover-bg data-[state=on]:bg-card-hover-bg border-accent3"
    : "bg-card-bg border-border-color hover:bg-card-hover-bg";

  const titleClass = hapticsEnabled ? "text-accent3" : "text-text-primary";

  const switchTrackClass = hapticsEnabled
    ? "bg-accent4 border border-transparent"
    : "bg-bg-main border border-border-color";

  return (
    <div className="border-b border-border-color pb-4 space-y-2">
      <p className="text-xs text-text-secondary leading-relaxed">
        ایجاد لرزش کوتاه و ظریف روی موبایل هنگام لمس کلیدها، اجرای ماکرو، فرمان صوتی و اعلان‌ها
      </p>

      <Toggle
        variant="outline"
        pressed={hapticsEnabled}
        onPressedChange={handleToggle}
        aria-label={statusLabel}
        className={`switch-toggle w-full h-auto p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}
      >
        <div className="text-right space-y-1 max-w-[75%]">
          <span
            className={`font-sans font-medium text-xs flex items-center gap-1.5 w-full justify-end transition-colors duration-150 ${titleClass}`}
          >
            <span>{statusLabel}</span>
            <Vibrate
              strokeWidth={1.6}
              aria-hidden="true"
              className={`size-4 ${hapticsEnabled ? "text-accent3" : "text-text-secondary"}`}
            />
          </span>
          <span className="text-xs block leading-normal font-sans text-text-secondary">
            {supported
              ? hapticsEnabled
                ? "لرزش ظریف هنگام تعامل با کنترل‌ها فعال است"
                : "بازخورد لمسی در این مرورگر غیرفعال است"
              : "ذخیره محلی برای دستگاه‌های دارای پشتیبانی لرزش (مرورگر فعلی بدون ویبره)"}
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
            } ${hapticsEnabled ? "bg-white -translate-x-5" : "bg-text-secondary translate-x-0"}`}
          />
        </div>
      </Toggle>
    </div>
  );
}
