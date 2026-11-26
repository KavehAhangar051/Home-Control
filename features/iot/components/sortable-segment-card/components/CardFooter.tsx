import { memo } from "react";
import { GrainToggleEffect } from "@/components/dissolve/toggle";
import { formatSegmentPinLabel } from "@/features/iot/utils/auxNodeUtils";
import type { SegmentData } from "../core/types";

interface CardFooterProps {
  segment: SegmentData;
  isPinOn: boolean;
  isPending?: boolean;
  isAckFlashing?: boolean;
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

function getStatusDotClass(
  isPinOn: boolean,
  mode: "switch" | "push",
  isPending = false,
  isAckFlashing = false,
): string {
  if (isAckFlashing) return "bg-success ring-4 ring-success/35 scale-125 transform-gpu";

  if (isPending) return "bg-accent3 animate-pulse transform-gpu";

  if (!isPinOn) return "bg-text-muted opacity-45";

  return mode === "push" ? "bg-accent3 animate-ping transform-gpu" : "bg-success";
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
  return (
    <GrainToggleEffect
      value={isPinOn}
      size="sm"
      onColor="var(--accent3)"
      offColor="var(--input)"
      reducedMotion={!animationsEnabled}
      className={isSmallTrack ? "scale-[0.86]" : "scale-100"}
    />
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
  isAckFlashing = false,
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
  const dotClass = getStatusDotClass(isPinOn, mode, isPending, isAckFlashing);

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
          className={`size-2 rounded-full shrink-0 transition-[background-color,transform,box-shadow,opacity] duration-200 ${dotClass}`}
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
            className="rounded border border-accent4/30 bg-accent4-transparent px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-accent4 shrink-0"
            dir="ltr"
          >
            {formatSegmentPinLabel(segment, isCompact)}
          </span>
        )}
        {showAutoOffBadge && (
          <span
            className="rounded border border-accent4/35 bg-accent4-transparent px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-accent4 shrink-0"
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
