import type { SegmentData } from "../core/types";

interface CardFooterProps {
  segment: SegmentData;
  isPinOn: boolean;
  mode: "switch" | "push";
  countdown?: number | null;
  animationsEnabled?: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
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

function getStatusDotClass(isPinOn: boolean, mode: "switch" | "push"): string {
  if (!isPinOn) return "bg-[var(--text-muted)] opacity-45";

  return mode === "push" ? "bg-[var(--accent3)] animate-ping" : "bg-emerald-500";
}

function PushModeBadge({ isPinOn, isSmallTrack }: { isPinOn: boolean; isSmallTrack: boolean }) {
  const sizeClass = isSmallTrack ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]";

  const toneClass = isPinOn
    ? "bg-[var(--accent3)] text-[var(--accent3-foreground)] border-[var(--accent3)]"
    : "bg-[var(--secondary)] text-[var(--text-secondary)] border-[var(--border-color)]";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg font-sans font-bold shrink-0 border transition-colors ${sizeClass} ${toneClass}`}
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
  const trackSize = isSmallTrack ? "h-5 w-9" : "h-6 w-11";

  const trackTone = isPinOn
    ? "bg-[var(--accent3)]"
    : "bg-[var(--input)] border border-[var(--border-color)]";

  const thumbSize = isSmallTrack ? "h-4 w-4" : "h-5 w-5";
  const thumbTone = isPinOn ? "bg-[var(--accent3-foreground)]" : "bg-white dark:bg-neutral-200";

  const thumbOffset = isPinOn
    ? "translate-x-0"
    : isSmallTrack
      ? "-translate-x-4"
      : "-translate-x-5";

  const motionClass = animationsEnabled
    ? "transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
    : "";

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-start rounded-full p-0.5 transition-colors ${trackSize} ${trackTone}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full shadow-xs transform ${thumbSize} ${thumbTone} ${motionClass} ${thumbOffset}`}
      />
    </span>
  );
}

/**
 * Renders the bottom status and tactile switch/push indicator row inside the
 * full-card Smart Home button tile.
 */
export default function CardFooter({
  segment,
  isPinOn,
  mode,
  countdown,
  animationsEnabled = true,
  isCompact = false,
  isUltraCompact = false,
}: CardFooterProps) {
  const autoOffValue = segment.auto_off || 0;
  const isSmallTrack = isCompact || isUltraCompact;
  const statusText = getStatusText(isPinOn, mode, countdown);
  const dotClass = getStatusDotClass(isPinOn, mode);

  const showAutoOffBadge =
    !isUltraCompact && autoOffValue > 0 && (countdown === null || countdown === undefined);

  return (
    <div className="flex w-full items-center justify-between gap-2 pt-2">
      {/* RTL Right: Minimal Live Status + Pin Metadata */}
      <div className="flex items-center gap-1.5 min-w-0 text-right">
        <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${dotClass}`} />
        <span
          className={`font-sans font-bold truncate ${
            isUltraCompact ? "text-[11px]" : "text-xs"
          } ${isPinOn ? "theme-text-primary" : "text-[var(--text-muted)]"}`}
        >
          {statusText}
        </span>
        {!isUltraCompact && (
          <span className="text-[11px] font-medium tabular-nums text-[var(--text-muted)] shrink-0">
            · پایه {segment.pin}
          </span>
        )}
        {showAutoOffBadge && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums bg-[var(--secondary)] text-[var(--text-secondary)] shrink-0">
            {autoOffValue}s
          </span>
        )}
      </div>

      {/* RTL Left: Clear Visual Switch Track or Push Pill Indicator */}
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
