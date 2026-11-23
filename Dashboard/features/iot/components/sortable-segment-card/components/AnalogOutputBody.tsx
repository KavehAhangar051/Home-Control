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
import {
  cancelAnalogRamp,
  commitAnalogPinRamp,
  driveAnalogPinRamp,
  resolveAnalogRampTransportMode,
} from "@/features/iot/utils/analogRamp";
import { formatSegmentPinLabel } from "@/features/iot/utils/auxNodeUtils";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { getSegmentTileDensity } from "../core/segmentTileDensity";
import type { SegmentData } from "../core/types";

const LOCAL_SETTLE_GUARD_MS = 380;
const MQTT_SETTLE_GUARD_MS = 1400;
const INITIAL_COMMIT_GUARD_MS = 1800;

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
 * with a transport-aware eased PWM ramp (Opcode `0x0A`, QoS 0 intermediate steps +
 * reliable commit on release) and a stale-echo settle guard for high-latency links.
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
  const lowDataMode = useIoTStore((s) => s.lowDataMode);

  const resolution = clampPwmResolution(liveResolution ?? segment.pwmResolution);
  const maxDuty = getAnalogMaxDuty(resolution);

  const storeDuty =
    liveAnalogValue !== undefined
      ? clampAnalogValue(liveAnalogValue, resolution)
      : isPinOn
        ? clampAnalogValue(liveLastNonZero ?? segment.analogValue ?? maxDuty, resolution)
        : 0;

  const [draftDuty, setDraftDuty] = useState<number | null>(null);
  const [settledDuty, setSettledDuty] = useState<number | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const armSettleTimer = useCallback(
    (durationMs: number) => {
      clearSettleTimer();
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        if (isMountedRef.current) {
          setSettledDuty(null);
        }
      }, durationMs);
    },
    [clearSettleTimer],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearSettleTimer();
    };
  }, [clearSettleTimer]);

  const displayDuty = draftDuty ?? settledDuty ?? storeDuty;
  const effectiveOn =
    draftDuty !== null
      ? draftDuty > 0
      : settledDuty !== null
        ? settledDuty > 0
        : isPinOn || storeDuty > 0;
  const percent = analogDutyToPercent(displayDuty, resolution);

  const buildDispatchers = useCallback(() => {
    const pin = segment.pin;
    return {
      sendStep: (duty: number) => {
        if (!handleSetPinAnalogValue || !pin) return;
        void handleSetPinAnalogValue(pin, duty, {
          persistToCloud: false,
          qosOverride: 0,
          skipStoreUpdate: true,
        });
      },
      sendCommit: (duty: number) => {
        if (!handleSetPinAnalogValue || !pin) return;
        const transportMode = resolveAnalogRampTransportMode(lowDataMode);
        const postCommitGuardMs =
          transportMode === "local" ? LOCAL_SETTLE_GUARD_MS : MQTT_SETTLE_GUARD_MS;
        if (isMountedRef.current) {
          armSettleTimer(postCommitGuardMs);
        }
        void handleSetPinAnalogValue(pin, duty, { persistToCloud: true }).then((delivered) => {
          if (delivered === false && isMountedRef.current) {
            clearSettleTimer();
            setSettledDuty(null);
          }
        });
      },
    };
  }, [armSettleTimer, clearSettleTimer, handleSetPinAnalogValue, lowDataMode, segment.pin]);

  const dispatchSmoothDuty = useCallback(
    (nextDuty: number) => {
      const clamped = clampAnalogValue(nextDuty, resolution);
      clearSettleTimer();
      setSettledDuty(null);
      setDraftDuty(clamped);

      if (!handleSetPinAnalogValue || !segment.pin) return;

      driveAnalogPinRamp(
        segment.pin,
        clamped,
        resolution,
        storeDuty,
        lowDataMode,
        buildDispatchers(),
      );
    },
    [
      buildDispatchers,
      clearSettleTimer,
      handleSetPinAnalogValue,
      lowDataMode,
      resolution,
      segment.pin,
      storeDuty,
    ],
  );

  const commitSmoothDuty = useCallback(
    (finalDuty: number) => {
      const clamped = clampAnalogValue(finalDuty, resolution);
      setDraftDuty(null);
      setSettledDuty(clamped);
      armSettleTimer(INITIAL_COMMIT_GUARD_MS);

      if (!handleSetPinAnalogValue || !segment.pin) return;

      commitAnalogPinRamp(
        segment.pin,
        clamped,
        resolution,
        storeDuty,
        lowDataMode,
        buildDispatchers(),
      );
    },
    [
      armSettleTimer,
      buildDispatchers,
      handleSetPinAnalogValue,
      lowDataMode,
      resolution,
      segment.pin,
      storeDuty,
    ],
  );

  const handlePowerClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      cancelAnalogRamp(segment.pin);
      clearSettleTimer();
      setDraftDuty(null);
      setSettledDuty(null);
      onTogglePower(e);
    },
    [clearSettleTimer, onTogglePower, segment.pin],
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
          onClick={handlePowerClick}
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
              onClick={handlePowerClick}
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
                {formatSegmentPinLabel(segment, isCompact)}
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
            onValueChange={dispatchSmoothDuty}
            onValueCommit={commitSmoothDuty}
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
          onClick={handlePowerClick}
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
