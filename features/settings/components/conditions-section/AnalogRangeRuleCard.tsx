"use client";

import { useId } from "react";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  AnalogRangeRule,
  AnalogRangeTriggerMode,
  RuleActionType,
  Segment,
} from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { RuleGuardConditionsEditor } from "@/features/settings/components/shared/ActionConditionsEditor";
import {
  adcValueToPercent,
  getMaxAnalogHysteresis,
  RULE_ANALOG_VALUE_UNSET,
} from "@/features/iot/utils/analogInput";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  isAnalogOutputSegment,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";

const PWM_RANGE_PERCENT_PRESETS = [0, 25, 50, 75, 100] as const;

interface AnalogRangeRuleCardProps {
  rule: AnalogRangeRule;
  index: number;
  inputPin: string;
  adcResolution: number;
  maxAdcValue: number;
  liveValue: number;
  outputSegments: Segment[];
  onUpdate: (updates: Partial<AnalogRangeRule>) => void;
  onRemove: () => void;
}

export function AnalogRangeRuleCard({
  rule,
  index,
  inputPin,
  adcResolution,
  maxAdcValue,
  liveValue,
  outputSegments,
  onUpdate,
  onRemove,
}: AnalogRangeRuleCardProps) {
  const baseId = useId();
  const minId = `${baseId}-min`;
  const maxId = `${baseId}-max`;
  const hystId = `${baseId}-hyst`;
  const targetPinId = `${baseId}-target`;
  const stateId = `${baseId}-state`;
  const actionTypeId = `${baseId}-action-type`;
  const delayId = `${baseId}-delay`;

  const segments = useIoTStore((state) => state.segments);
  const pinsPwmResolution = useIoTStore((state) => state.pinsPwmResolution);

  const isEnabled = rule.enabled !== false;
  const maxHysteresis = getMaxAnalogHysteresis(adcResolution);
  const lowBound = Math.min(rule.minValue, rule.maxValue);
  const highBound = Math.max(rule.minValue, rule.maxValue);
  const isInvertedBounds = rule.minValue > rule.maxValue;
  const isCurrentlyActive = isEnabled && liveValue >= lowBound && liveValue <= highBound;

  const minPercent = adcValueToPercent(rule.minValue, adcResolution);
  const maxPercent = adcValueToPercent(rule.maxValue, adcResolution);
  const leftTrackPct = Math.min(100, Math.max(0, (lowBound / maxAdcValue) * 100));
  const widthTrackPct = Math.max(
    2,
    Math.min(100 - leftTrackPct, ((highBound - lowBound) / maxAdcValue) * 100),
  );

  const normalizedTargetPin = String(rule.targetPin ?? "").trim();
  const matchedTargetSeg = normalizedTargetPin
    ? outputSegments.find((s) => s.pin.trim() === normalizedTargetPin)
    : undefined;
  const hasOrphanTargetPin = Boolean(normalizedTargetPin) && !matchedTargetSeg;

  const isAnalogTarget =
    isAnalogOutputSegment(matchedTargetSeg) || hasExplicitAnalogTargetValue(rule.targetValue);
  const targetPwmResolution = clampPwmResolution(
    pinsPwmResolution[normalizedTargetPin] ?? matchedTargetSeg?.pwmResolution,
  );
  const targetMaxDuty = getAnalogMaxDuty(targetPwmResolution);
  const currentPwmDuty = hasExplicitAnalogTargetValue(rule.targetValue)
    ? clampAnalogValue(rule.targetValue, targetPwmResolution)
    : rule.actionState
      ? percentToAnalogDuty(50, targetPwmResolution)
      : 0;
  const currentPwmPercent = analogDutyToPercent(currentPwmDuty, targetPwmResolution);

  const handleTargetPinChange = (nextPin: string) => {
    const nextSeg = outputSegments.find((s) => s.pin.trim() === nextPin);

    if (isAnalogOutputSegment(nextSeg)) {
      const nextRes = clampPwmResolution(pinsPwmResolution[nextPin] ?? nextSeg?.pwmResolution);
      const nextDuty = hasExplicitAnalogTargetValue(rule.targetValue)
        ? clampAnalogValue(rule.targetValue, nextRes)
        : rule.actionState
          ? percentToAnalogDuty(50, nextRes)
          : 0;

      onUpdate({
        targetPin: nextPin,
        targetValue: nextDuty,
        actionState: nextDuty > 0,
      });

      return;
    }

    onUpdate({
      targetPin: nextPin,
      targetValue: RULE_ANALOG_VALUE_UNSET,
    });
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isCurrentlyActive
          ? "border-success/60 bg-success/5"
          : isEnabled
            ? "border-border-color bg-card-bg-solid"
            : "border-border-color/60 bg-card-bg-solid opacity-65"
      }`}
    >
      {/* Header Row: Index, Live Range Status, Enable Toggle, Delete */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border-color pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-bg-primary px-2.5 py-1 text-xs font-bold text-text-primary border border-border-color">
            بازه {index + 1}
          </span>
          {isCurrentlyActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success animate-pulse" />
              فعال در مقدار فعلی
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md border border-border-color bg-bg-primary px-2 py-0.5 text-[11px] text-text-muted">
              {rule.triggerMode === 0 ? "هنگام ورود به بازه" : "هنگام خروج از بازه"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={`وضعیت بازه ${index + 1}`}
            onClick={() => onUpdate({ enabled: !isEnabled })}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
              isEnabled
                ? "border-accent3/50 bg-accent3/15 text-accent3"
                : "border-border-color bg-bg-primary text-text-muted"
            }`}
          >
            {isEnabled ? "فعال" : "غیرفعال"}
          </button>
          <DeleteButton
            size="sm"
            resetAfter={0}
            onConfirm={onRemove}
            label={`حذف بازه ${index + 1}`}
          />
        </div>
      </div>

      {/* Visual Range Band Preview over 0..maxAdcValue */}
      <div className="mb-3 space-y-1">
        <div
          dir="ltr"
          aria-hidden="true"
          className="relative h-2 w-full overflow-hidden rounded-full border border-border-color bg-bg-primary"
        >
          <div
            className={`absolute inset-y-0 rounded-full transition-colors ${
              isCurrentlyActive ? "bg-success/80" : "bg-accent3/60"
            }`}
            style={{
              left: `${leftTrackPct}%`,
              width: `${widthTrackPct}%`,
            }}
          />
          <span
            className="absolute inset-y-0 w-0.5 bg-text-primary"
            style={{ left: `${Math.min(99.5, Math.max(0, (liveValue / maxAdcValue) * 100))}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 text-xs">
        {/* Min Value, Max Value, Hysteresis */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <Label htmlFor={minId} className="font-semibold">
                حداقل
              </Label>
              <span dir="ltr" className="font-mono text-[11px] text-text-muted tabular-nums">
                {minPercent}%
              </span>
            </div>
            <Input
              id={minId}
              aria-label={`حداقل مقدار بازه ${index + 1}`}
              type="number"
              dir="ltr"
              min={0}
              max={maxAdcValue}
              value={rule.minValue}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                const next = Number.isFinite(parsed)
                  ? Math.min(maxAdcValue, Math.max(0, parsed))
                  : 0;
                onUpdate({ minValue: next });
              }}
              className="bg-bg-primary p-2.5 rounded-lg text-xs text-left font-mono tabular-nums"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <Label htmlFor={maxId} className="font-semibold">
                حداکثر
              </Label>
              <span dir="ltr" className="font-mono text-[11px] text-text-muted tabular-nums">
                {maxPercent}%
              </span>
            </div>
            <Input
              id={maxId}
              aria-label={`حداکثر مقدار بازه ${index + 1}`}
              type="number"
              dir="ltr"
              min={0}
              max={maxAdcValue}
              value={rule.maxValue}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                const next = Number.isFinite(parsed)
                  ? Math.min(maxAdcValue, Math.max(0, parsed))
                  : 0;
                onUpdate({ maxValue: next });
              }}
              className="bg-bg-primary p-2.5 rounded-lg text-xs text-left font-mono tabular-nums"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <Label htmlFor={hystId} className="font-semibold">
                هیسترزیس
              </Label>
              <span dir="ltr" className="font-mono text-[10px] text-text-muted tabular-nums">
                0..{maxHysteresis}
              </span>
            </div>
            <Input
              id={hystId}
              aria-label={`هیسترزیس بازه ${index + 1}`}
              type="number"
              dir="ltr"
              min={0}
              max={maxHysteresis}
              value={rule.hysteresis}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                const next = Number.isFinite(parsed)
                  ? Math.min(maxHysteresis, Math.max(0, parsed))
                  : 0;
                onUpdate({ hysteresis: next });
              }}
              className="bg-bg-primary p-2.5 rounded-lg text-xs text-left font-mono tabular-nums"
            />
          </div>
        </div>

        <p className="text-[11px] text-text-muted leading-relaxed">
          باند محافظ برای جلوگیری از قطع‌ووصلی روی مرز بازه
          {isInvertedBounds && (
            <span className="ms-2 text-destructive font-semibold">
              (توجه: حداقل نباید از حداکثر بزرگ‌تر باشد)
            </span>
          )}
        </p>

        {/* Trigger Mode & Target Output */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="block font-semibold mb-1.5">زمان اجرا</span>
            <fieldset
              aria-label={`زمان اجرای بازه ${index + 1}`}
              className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-bg-primary p-1"
            >
              <button
                type="button"
                aria-pressed={rule.triggerMode === 0}
                onClick={() => onUpdate({ triggerMode: 0 as AnalogRangeTriggerMode })}
                className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                  rule.triggerMode === 0
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                هنگام ورود به بازه
              </button>
              <button
                type="button"
                aria-pressed={rule.triggerMode === 1}
                onClick={() => onUpdate({ triggerMode: 1 as AnalogRangeTriggerMode })}
                className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                  rule.triggerMode === 1
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                هنگام خروج از بازه
              </button>
            </fieldset>
          </div>

          <div>
            <Label htmlFor={targetPinId} className="block font-semibold mb-1.5">
              خروجی هدف
            </Label>
            <Select
              id={targetPinId}
              aria-label={`خروجی هدف بازه ${index + 1}`}
              value={normalizedTargetPin}
              onChange={(e) => handleTargetPinChange(e.target.value)}
              className="bg-bg-primary p-2.5 rounded-lg text-xs"
            >
              <option value="">
                {outputSegments.length === 0
                  ? "ابتدا یک قطعه خروجی در داشبورد بسازید"
                  : "انتخاب خروجی هدف..."}
              </option>
              {hasOrphanTargetPin && (
                <option value={normalizedTargetPin}>
                  GPIO {normalizedTargetPin} (پایه ثبت‌شده قبلی)
                </option>
              )}
              {outputSegments.map((seg) => (
                <option key={seg.id} value={seg.pin.trim()}>
                  {seg.title} — GPIO {seg.pin} (
                  {isAnalogOutputSegment(seg) ? "PWM آنالوگ" : "دیجیتال"})
                </option>
              ))}
            </Select>
            {normalizedTargetPin === inputPin.trim() && (
              <p className="mt-1 text-[11px] text-destructive">
                خروجی هدف نمی‌تواند همان پایه ورودی باشد.
              </p>
            )}
          </div>
        </div>

        {/* Target State or Analog PWM Duty */}
        {isAnalogTarget ? (
          <div className="space-y-2.5 rounded-xl border border-border-color bg-bg-primary/60 p-3">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-text-secondary">
                مقدار PWM هدف ({targetPwmResolution} بیت)
              </span>
              <span className="font-mono font-semibold tabular-nums text-accent3" dir="ltr">
                {currentPwmPercent}% ({currentPwmDuty}/{targetMaxDuty})
              </span>
            </div>
            <DashboardSlider
              defaultVariant="range"
              min={0}
              max={targetMaxDuty}
              step={1}
              value={currentPwmDuty}
              onValueChange={(nextDuty) => {
                const clamped = clampAnalogValue(nextDuty, targetPwmResolution);
                onUpdate({ targetValue: clamped, actionState: clamped > 0 });
              }}
              label="شدت خروجی PWM"
              format={(val) => `${analogDutyToPercent(val, targetPwmResolution)}%`}
              unit="%"
              rulerScale={{
                min: 0,
                max: 100,
                step: 1,
                majorEvery: 10,
                unit: "%",
                toDisplay: (raw) => analogDutyToPercent(raw, targetPwmResolution),
                fromDisplay: (pct) => percentToAnalogDuty(pct, targetPwmResolution),
              }}
              aria-label={`مقدار PWM بازه ${index + 1}`}
              formatValueText={(val) => `${analogDutyToPercent(val, targetPwmResolution)} درصد`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
                {PWM_RANGE_PERCENT_PRESETS.map((pct) => {
                  const presetDuty = percentToAnalogDuty(pct, targetPwmResolution);
                  const isSelected = currentPwmPercent === pct;

                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() =>
                        onUpdate({ targetValue: presetDuty, actionState: presetDuty > 0 })
                      }
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors cursor-pointer ${
                        isSelected
                          ? "border-accent3 bg-accent3 text-accent3-foreground font-semibold"
                          : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
              <Input
                type="number"
                dir="ltr"
                min={0}
                max={targetMaxDuty}
                aria-label={`عدد PWM بازه ${index + 1}`}
                value={currentPwmDuty}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  const clamped = clampAnalogValue(
                    Number.isFinite(parsed) ? parsed : 0,
                    targetPwmResolution,
                  );
                  onUpdate({ targetValue: clamped, actionState: clamped > 0 });
                }}
                className="h-7 w-24 bg-card-bg-solid px-2 text-xs font-mono tabular-nums"
              />
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor={stateId} className="block font-semibold mb-1.5">
              وضعیت خروجی
            </Label>
            <Select
              id={stateId}
              aria-label={`وضعیت خروجی بازه ${index + 1}`}
              value={rule.actionState ? "1" : "0"}
              onChange={(e) =>
                onUpdate({
                  actionState: e.target.value === "1",
                  targetValue: RULE_ANALOG_VALUE_UNSET,
                })
              }
              className="bg-bg-primary p-2.5 rounded-lg text-xs"
            >
              <option value="1">روشن</option>
              <option value="0">خاموش</option>
            </Select>
          </div>
        )}

        {/* ActionType & Delay */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor={actionTypeId} className="block font-semibold mb-1.5">
              نوع عملیات
            </Label>
            <Select
              id={actionTypeId}
              aria-label={`نوع عملیات بازه ${index + 1}`}
              value={rule.actionType}
              onChange={(e) => {
                const nextType = Number.parseInt(e.target.value, 10) as RuleActionType;
                onUpdate({
                  actionType: nextType,
                  delay: nextType > 0 ? Math.max(1, rule.delay || 5) : 0,
                });
              }}
              className="bg-bg-primary p-2.5 rounded-lg text-xs"
            >
              <option value={0}>فوری</option>
              <option value={1}>اجرا پس از تاخیر</option>
              <option value={2}>اجرا برای مدت مشخص</option>
            </Select>
          </div>

          {rule.actionType > 0 && (
            <div>
              <Label htmlFor={delayId} className="block font-semibold mb-1.5">
                {rule.actionType === 1 ? "تاخیر (۱ تا ۶۰ ثانیه)" : "مدت زمان (۱ تا ۶۰ ثانیه)"}
              </Label>
              <Input
                id={delayId}
                aria-label={`مدت زمان بازه ${index + 1}`}
                type="number"
                dir="ltr"
                min={1}
                max={60}
                value={rule.delay}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  const next = Number.isFinite(parsed) ? Math.min(60, Math.max(0, parsed)) : 1;
                  onUpdate({ delay: next });
                }}
                className="bg-bg-primary p-2.5 rounded-lg text-xs text-left font-mono tabular-nums"
              />
            </div>
          )}
        </div>

        <RuleGuardConditionsEditor
          actionLabel={`بازه ${index + 1}`}
          conditions={rule.conditions}
          conditionLogic={rule.conditionLogic}
          segments={segments}
          excludeSourcePin={inputPin}
          onChange={(conditions, conditionLogic) => onUpdate({ conditions, conditionLogic })}
        />
      </div>
    </div>
  );
}
