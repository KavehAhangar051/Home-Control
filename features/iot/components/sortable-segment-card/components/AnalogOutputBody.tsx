"use client";

import { Power } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { useOptionalDashboard } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { getSegmentTileDensity } from "../core/segmentTileDensity";
import type { SegmentData } from "../core/types";

const ANALOG_SLIDER_THROTTLE_MS = 100;

interface AnalogOutputBodyProps {
  segment: SegmentData;
  isPinOn: boolean;
  isPending?: boolean;
  isAckFlashing?: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
  hasExternalHeader?: boolean;
  countdown?: number | null;
  onTogglePower: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPowerPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

/**
 * Interactive PWM / LEDC dimmer card body for `analog_output` segments.
 * Pairs a fast boolean Power toggle (Opcode `0x01`, restoring `lastNonZeroValue`)
 * with a 100ms-throttled PWM duty slider (Opcode `0x0A` + immediate flush on release).
 */
function AnalogOutputBody({
  segment,
  isPinOn,
  isPending = false,
  isAckFlashing = false,
  isCompact = false,
  isUltraCompact = false,
  hasExternalHeader = false,
  countdown,
  onTogglePower,
  onPowerPointerDown,
}: AnalogOutputBodyProps) {
  const dashboard = useOptionalDashboard();
  const handleSetPinAnalogValue = dashboard?.handleSetPinAnalogValue;

  const liveAnalogValue = useIoTStore((s) => s.pinsAnalogValue[segment.pin]);
  const liveLastNonZero = useIoTStore((s) => s.pinsLastNonZeroValue[segment.pin]);
  const liveResolution = useIoTStore((s) => s.pinsPwmResolution[segment.pin]);

  const resolution = clampPwmResolution(liveResolution ?? segment.pwmResolution);
  const maxDuty = getAnalogMaxDuty(resolution);

  const storeDuty =
    liveAnalogValue !== undefined
      ? clampAnalogValue(liveAnalogValue, resolution)
      : isPinOn
        ? clampAnalogValue(liveLastNonZero ?? segment.analogValue ?? maxDuty, resolution)
        : 0;

  const [draftDuty, setDraftDuty] = useState<number | null>(null);
  const lastSentAtRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<number>(storeDuty);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  const displayDuty = draftDuty !== null ? draftDuty : storeDuty;
  const effectiveOn = draftDuty !== null ? draftDuty > 0 : isPinOn || storeDuty > 0;
  const percent = analogDutyToPercent(displayDuty, resolution);

  const dispatchThrottledDuty = useCallback(
    (nextDuty: number) => {
      const clamped = clampAnalogValue(nextDuty, resolution);
      latestDraftRef.current = clamped;
      setDraftDuty(clamped);

      if (!handleSetPinAnalogValue || !segment.pin) return;

      const now = Date.now();
      const elapsed = now - lastSentAtRef.current;

      if (elapsed >= ANALOG_SLIDER_THROTTLE_MS) {
        if (pendingTimerRef.current !== null) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        lastSentAtRef.current = now;
        void handleSetPinAnalogValue(segment.pin, clamped, { persistToCloud: false });
      } else if (pendingTimerRef.current === null) {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          lastSentAtRef.current = Date.now();
          void handleSetPinAnalogValue(segment.pin, latestDraftRef.current, {
            persistToCloud: false,
          });
        }, ANALOG_SLIDER_THROTTLE_MS - elapsed);
      }
    },
    [handleSetPinAnalogValue, resolution, segment.pin],
  );

  const commitFinalDuty = useCallback(
    (finalDuty: number) => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }

      const clamped = clampAnalogValue(finalDuty, resolution);
      latestDraftRef.current = clamped;
      lastSentAtRef.current = Date.now();
      setDraftDuty(null);

      if (handleSetPinAnalogValue && segment.pin) {
        void handleSetPinAnalogValue(segment.pin, clamped, { persistToCloud: true });
      }
    },
    [handleSetPinAnalogValue, resolution, segment.pin],
  );

  const SegmentIcon = getSegmentIcon(segment.icon);
  const density = getSegmentTileDensity(isUltraCompact, isCompact, hasExternalHeader);
  const showEmojiIcon = Boolean(segment.icon) && !hasIcon(segment.icon);
  const radiusClass = hasExternalHeader ? "rounded-none rounded-b-[15px]" : "rounded-xl";
  const topRowInsetClass = hasExternalHeader ? "" : "pe-14";

  const surfaceTone = effectiveOn
    ? "bg-accent3-transparent text-text-primary dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
    : "bg-transparent text-text-primary";

  const badgeTone = effectiveOn
    ? "bg-accent3 text-accent3-foreground dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
    : "bg-secondary text-text-secondary border border-border-color";

  const statusDotClass = isAckFlashing
    ? "bg-success ring-4 ring-success/35 scale-125 transform-gpu"
    : isPending
      ? "bg-accent3 animate-pulse transform-gpu"
      : effectiveOn
        ? "bg-success"
        : "bg-text-muted opacity-45";

  const autoOffValue = segment.auto_off || 0;
  const showAutoOffBadge =
    !isUltraCompact && autoOffValue > 0 && (countdown === null || countdown === undefined);

  return (
    <div
      data-animate-icon-parent
      className={`flex flex-col justify-between size-full text-right select-none transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${radiusClass} ${density.container} ${surfaceTone}`}
    >
      {/* Top Row: Power Toggle Action (Opcode 0x01) + Title + Live Percent */}
      <div className={`flex items-center gap-2.5 sm:gap-3 w-full min-w-0 ${topRowInsetClass}`}>
        <button
          type="button"
          onPointerDown={onPowerPointerDown}
          onClick={onTogglePower}
          aria-pressed={effectiveOn}
          aria-label={`${segment.title} - ${effectiveOn ? "خاموش کردن" : "روشن کردن"}`}
          className={`flex items-center justify-center rounded-lg transition-[background-color,color,transform] duration-150 pointer-fine:active:scale-[0.95] cursor-pointer shrink-0 ${density.badge} ${badgeTone}`}
        >
          {showEmojiIcon ? (
            <span className="text-sm leading-none flex items-center justify-center size-5">
              {segment.icon}
            </span>
          ) : (
            React.createElement(SegmentIcon, { className: density.icon, strokeWidth: 1.5 })
          )}
        </button>

        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <button
              type="button"
              onPointerDown={onPowerPointerDown}
              onClick={onTogglePower}
              className={`min-w-0 truncate text-right font-sans font-medium text-text-primary leading-snug cursor-pointer hover:text-accent3 transition-colors ${density.title}`}
            >
              {segment.title}
            </button>
            <span
              className={`shrink-0 font-mono font-semibold tabular-nums ${
                isUltraCompact ? "text-[11px]" : "text-xs"
              } ${effectiveOn ? "text-accent3" : "text-text-muted"}`}
              dir="ltr"
            >
              {percent}%
            </span>
          </div>

          {!isUltraCompact && (
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0 text-[11px] text-text-muted">
              <span
                className={`size-1.5 rounded-full shrink-0 transition-[background-color,transform,box-shadow,opacity] duration-200 ${statusDotClass}`}
              />
              <span className="truncate tabular-nums">
                {countdown !== null && countdown !== undefined
                  ? `${countdown} ثانیه تا خاموشی`
                  : effectiveOn
                    ? "روشن (PWM)"
                    : "خاموش"}
              </span>
              <span
                className="rounded border border-border-color bg-secondary px-1 py-0 font-mono text-[10px] tabular-nums text-text-muted shrink-0"
                dir="ltr"
              >
                GPIO {segment.pin}
              </span>
              {showAutoOffBadge && (
                <span
                  className="rounded border border-border-color bg-secondary px-1 py-0 font-mono text-[10px] tabular-nums text-text-secondary shrink-0"
                  dir="ltr"
                >
                  {autoOffValue}s
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Tactile PWM Slider (Opcode 0x0A) + Power Keycap */}
      <div
        className={`flex items-center gap-2 w-full ${
          hasExternalHeader || isCompact || isUltraCompact ? "pt-1" : "pt-2"
        }`}
      >
        <div
          className="min-w-0 flex-1"
          data-canvas-slider="true"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DashboardSlider
            defaultVariant="fluid"
            size={isUltraCompact ? "ultra" : "compact"}
            min={0}
            max={maxDuty}
            step={1}
            value={displayDuty}
            onValueChange={dispatchThrottledDuty}
            onValueCommit={commitFinalDuty}
            label="شدت"
            format={(val) => `${analogDutyToPercent(val, resolution)}%`}
            unit="%"
            rulerScale={{
              min: 0,
              max: 100,
              step: 1,
              majorEvery: 10,
              unit: "%",
              toDisplay: (raw) => analogDutyToPercent(raw, resolution),
              fromDisplay: (pct) => percentToAnalogDuty(pct, resolution),
            }}
            aria-label={`تنظیم شدت ${segment.title}`}
            formatValueText={(val) => `${analogDutyToPercent(val, resolution)} درصد`}
          />
        </div>

        <button
          type="button"
          onPointerDown={onPowerPointerDown}
          onClick={onTogglePower}
          aria-pressed={effectiveOn}
          aria-label={effectiveOn ? `خاموش کردن ${segment.title}` : `روشن کردن ${segment.title}`}
          className={`flex shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color,color,transform] duration-150 pointer-fine:active:scale-[0.94] cursor-pointer ${
            isUltraCompact ? "size-6.5" : isCompact ? "size-7.5" : "size-8.5"
          } ${
            effectiveOn
              ? "border-accent3 bg-accent3 text-accent3-foreground shadow-2xs"
              : "border-border-color bg-secondary text-text-secondary hover:border-accent3/60 hover:text-text-primary"
          }`}
        >
          <Power className={isUltraCompact ? "size-3" : "size-3.5"} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

export default React.memo(AnalogOutputBody);
