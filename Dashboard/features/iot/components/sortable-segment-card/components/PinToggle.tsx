import React, { type ComponentPropsWithoutRef } from "react";
import { Toggle } from "@/components/ui/toggle";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { triggerHaptic } from "@/lib/haptics";
import { getSegmentTileDensity } from "../core/segmentTileDensity";
import type { SegmentData } from "../core/types";
import CardFooter from "./CardFooter";

type PinToggleButtonProps = Pick<
  ComponentPropsWithoutRef<"button">,
  "onClick" | "onPointerDown" | "onPointerUp" | "onPointerLeave" | "onPointerCancel"
>;

interface PinToggleProps {
  segment: SegmentData;
  isPinOn: boolean;
  isPending?: boolean;
  isAckFlashing?: boolean;
  buttonProps: PinToggleButtonProps;
  animationsEnabled?: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
  hasExternalHeader?: boolean;
  mode?: "switch" | "push";
  countdown?: number | null;
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
function PinToggle({
  segment,
  isPinOn,
  isPending = false,
  isAckFlashing = false,
  buttonProps,
  animationsEnabled = true,
  isCompact = false,
  isUltraCompact = false,
  hasExternalHeader = false,
  mode = "switch",
  countdown,
}: PinToggleProps) {
  const SegmentIcon = getSegmentIcon(segment.icon);
  const density = getSegmentTileDensity(isUltraCompact, isCompact, hasExternalHeader);
  const ariaLabel = getPinToggleAriaLabel(segment.title, isPinOn, mode);

  const handleToggleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    buttonProps.onClick?.(event);
    triggerHaptic(mode === "push" ? "push" : isPinOn ? "toggleOff" : "toggleOn");
  };

  const surfaceTone = isPinOn
    ? "bg-accent3-transparent hover:bg-accent3-transparent aria-pressed:bg-accent3-transparent data-[state=on]:bg-accent3-transparent text-text-primary dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
    : "bg-transparent hover:bg-card-hover-bg aria-pressed:bg-transparent data-[state=on]:bg-transparent text-text-primary";

  const badgeTone = isPinOn
    ? "bg-accent3 text-accent3-foreground dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
    : "bg-secondary text-text-secondary border border-border-color";

  const showEmojiIcon = Boolean(segment.icon) && !hasIcon(segment.icon);
  const radiusClass = hasExternalHeader ? "rounded-none rounded-b-[15px]" : "rounded-xl";
  const topRowInsetClass = hasExternalHeader ? "" : "pe-14";

  return (
    <Toggle
      pressed={isPinOn}
      {...buttonProps}
      onClick={handleToggleClick}
      aria-label={ariaLabel}
      aria-busy={isPending || undefined}
      className={`switch-toggle group/tile relative flex flex-col items-stretch justify-between size-full text-right whitespace-normal font-sans transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] pointer-fine:active:scale-[0.98] cursor-pointer select-none ${radiusClass} ${density.container} ${surfaceTone}`}
    >
      {/* Top Row: Device Icon Badge & Title */}
      <div className={`flex items-center gap-2.5 sm:gap-3 w-full min-w-0 ${topRowInsetClass}`}>
        <div
          aria-hidden="true"
          className={`flex items-center justify-center rounded-lg transition-colors duration-150 shrink-0 ${density.badge} ${badgeTone}`}
        >
          {showEmojiIcon ? (
            <span className="text-sm leading-none flex items-center justify-center size-5">
              {segment.icon}
            </span>
          ) : (
            React.createElement(SegmentIcon, { className: density.icon, strokeWidth: 1.5 })
          )}
        </div>

        <div className="min-w-0 flex-1 text-right">
          <span
            className={`block font-sans font-medium text-text-primary truncate leading-snug ${density.title}`}
          >
            {segment.title}
          </span>
        </div>
      </div>

      {/* Bottom Row: Minimal Status, Pin, Timer & Visual Switch/Push Indicator */}
      <CardFooter
        segment={segment}
        isPinOn={isPinOn}
        isPending={isPending}
        isAckFlashing={isAckFlashing}
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

export default React.memo(PinToggle);
