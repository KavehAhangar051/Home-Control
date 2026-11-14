import React, { type ComponentPropsWithoutRef } from "react";
import { Toggle } from "@/components/ui/toggle";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import type { SegmentData } from "../core/types";
import CardFooter from "./CardFooter";

interface PinToggleProps {
  segment: SegmentData;
  isPinOn: boolean;
  buttonProps: Omit<ComponentPropsWithoutRef<typeof Toggle>, "pressed" | "className">;
  animationsEnabled?: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
  hasExternalHeader?: boolean;
  mode?: "switch" | "push";
  countdown?: number | null;
}

function getPinToggleDensity(
  isUltraCompact: boolean,
  isCompact: boolean,
  hasExternalHeader: boolean,
) {
  if (isUltraCompact) {
    return {
      container: hasExternalHeader ? "min-h-0 px-2.5 py-2 gap-1.5" : "min-h-[78px] p-2.5 gap-2",
      badge: "w-8 h-8",
      icon: "w-4 h-4",
      title: "text-xs",
    };
  }

  if (isCompact) {
    return {
      container: hasExternalHeader ? "min-h-0 px-3 py-2.5 gap-2" : "min-h-[96px] p-3 gap-2.5",
      badge: "w-9 h-9",
      icon: "w-4.5 h-4.5",
      title: "text-xs sm:text-sm",
    };
  }

  return {
    container: hasExternalHeader
      ? "min-h-0 px-3.5 py-3 gap-2.5"
      : "min-h-[108px] p-3.5 sm:p-4 gap-3",
    badge: "w-10 h-10 sm:w-11 sm:h-11",
    icon: "w-5 h-5",
    title: "text-sm sm:text-[15px]",
  };
}

function getPinToggleAriaLabel(title: string, isPinOn: boolean, mode: "switch" | "push"): string {
  if (mode === "push") {
    return `${title} - ${isPinOn ? "شستی فعال" : "فشار لحظه‌ای شستی"}`;
  }

  return `${title} - ${isPinOn ? "خاموش کردن" : "روشن کردن"}`;
}

/**
 * Full-card tactile Smart Home button built on ReUI's Toggle primitive.
 * Turns the entire segment tile into an easy-to-press touch button for wall panels,
 * tablets, and mobile phones while presenting minimal device identity and live status.
 */
export default function PinToggle({
  segment,
  isPinOn,
  buttonProps,
  animationsEnabled = true,
  isCompact = false,
  isUltraCompact = false,
  hasExternalHeader = false,
  mode = "switch",
  countdown,
}: PinToggleProps) {
  const SegmentIcon = getSegmentIcon(segment.icon);
  const density = getPinToggleDensity(isUltraCompact, isCompact, hasExternalHeader);
  const ariaLabel = getPinToggleAriaLabel(segment.title, isPinOn, mode);

  const surfaceTone = isPinOn
    ? "bg-[var(--accent3-transparent)] hover:bg-[var(--accent3-transparent)] aria-pressed:bg-[var(--accent3-transparent)] data-[state=on]:bg-[var(--accent3-transparent)] text-[var(--text-primary)]"
    : "bg-transparent hover:bg-[var(--card-hover-bg)] aria-pressed:bg-transparent data-[state=on]:bg-transparent text-[var(--text-primary)]";

  const badgeTone = isPinOn
    ? "bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-xs"
    : "bg-[var(--secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]";

  const showEmojiIcon = Boolean(segment.icon) && !hasIcon(segment.icon);
  const radiusClass = hasExternalHeader ? "rounded-none rounded-b-[15px]" : "rounded-xl";
  const topRowInsetClass = hasExternalHeader ? "" : "pl-14";

  return (
    <Toggle
      pressed={isPinOn}
      {...buttonProps}
      aria-label={ariaLabel}
      className={`switch-toggle group/tile relative flex flex-col items-stretch justify-between w-full h-full text-right whitespace-normal font-sans transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.98] cursor-pointer select-none ${radiusClass} ${density.container} ${surfaceTone}`}
    >
      {/* Top Row: Device Icon Badge & Title */}
      <div className={`flex items-center gap-2.5 sm:gap-3 w-full min-w-0 ${topRowInsetClass}`}>
        <div
          aria-hidden="true"
          className={`flex items-center justify-center rounded-xl transition-colors shrink-0 ${density.badge} ${badgeTone}`}
        >
          {showEmojiIcon ? (
            <span className="text-sm leading-none flex items-center justify-center w-5 h-5">
              {segment.icon}
            </span>
          ) : (
            React.createElement(SegmentIcon, { className: density.icon })
          )}
        </div>

        <div className="min-w-0 flex-1 text-right">
          <span
            className={`block font-sans font-bold theme-text-primary truncate leading-snug ${density.title}`}
          >
            {segment.title}
          </span>
        </div>
      </div>

      {/* Bottom Row: Minimal Status, Pin, Timer & Visual Switch/Push Indicator */}
      <CardFooter
        segment={segment}
        isPinOn={isPinOn}
        mode={mode}
        countdown={countdown}
        animationsEnabled={animationsEnabled}
        isCompact={isCompact}
        isUltraCompact={isUltraCompact}
        hasExternalHeader={hasExternalHeader}
      />
    </Toggle>
  );
}
