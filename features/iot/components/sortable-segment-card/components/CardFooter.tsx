import { memo } from "react";
import type { SegmentData } from "../core/types";

interface CardFooterProps {
  segment: SegmentData;
  isPinOn: boolean;
  isPending?: boolean;
  mode: "switch" | "push";
  countdown?: number | null;
  animationsEnabled?: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
  hasExternalHeader?: boolean;
}

function getStatusText(
  isPinOn: boolean,
  mode: "switch" | "push",
  countdown?: number | null,
): string {
  if (countdown !== null && countdown !== undefined) {
    return `${countdown} ثانیه تا خاموشی`;
  }

  if (mode === "push") {
    return isPinOn ? "در حال فرمان..." : "شستی لحظه‌ای";
  }

  return isPinOn ? "روشن" : "خاموش";
}

function getStatusDotClass(isPinOn: boolean, mode: "switch" | "push", isPending = false): string {
  if (isPending) return "bg-accent3 animate-pulse";

  if (!isPinOn) return "bg-text-muted opacity-45";

  return mode === "push" ? "bg-accent3 animate-ping" : "bg-success";
}

function PushModeBadge({ isPinOn, isSmallTrack }: { isPinOn: boolean; isSmallTrack: boolean }) {
  const sizeClass = isSmallTrack ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs";

  const toneClass = isPinOn
    ? "bg-accent3 text-accent3-foreground border-accent3"
    : "bg-secondary text-text-secondary border-border-color";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-sans font-medium shrink-0 border transition-colors duration-150 ${sizeClass} ${toneClass}`}
    >
      {isPinOn ? "فعال" : "شستی"}
    </span>
  );
}

function SwitchModeTrack({
  isPinOn,
  isSmallTrack,
  animationsEnabled,
}: {
  isPinOn: boolean;
  isSmallTrack: boolean;
  animationsEnabled: boolean;
}) {
  const trackSize = isSmallTrack ? "h-5 w-9 rounded-[6px]" : "h-6 w-11 rounded-[7px]";

  const trackTone = isPinOn
    ? "bg-accent3 border border-transparent dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
    : "bg-input border border-border-color";

  const thumbSize = isSmallTrack ? "size-[14px] rounded-[4px]" : "size-[18px] rounded-[5px]";

  const thumbTone = isPinOn ? "bg-accent3-foreground" : "bg-card-bg-solid dark:bg-foreground";

  const thumbOffset = isPinOn
    ? "translate-x-0"
    : isSmallTrack
      ? "-translate-x-4"
      : "-translate-x-5";

  const motionClass = animationsEnabled
    ? "transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]"
    : "";

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-start p-0.5 transition-colors duration-150 ${trackSize} ${trackTone}`}
    >
      <span
        className={`pointer-events-none inline-block shadow-2xs transform ${thumbSize} ${thumbTone} ${motionClass} ${thumbOffset}`}
      />
    </span>
  );
}

/**
 * Renders the bottom status and tactile switch/push indicator row inside the
 * full-card Smart Home button tile.
 */
function CardFooter({
  segment,
  isPinOn,
  isPending = false,
  mode,
  countdown,
  animationsEnabled = true,
  isCompact = false,
  isUltraCompact = false,
  hasExternalHeader = false,
}: CardFooterProps) {
  const autoOffValue = segment.auto_off || 0;
  const isSmallTrack = isCompact || isUltraCompact;
  const statusText = getStatusText(isPinOn, mode, countdown);
  const dotClass = getStatusDotClass(isPinOn, mode, isPending);

  const showAutoOffBadge =
    !isUltraCompact && autoOffValue > 0 && (countdown === null || countdown === undefined);

  return (
    <div
      className={`flex w-full items-center justify-between gap-2 ${
        hasExternalHeader || isSmallTrack ? "pt-1" : "pt-2"
      }`}
    >
      {/* RTL Right: Minimal Live Status + Signature GPIO Keycap Metadata */}
      <div className="flex items-center gap-1.5 min-w-0 text-right">
        <span
          className={`size-2 rounded-full shrink-0 transition-colors duration-150 ${dotClass}`}
        />
        <span
          className={`font-sans font-medium tabular-nums truncate ${
            isUltraCompact ? "text-[11px]" : "text-xs"
          } ${isPinOn ? "text-text-primary" : "text-text-muted"}`}
        >
          {statusText}
        </span>
        {!isUltraCompact && (
          <span
            className="rounded border border-border-color bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-normal tabular-nums text-text-muted shrink-0"
            dir="ltr"
          >
            GPIO {segment.pin}
          </span>
        )}
        {showAutoOffBadge && (
          <span
            className="rounded border border-border-color bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-normal tabular-nums text-text-secondary shrink-0"
            dir="ltr"
          >
            {autoOffValue}s
          </span>
        )}
      </div>

      {/* RTL Left: Clear Visual Switch Track or Push Keycap Indicator */}
      {mode === "push" ? (
        <PushModeBadge isPinOn={isPinOn} isSmallTrack={isSmallTrack} />
      ) : (
        <SwitchModeTrack
          isPinOn={isPinOn}
          isSmallTrack={isSmallTrack}
          animationsEnabled={animationsEnabled}
        />
      )}
    </div>
  );
}

export default memo(CardFooter);
