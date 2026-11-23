"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "@/components/ui/hugeicons-groups/shell";
import { useOptionalDashboard } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  adcValueToPercent,
  adcValueToVoltage,
  clampAdcResolution,
  clampAdcValue,
  getAdcMaxValue,
  normalizeAdcThresholds,
} from "@/features/iot/utils/analogInput";
import { formatSegmentPinLabel } from "@/features/iot/utils/auxNodeUtils";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { getSegmentTileDensity } from "../core/segmentTileDensity";
import type { SegmentData } from "../core/types";

interface AnalogInputBodyProps {
  segment: SegmentData;
  isPinOn: boolean;
  isCompact?: boolean;
  isUltraCompact?: boolean;
  hasExternalHeader?: boolean;
}

/**
 * Live read-only ADC1 sensor card body for `analog_input` segments.
 * Displays live percentage, approximate voltage (`~0.00V..3.30V`), raw count,
 * a visual Schmitt-Trigger hysteresis bar (`atl` / `ath`), and an instant-read refresh trigger (Opcode `0x0D` / Local WS `read_analog`).
 */
function AnalogInputBody({
  segment,
  isPinOn,
  isCompact = false,
  isUltraCompact = false,
  hasExternalHeader = false,
}: AnalogInputBodyProps) {
  const dashboard = useOptionalDashboard();
  const handleReadAnalogInput = dashboard?.handleReadAnalogInput;

  const liveAnalogValue = useIoTStore((s) => s.pinsAnalogValue[segment.pin]);
  const liveResolution = useIoTStore((s) => s.pinsPwmResolution[segment.pin]);

  const resolution = clampAdcResolution(liveResolution ?? segment.adcResolution);
  const maxVal = getAdcMaxValue(resolution);
  const rawValue = clampAdcValue(liveAnalogValue ?? segment.analogValue ?? 0, resolution);
  const percent = adcValueToPercent(rawValue, resolution);
  const approxVoltage = adcValueToVoltage(rawValue, resolution);

  const { adcHighThreshold, adcLowThreshold } = normalizeAdcThresholds(
    segment.adcHighThreshold,
    segment.adcLowThreshold,
    resolution,
  );
  const hasThreshold = adcHighThreshold > 0;
  const highPct = hasThreshold ? Math.min(100, Math.max(0, (adcHighThreshold / maxVal) * 100)) : 0;
  const lowPct = hasThreshold
    ? Math.min(highPct, Math.max(0, (adcLowThreshold / maxVal) * 100))
    : 0;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const handleInstantRead = useCallback(() => {
    if (!segment.pin || !handleReadAnalogInput) return;

    handleReadAnalogInput(segment.pin);
    setIsRefreshing(true);

    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      setIsRefreshing(false);
    }, 450);
  }, [handleReadAnalogInput, segment.pin]);

  const SegmentIcon = getSegmentIcon(segment.icon);
  const density = getSegmentTileDensity(isUltraCompact, isCompact, hasExternalHeader);
  const showEmojiIcon = Boolean(segment.icon) && !hasIcon(segment.icon);
  const radiusClass = hasExternalHeader ? "rounded-none rounded-b-[15px]" : "rounded-xl";
  const topRowInsetClass = hasExternalHeader ? "" : "pe-14";

  const isAlertHigh = hasThreshold && isPinOn;

  const surfaceTone = isAlertHigh
    ? "bg-accent3-transparent text-text-primary dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
    : "bg-transparent text-text-primary";

  const badgeTone = isAlertHigh
    ? "bg-accent3 text-accent3-foreground dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
    : "bg-secondary text-text-secondary border border-border-color";

  const statusDotClass = hasThreshold
    ? isPinOn
      ? "bg-success"
      : "bg-text-muted opacity-50"
    : "bg-accent3/80";

  return (
    <div
      data-animate-icon-parent
      className={`flex flex-col justify-between size-full text-right select-none transition-[background-color,border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${radiusClass} ${density.container} ${surfaceTone}`}
    >
      {/* Top Row: Sensor Icon + Title + Live Percent / Voltage */}
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
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span
              className={`min-w-0 truncate font-sans font-medium text-text-primary leading-snug ${density.title}`}
            >
              {segment.title}
            </span>
            <div className="flex items-baseline gap-1.5 shrink-0 font-mono tabular-nums" dir="ltr">
              <span
                className={`font-semibold ${isUltraCompact ? "text-[11px]" : "text-xs"} ${
                  isAlertHigh ? "text-accent3" : "text-text-primary"
                }`}
              >
                {percent}%
              </span>
              {!isUltraCompact && (
                <span className="text-[10px] text-text-muted">~{approxVoltage}V</span>
              )}
            </div>
          </div>

          {!isUltraCompact && (
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0 text-[11px] text-text-muted">
              <span className={`size-1.5 rounded-full shrink-0 ${statusDotClass}`} />
              <span className="truncate font-mono tabular-nums" dir="ltr">
                {rawValue}/{maxVal}
              </span>
              {hasThreshold && (
                <span
                  className={`rounded border px-1 py-0 font-mono text-[10px] font-semibold shrink-0 ${
                    isPinOn
                      ? "border-accent3/50 bg-accent3/15 text-accent3"
                      : "border-border-color bg-secondary text-text-muted"
                  }`}
                  dir="ltr"
                >
                  {isPinOn ? "HIGH" : "LOW"}
                </span>
              )}
              <span
                className="rounded border border-border-color bg-secondary px-1 py-0 font-mono text-[10px] tabular-nums text-text-muted shrink-0"
                dir="ltr"
              >
                {formatSegmentPinLabel(segment, isCompact)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Telemetry Meter with Schmitt-Trigger Hysteresis Band + Instant Read Button */}
      <div
        className={`flex items-center gap-2 w-full ${
          hasExternalHeader || isCompact || isUltraCompact ? "pt-1.5" : "pt-2.5"
        }`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <meter
            className="sr-only"
            min={0}
            max={maxVal}
            value={rawValue}
            aria-label={`مقدار سنسور ${segment.title}`}
            aria-valuetext={`${percent} درصد، حدود ${approxVoltage} ولت`}
          />
          <div
            dir="ltr"
            aria-hidden="true"
            title={
              hasThreshold
                ? `مقدار: ${rawValue}/${maxVal} (~${approxVoltage}V) | آستانه پایین: ${adcLowThreshold} | آستانه بالا: ${adcHighThreshold}`
                : `مقدار: ${rawValue}/${maxVal} (~${approxVoltage}V)`
            }
            className={`relative w-full overflow-hidden rounded-md border border-border-color bg-secondary ${
              isUltraCompact ? "h-2.5" : "h-3"
            }`}
          >
            {/* Active Sensor Level Fill (GPU-composited scaleX avoids main-thread width reflow) */}
            <div
              className={`h-full w-full origin-left transition-[transform,background-color] duration-200 ease-out will-change-transform [backface-visibility:hidden] ${
                isAlertHigh ? "bg-accent3" : "bg-accent3/75"
              }`}
              style={{ transform: `scaleX(${percent / 100}) translateZ(0)` }}
            />

            {/* Schmitt-Trigger Hysteresis Dead-Zone Band (atl .. ath) */}
            {hasThreshold && highPct > lowPct && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 bg-warning/25 border-x border-warning/70"
                style={{
                  left: `${lowPct}%`,
                  width: `${highPct - lowPct}%`,
                }}
              />
            )}

            {/* Low Threshold Marker (ATL) */}
            {hasThreshold && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-text-secondary/80"
                style={{ left: `${lowPct}%` }}
              />
            )}

            {/* High Threshold Marker (ATH) */}
            {hasThreshold && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-warning"
                style={{ left: `${highPct}%` }}
              />
            )}
          </div>

          {!isUltraCompact && hasThreshold && (
            <div
              dir="ltr"
              className="flex items-center justify-between text-[10px] font-mono tabular-nums text-text-muted px-0.5"
            >
              <span>ATL {adcLowThreshold}</span>
              <span>ATH {adcHighThreshold}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleInstantRead}
          aria-label={`خواندن آنی ${segment.title}`}
          title="خواندن آنی مقدار سنسور (0x0D)"
          className={`flex shrink-0 items-center justify-center rounded-lg border border-border-color bg-secondary text-text-secondary transition-[background-color,border-color,color,transform] duration-150 hover:border-accent3/60 hover:text-text-primary active:scale-[0.94] cursor-pointer ${
            isUltraCompact ? "size-6.5" : isCompact ? "size-7.5" : "size-8.5"
          }`}
        >
          <RefreshCw
            className={`${isUltraCompact ? "size-3" : "size-3.5"} ${
              isRefreshing ? "animate-spin transform-gpu text-accent3" : ""
            }`}
            strokeWidth={2}
          />
        </button>
      </div>
    </div>
  );
}

export default React.memo(AnalogInputBody);
