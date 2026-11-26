"use client";

import { Toggle as DissolveToggle } from "@/components/dissolve/toggle";
import { WifiOff } from "@/components/ui/hugeicons-groups/shell";
import { soundManager } from "@/lib/audio";
import { triggerHaptic } from "@/lib/haptics";

interface LowDataToggleProps {
  lowDataMode: boolean;
  setLowDataMode: (val: boolean) => void;
  animationsEnabled: boolean;
  isDark?: boolean;
}

export default function LowDataToggle({
  lowDataMode,
  setLowDataMode,
  animationsEnabled,
}: LowDataToggleProps) {
  const handleToggle = () => {
    const nextVal = !lowDataMode;
    setLowDataMode(nextVal);
    if (nextVal) soundManager.playToggleOn();
    else soundManager.playToggleOff();
    triggerHaptic(nextVal ? "toggleOn" : "toggleOff");
  };

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <div
        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right sm:p-4 ${
          lowDataMode
            ? "border-accent3 bg-card-hover-bg"
            : "border-border-color bg-card-bg"
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1 text-right">
          <span className={`flex w-full items-center justify-start gap-1.5 font-sans text-xs font-medium leading-5 transition-colors duration-150 ${
            lowDataMode ? "text-accent3" : "text-text-primary"
          }`}>
            <WifiOff
              strokeWidth={1.5}
              aria-hidden="true"
              className={`size-4 shrink-0 ${lowDataMode ? "text-accent3" : "text-text-secondary"}`}
            />
            حالت کم‌مصرف اینترنت
          </span>
          <span className="block font-sans text-[11px] leading-relaxed text-text-muted sm:text-xs sm:text-text-secondary">
            {lowDataMode
              ? "روشن · همگام‌سازی فقط با درخواست دستی"
              : "خاموش · همگام‌سازی خودکار پس‌زمینه با کلودفلر"}
          </span>
        </div>
        <DissolveToggle
          value={lowDataMode}
          onValueChange={handleToggle}
          size="sm"
          onColor="var(--accent3)"
          offColor="var(--bg-main)"
          haptics={false}
          reducedMotion={!animationsEnabled}
          accessibilityLabel="حالت کم‌مصرف اینترنت"
          className="shrink-0"
        />
      </div>
    </div>
  );
}
