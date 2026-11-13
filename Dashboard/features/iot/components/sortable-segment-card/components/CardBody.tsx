import React, { type ComponentPropsWithoutRef } from "react";
import type { Toggle } from "@/components/ui/toggle";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import type { SegmentData } from "../core/types";
import PinToggle from "./PinToggle";

type PinToggleButtonProps = Omit<ComponentPropsWithoutRef<typeof Toggle>, "pressed" | "className">;

interface CardBodyProps {
  segment: SegmentData;
  isPinOn: boolean;
  isCompact: boolean;
  isUltraCompact: boolean;
  isMobileTwoCol?: boolean;
  densityFactor?: number;
  mode: "switch" | "push";
  buttonProps: PinToggleButtonProps;
  animationsEnabled?: boolean;
  countdown?: number | null;
}

function getInputDensityClasses(isUltraCompact: boolean, isCompact: boolean) {
  if (isUltraCompact) {
    return {
      container: "min-h-[78px] p-2.5 gap-2",
      badge: "w-8 h-8",
      icon: "w-4 h-4",
      title: "text-xs",
    };
  }

  if (isCompact) {
    return {
      container: "min-h-[96px] p-3 gap-2.5",
      badge: "w-9 h-9",
      icon: "w-4.5 h-4.5",
      title: "text-xs sm:text-sm",
    };
  }

  return {
    container: "min-h-[108px] p-3.5 sm:p-4 gap-3",
    badge: "w-10 h-10 sm:w-11 sm:h-11",
    icon: "w-5 h-5",
    title: "text-sm sm:text-[15px]",
  };
}

export function InputSegmentBody({
  segment,
  isPinOn,
  isCompact = false,
  isUltraCompact = false,
}: {
  segment: SegmentData;
  isPinOn: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
}) {
  const SegmentIcon = getSegmentIcon(segment.icon);
  const density = getInputDensityClasses(isUltraCompact, isCompact);

  const badgeTone = isPinOn
    ? "bg-emerald-600 text-white shadow-xs"
    : "bg-[var(--secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]";

  const showEmojiIcon = Boolean(segment.icon) && !hasIcon(segment.icon);

  return (
    <div
      data-animate-icon-parent
      className={`flex flex-col justify-between w-full h-full rounded-xl text-right select-none ${density.container}`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 w-full pl-14 min-w-0">
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

      <div className="flex items-center justify-between w-full gap-2 pt-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isPinOn ? "bg-emerald-500 animate-pulse" : "bg-[var(--text-muted)] opacity-45"
            }`}
          />
          <span className="text-xs font-sans font-bold tabular-nums truncate">
            {isPinOn ? "ورودی فعال (۱)" : "ورودی غیرفعال (۰)"}
          </span>
        </div>

        {!isUltraCompact && (
          <span className="text-[11px] font-medium tabular-nums text-[var(--text-muted)] shrink-0">
            پایه {segment.pin}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CardBody({
  segment,
  isPinOn,
  isCompact,
  isUltraCompact,
  mode,
  buttonProps,
  animationsEnabled = true,
  countdown,
}: CardBodyProps) {
  return (
    <div className="w-full h-full flex-1 flex items-stretch">
      {segment.type === "input" ? (
        <InputSegmentBody
          segment={segment}
          isPinOn={isPinOn}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
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
          countdown={countdown}
        />
      )}
    </div>
  );
}
