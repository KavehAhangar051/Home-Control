import React, { type ComponentPropsWithoutRef } from "react";
import type { Toggle } from "@/components/ui/toggle";
import { isAnalogOutputSegment } from "@/features/iot/utils/analogOutput";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { getSegmentTileDensity } from "../core/segmentTileDensity";
import type { SegmentData } from "../core/types";
import AnalogOutputBody from "./AnalogOutputBody";
import PinToggle from "./PinToggle";

type PinToggleButtonProps = Omit<ComponentPropsWithoutRef<typeof Toggle>, "pressed" | "className">;

interface CardBodyProps {
  segment: SegmentData;
  isPinOn: boolean;
  isPending?: boolean;
  isCompact: boolean;
  isUltraCompact: boolean;
  hasExternalHeader?: boolean;
  isMobileTwoCol?: boolean;
  densityFactor?: number;
  mode: "switch" | "push";
  buttonProps: PinToggleButtonProps;
  animationsEnabled?: boolean;
  countdown?: number | null;
}

export function InputSegmentBody({
  segment,
  isPinOn,
  isCompact = false,
  isUltraCompact = false,
  hasExternalHeader = false,
}: {
  segment: SegmentData;
  isPinOn: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
  hasExternalHeader?: boolean;
}) {
  const SegmentIcon = getSegmentIcon(segment.icon);
  const density = getSegmentTileDensity(isUltraCompact, isCompact, hasExternalHeader);
  const isSmallTrack = isCompact || isUltraCompact;

  const surfaceTone = isPinOn
    ? "bg-accent3-transparent text-text-primary dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
    : "bg-transparent text-text-primary";

  const badgeTone = isPinOn
    ? "bg-accent3 text-accent3-foreground dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
    : "bg-secondary text-text-secondary border border-border-color";

  const inputBadgeSize = isSmallTrack ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs";
  const inputBadgeTone = isPinOn
    ? "bg-accent3 text-accent3-foreground border-accent3"
    : "bg-secondary text-text-secondary border-border-color";

  const showEmojiIcon = Boolean(segment.icon) && !hasIcon(segment.icon);
  const radiusClass = hasExternalHeader ? "rounded-none rounded-b-[15px]" : "rounded-xl";
  const topRowInsetClass = hasExternalHeader ? "" : "pe-14";

  return (
    <div
      data-animate-icon-parent
      className={`flex flex-col justify-between size-full text-right select-none transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${radiusClass} ${density.container} ${surfaceTone}`}
    >
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

      <div
        className={`flex items-center justify-between w-full gap-2 ${
          hasExternalHeader || isSmallTrack ? "pt-1" : "pt-2"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 text-right">
          <span
            className={`size-2 rounded-full shrink-0 transition-colors duration-150 ${
              isPinOn ? "bg-success" : "bg-text-muted opacity-45"
            }`}
          />
          <span
            className={`font-sans font-medium tabular-nums truncate ${
              isUltraCompact ? "text-[11px]" : "text-xs"
            } ${isPinOn ? "text-text-primary" : "text-text-muted"}`}
          >
            {isPinOn ? "فعال (۱)" : "غیرفعال (۰)"}
          </span>
          {!isUltraCompact && (
            <span
              className="rounded border border-border-color bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-normal tabular-nums text-text-muted shrink-0"
              dir="ltr"
            >
              GPIO {segment.pin}
            </span>
          )}
        </div>

        <span
          className={`inline-flex items-center justify-center rounded-md font-sans font-medium shrink-0 border transition-colors duration-150 ${inputBadgeSize} ${inputBadgeTone}`}
        >
          ورودی
        </span>
      </div>
    </div>
  );
}

function CardBody({
  segment,
  isPinOn,
  isPending = false,
  isCompact,
  isUltraCompact,
  hasExternalHeader = false,
  mode,
  buttonProps,
  animationsEnabled = true,
  countdown,
}: CardBodyProps) {
  const handleAnalogPowerToggle = () => {
    if (buttonProps.onClick) {
      // SAFETY: Analog power button triggers the same click handler prepared by useSegmentButtonProps
      (buttonProps.onClick as () => void)();
    }
  };

  return (
    <div className="size-full flex-1 flex items-stretch">
      {segment.type === "input" ? (
        <InputSegmentBody
          segment={segment}
          isPinOn={isPinOn}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          hasExternalHeader={hasExternalHeader}
        />
      ) : isAnalogOutputSegment(segment) ? (
        <AnalogOutputBody
          segment={segment}
          isPinOn={isPinOn}
          isPending={isPending}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          hasExternalHeader={hasExternalHeader}
          countdown={countdown}
          onTogglePower={handleAnalogPowerToggle}
        />
      ) : (
        <PinToggle
          segment={segment}
          isPinOn={isPinOn}
          isPending={isPending}
          mode={mode}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          hasExternalHeader={hasExternalHeader}
          countdown={countdown}
        />
      )}
    </div>
  );
}

export default React.memo(CardBody);
