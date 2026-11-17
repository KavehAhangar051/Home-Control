import React, { type ComponentPropsWithoutRef } from "react";
import type { Toggle } from "@/components/ui/toggle";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { getSegmentTileDensity } from "../core/segmentTileDensity";
import type { SegmentData } from "../core/types";
import PinToggle from "./PinToggle";

type PinToggleButtonProps = Omit<ComponentPropsWithoutRef<typeof Toggle>, "pressed" | "className">;

interface CardBodyProps {
  segment: SegmentData;
  isPinOn: boolean;
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

  const badgeTone = isPinOn
    ? "bg-success text-success-foreground"
    : "bg-secondary text-text-secondary border border-border-color";

  const showEmojiIcon = Boolean(segment.icon) && !hasIcon(segment.icon);
  const radiusClass = hasExternalHeader ? "rounded-none rounded-b-[15px]" : "rounded-xl";
  const topRowInsetClass = hasExternalHeader ? "" : "pe-14";

  return (
    <div
      data-animate-icon-parent
      className={`flex flex-col justify-between size-full text-right select-none ${radiusClass} ${density.container}`}
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
          hasExternalHeader || isCompact || isUltraCompact ? "pt-1" : "pt-2"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`size-2 rounded-full shrink-0 ${
              isPinOn ? "bg-success animate-pulse" : "bg-text-muted opacity-45"
            }`}
          />
          <span className="text-xs font-sans font-medium tabular-nums truncate">
            {isPinOn ? "ورودی فعال (۱)" : "ورودی غیرفعال (۰)"}
          </span>
        </div>

        {!isUltraCompact && (
          <span
            className="rounded border border-border-color bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-normal tabular-nums text-text-muted shrink-0"
            dir="ltr"
          >
            GPIO {segment.pin}
          </span>
        )}
      </div>
    </div>
  );
}

function CardBody({
  segment,
  isPinOn,
  isCompact,
  isUltraCompact,
  hasExternalHeader = false,
  mode,
  buttonProps,
  animationsEnabled = true,
  countdown,
}: CardBodyProps) {
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
      ) : (
        <PinToggle
          segment={segment}
          isPinOn={isPinOn}
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
