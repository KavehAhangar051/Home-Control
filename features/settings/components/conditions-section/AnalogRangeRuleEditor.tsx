"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import type { AnalogRangeRule, Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { defaultDeviceSyncGateway } from "@/features/iot/services/deviceGatewayAdapter";
import {
  adcValueToPercent,
  adcValueToVoltage,
  clampAdcResolution,
  clampAdcValue,
  getAdcMaxValue,
  getSuggestedAnalogHysteresis,
  isReadOnlyInputSegment,
  MAX_ANALOG_RANGE_RULES,
  RULE_ANALOG_VALUE_UNSET,
} from "@/features/iot/utils/analogInput";
import {
  clampPwmResolution,
  isAnalogOutputSegment,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import { AnalogRangeRuleCard } from "./AnalogRangeRuleCard";

interface AnalogRangeRuleEditorProps {
  segment: Segment;
  ranges: AnalogRangeRule[];
  onUpdate: (nextRanges: AnalogRangeRule[]) => void;
}

export function AnalogRangeRuleEditor({ segment, ranges, onUpdate }: AnalogRangeRuleEditorProps) {
  const segments = useIoTStore((state) => state.segments);
  const showToast = useIoTStore((state) => state.showToast);
  const liveAnalogValue = useIoTStore((state) => state.pinsAnalogValue[segment.pin]);
  const liveResolution = useIoTStore((state) => state.pinsPwmResolution[segment.pin]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rowKeys, setRowKeys] = useState<string[]>(() =>
    ranges.map((_, pos) => `range-${pos}-${Math.random().toString(36).slice(2, 8)}`),
  );

  const keyedRanges = ranges.map((range, pos) => ({
    range,
    pos,
    rowKey: rowKeys[pos] ?? `range-${range.triggerMode}-${range.targetPin}-${pos}`,
  }));

  const resolution = clampAdcResolution(liveResolution ?? segment.adcResolution);
  const maxAdcValue = getAdcMaxValue(resolution);
  const liveValue = clampAdcValue(liveAnalogValue ?? segment.analogValue ?? 0, resolution);
  const livePercent = adcValueToPercent(liveValue, resolution);
  const liveVoltage = adcValueToVoltage(liveValue, resolution);

  const outputSegments = segments.filter(
    (s) =>
      s.type !== "placeholder" &&
      !isReadOnlyInputSegment(s) &&
      s.pin.trim().length > 0 &&
      s.pin.trim() !== segment.pin.trim(),
  );

  const isMaxReached = ranges.length >= MAX_ANALOG_RANGE_RULES;

  const handleRefreshSensor = () => {
    defaultDeviceSyncGateway.readAnalogInput(segment.pin);
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 450);
  };

  const handleAddRange = () => {
    if (isMaxReached) {
      showToast(`حداکثر ${MAX_ANALOG_RANGE_RULES} بازه شرط مجاز است.`, "error");

      return;
    }

    const defaultTarget = outputSegments[0];
    const defaultPin = defaultTarget?.pin.trim() ?? "";
    const isAnalogTarget = isAnalogOutputSegment(defaultTarget);
    const defaultPwmDuty = isAnalogTarget
      ? percentToAnalogDuty(50, clampPwmResolution(defaultTarget?.pwmResolution))
      : RULE_ANALOG_VALUE_UNSET;

    // Suggest an unused upper portion if earlier ranges already exist
    const lastMax =
      ranges.length > 0 ? Math.max(...ranges.map((r) => Math.max(r.minValue, r.maxValue))) : 0;
    const suggestedMin = lastMax > 0 && lastMax < maxAdcValue - 100 ? lastMax + 100 : 0;
    const suggestedMax =
      suggestedMin > 0 ? maxAdcValue : Math.min(maxAdcValue, Math.round(maxAdcValue * 0.5));

    const newRange: AnalogRangeRule = {
      minValue: suggestedMin,
      maxValue: suggestedMax,
      hysteresis: getSuggestedAnalogHysteresis(resolution),
      triggerMode: 0,
      targetPin: defaultPin,
      actionState: true,
      targetValue: defaultPwmDuty,
      actionType: 0,
      delay: 0,
      enabled: true,
    };

    setRowKeys((prev) => [
      ...prev.slice(0, ranges.length),
      `range-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ]);
    onUpdate([...ranges, newRange]);
  };

  const handleUpdateRange = (index: number, updates: Partial<AnalogRangeRule>) => {
    const next = ranges.map((r, i) => (i === index ? { ...r, ...updates } : r));
    onUpdate(next);
  };

  const handleRemoveRange = (index: number) => {
    setRowKeys((prev) => prev.filter((_, i) => i !== index));
    onUpdate(ranges.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Live Sensor Status Bar */}
      <div className="rounded-xl border border-border-color bg-bg-primary p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-text-primary">وضعیت زنده سنسور:</span>
            <span
              dir="ltr"
              className="rounded-md border border-border-color bg-card-bg-solid px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-accent3"
            >
              {liveValue} / {maxAdcValue} ({livePercent}%)
            </span>
            <span dir="ltr" className="font-mono text-[11px] text-text-muted tabular-nums">
              ~{liveVoltage}V
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefreshSensor}
            aria-label={`به‌روزرسانی آنی سنسور ${segment.title}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-color bg-card-bg-solid px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:border-accent3/60 hover:text-text-primary transition-colors cursor-pointer"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3 ${isRefreshing ? "animate-spin text-accent3" : ""}`}
            />
            خواندن آنی
          </button>
        </div>

        <meter
          className="sr-only"
          min={0}
          max={maxAdcValue}
          value={liveValue}
          aria-label={`مقدار زنده سنسور ${segment.title}`}
        />

        <div
          dir="ltr"
          aria-hidden="true"
          className="relative h-3 w-full overflow-hidden rounded-md border border-border-color bg-card-bg-solid"
        >
          {keyedRanges.map(({ range: r, rowKey }) => {
            if (r.enabled === false) return null;
            const lo = Math.min(r.minValue, r.maxValue);
            const hi = Math.max(r.minValue, r.maxValue);
            const isActive = liveValue >= lo && liveValue <= hi;
            const leftPct = Math.min(100, Math.max(0, (lo / maxAdcValue) * 100));
            const widthPct = Math.max(
              1.5,
              Math.min(100 - leftPct, ((hi - lo) / maxAdcValue) * 100),
            );

            return (
              <div
                key={`band-${rowKey}`}
                className={`absolute inset-y-0 border-x ${
                  isActive ? "bg-success/30 border-success" : "bg-accent4/20 border-accent4/60"
                }`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
            );
          })}
          <div
            className="relative z-10 h-full w-full origin-left bg-accent3/80 transition-transform duration-200 ease-out will-change-transform [backface-visibility:hidden]"
            style={{ transform: `scaleX(${livePercent / 100}) translateZ(0)` }}
          />
        </div>
      </div>

      {/* Range List Header + Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-sm text-text-primary">بازه‌های شرط آنالوگ</h4>
          <span
            dir="ltr"
            className="rounded-md border border-border-color bg-bg-primary px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-text-secondary"
          >
            {ranges.length} / {MAX_ANALOG_RANGE_RULES}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddRange}
          disabled={isMaxReached}
          className="flex items-center gap-1.5 rounded-lg border border-accent3 px-3 py-1.5 text-xs font-bold text-accent3 transition-colors hover:bg-accent3 hover:text-accent3-foreground disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus aria-hidden="true" className="size-3.5" /> افزودن بازه جدید
        </button>
      </div>

      {isMaxReached && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          حداکثر ۶ بازه شرط هم‌زمان برای هر سنسور آنالوگ پشتیبانی می‌شود.
        </p>
      )}

      {/* Ranges List or Empty State */}
      {ranges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-color bg-bg-primary/50 p-6 text-center space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">
            هنوز هیچ بازه‌ای برای این سنسور تعریف نشده است
          </p>
          <p className="text-[11px] text-text-muted max-w-md mx-auto leading-relaxed">
            می‌توانید تا ۶ بازه مستقل با هیسترزیس مجزا تعریف کنید (مثلاً: محدوده کم، متوسط، بالا) یا
            با دکمه «ثبت و ارسال» قوانین قبلی دستگاه را پاک کنید.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keyedRanges.map(({ range, pos, rowKey }) => (
            <AnalogRangeRuleCard
              key={rowKey}
              rule={range}
              index={pos}
              inputPin={segment.pin}
              adcResolution={resolution}
              maxAdcValue={maxAdcValue}
              liveValue={liveValue}
              outputSegments={outputSegments}
              onUpdate={(updates) => handleUpdateRange(pos, updates)}
              onRemove={() => handleRemoveRange(pos)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
