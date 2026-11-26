"use client";

import { WifiOff } from "@/components/ui/hugeicons-groups/shell";
import { Toggle as DissolveToggle } from "@/components/dissolve/toggle";
import { soundManager } from "@/lib/audio";

interface LowDataToggleProps {
  lowDataMode: boolean;
  setLowDataMode: (val: boolean) => void;
  animationsEnabled: boolean;
  isDark?: boolean;
}

function getLowDataSurfaceClass(lowDataMode: boolean, _isDark: boolean): string {
  if (lowDataMode) {
    return "bg-card-hover-bg border-accent3";
  }

  return "bg-card-bg border-border-color hover:bg-card-hover-bg";
}

function getLowDataTitleClass(lowDataMode: boolean, _isDark: boolean): string {
  if (lowDataMode) {
    return "text-accent3";
  }

  return "text-text-primary";
}

export default function LowDataToggle({
  lowDataMode,
  setLowDataMode,
  animationsEnabled,
  isDark = true,
}: LowDataToggleProps) {
  const handleToggle = () => {
    const nextVal = !lowDataMode;
    setLowDataMode(nextVal);

    if (nextVal) soundManager.playToggleOn();
    else soundManager.playToggleOff();
  };

    return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <div className={`w-full h-auto gap-3 p-3 sm:p-4 rounded-xl border whitespace-normal transition-[background-color,border-color] duration-150 flex items-center justify-between cursor-pointer text-right group ${surfaceClass}`}>

        <div className="min-w-0 flex-1 text-right space-y-1">
          <span
            className={`font-sans font-medium text-xs flex items-center gap-1.5 w-full justify-start transition-colors duration-150 ${titleClass}`}
          >
            <WifiOff
              strokeWidth={1.5}
              className={`size-4 shrink-0 ${lowDataMode ? "text-accent3" : "text-text-secondary"}`}
            />
            <span className="leading-5">حالت کم‌مصرف اینترنت</span>
          </span>
          <span className="text-[11px] sm:text-xs block leading-relaxed font-sans text-text-muted sm:text-text-secondary">
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
