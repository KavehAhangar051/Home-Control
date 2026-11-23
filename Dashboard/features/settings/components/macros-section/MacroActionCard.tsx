"use client";

import { useId } from "react";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { DeleteButton } from "@/components/ui/delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { MacroAction, Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  isAnalogOutputSegment,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import { MacroConditionEditor } from "./MacroConditionEditor";

const PWM_PERCENT_PRESETS = [0, 25, 50, 75, 100] as const;

interface MacroActionCardProps {
  index: number;
  action: MacroAction;
  outputs: readonly Segment[];
  allSegments: readonly Segment[];
  onChange: (updates: Partial<MacroAction>) => void;
  onRemove: () => void;
}

export function MacroActionCard({
  index,
  action,
  outputs,
  allSegments,
  onChange,
  onRemove,
}: MacroActionCardProps) {
  const baseId = useId();
  const targetPinId = `${baseId}-target`;
  const pinsPwmResolution = useIoTStore((state) => state.pinsPwmResolution);

  const matchedOutput = outputs.find((seg) => seg.pin.trim() === action.targetPin.trim());
  const isAnalogTarget = isAnalogOutputSegment(matchedOutput);
  const pwmResolution = clampPwmResolution(
    pinsPwmResolution[action.targetPin] ?? matchedOutput?.pwmResolution,
  );
  const maxDuty = getAnalogMaxDuty(pwmResolution);
  const currentDuty = hasExplicitAnalogTargetValue(action.targetValue)
    ? clampAnalogValue(action.targetValue, pwmResolution)
    : action.actionOn
      ? maxDuty
      : 0;
  const currentPercent = analogDutyToPercent(currentDuty, pwmResolution);

  const handleTargetPinChange = (nextPin: string) => {
    const nextSegment = outputs.find((seg) => seg.pin.trim() === nextPin.trim());

    if (isAnalogOutputSegment(nextSegment)) {
      const nextRes = clampPwmResolution(pinsPwmResolution[nextPin] ?? nextSegment?.pwmResolution);
      const nextDuty = hasExplicitAnalogTargetValue(action.targetValue)
        ? clampAnalogValue(action.targetValue, nextRes)
        : percentToAnalogDuty(50, nextRes);

      onChange({
        targetPin: nextPin,
        targetValue: nextDuty,
        actionOn: nextDuty > 0,
      });

      return;
    }

    onChange({
      targetPin: nextPin,
      targetValue: undefined,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border-color bg-card-bg-solid p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/70 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg border border-border-color bg-bg-primary px-2 py-0.5 text-[11px] font-bold text-text-primary">
            عملیات {index + 1}
          </span>
          <span className="rounded-md border border-border-color bg-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
            {isAnalogTarget ? `خروجی آنالوگ PWM (${pwmResolution} بیت)` : "خروجی دیجیتال"}
          </span>
          {action.condition?.enabled && (
            <span className="rounded-md border border-accent3/40 bg-accent3/15 px-2 py-0.5 text-[10px] font-semibold text-accent3">
              شرط‌دار
            </span>
          )}
        </div>

        <DeleteButton
          size="sm"
          resetAfter={0}
          onConfirm={onRemove}
          label={`حذف عملیات ${index + 1}`}
        />
      </div>

      {/* Target Output Selection */}
      <div className="space-y-1.5 text-xs">
        <Label htmlFor={targetPinId} className="font-semibold text-text-secondary">
          قطعه هدف
        </Label>
        <Select
          id={targetPinId}
          aria-label={`پایه عملیات ${index + 1}`}
          value={action.targetPin}
          onChange={(event) => handleTargetPinChange(event.target.value)}
          className="bg-bg-primary text-xs"
        >
          {outputs.map((segment) => (
            <option key={segment.id} value={segment.pin}>
              {segment.title} — GPIO {segment.pin} (
              {isAnalogOutputSegment(segment) ? "PWM آنالوگ" : "دیجیتال"})
            </option>
          ))}
        </Select>
      </div>

      {/* Target Action Value: Analog PWM Slider vs Digital ON/OFF */}
      {isAnalogTarget ? (
        <div className="space-y-2.5 rounded-xl border border-border-color bg-bg-primary/60 p-3">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-text-secondary">مقدار خروجی PWM</span>
            <span dir="ltr" className="font-mono font-semibold tabular-nums text-accent3">
              {currentPercent}% ({currentDuty}/{maxDuty})
            </span>
          </div>

          <DashboardSlider
            defaultVariant="range"
            min={0}
            max={maxDuty}
            step={1}
            value={currentDuty}
            onValueChange={(nextDuty) => {
              const clamped = clampAnalogValue(nextDuty, pwmResolution);
              onChange({ targetValue: clamped, actionOn: clamped > 0 });
            }}
            label="شدت خروجی آنالوگ"
            format={(val) => `${analogDutyToPercent(val, pwmResolution)}%`}
            unit="%"
            rulerScale={{
              min: 0,
              max: 100,
              step: 1,
              majorEvery: 10,
              unit: "%",
              toDisplay: (raw) => analogDutyToPercent(raw, pwmResolution),
              fromDisplay: (pct) => percentToAnalogDuty(pct, pwmResolution),
            }}
            aria-label={`مقدار PWM عملیات ${index + 1}`}
            formatValueText={(val) => `${analogDutyToPercent(val, pwmResolution)} درصد`}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
              {PWM_PERCENT_PRESETS.map((pct) => {
                const presetDuty = percentToAnalogDuty(pct, pwmResolution);
                const isSelected = currentPercent === pct;

                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onChange({ targetValue: presetDuty, actionOn: presetDuty > 0 })}
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
              max={maxDuty}
              aria-label={`عدد خام PWM عملیات ${index + 1}`}
              value={currentDuty}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                const clamped = clampAnalogValue(
                  Number.isFinite(parsed) ? parsed : 0,
                  pwmResolution,
                );
                onChange({ targetValue: clamped, actionOn: clamped > 0 });
              }}
              className="h-7 w-24 bg-card-bg-solid px-2 text-xs font-mono tabular-nums"
            />
          </div>
        </div>
      ) : (
        <fieldset
          aria-label={`وضعیت خروجی عملیات ${index + 1}`}
          className="grid grid-cols-2 gap-1.5 rounded-xl border border-border-color bg-bg-primary p-1"
        >
          <button
            type="button"
            aria-pressed={action.actionOn}
            onClick={() => onChange({ actionOn: true, targetValue: undefined })}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              action.actionOn
                ? "bg-accent3 text-accent3-foreground"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            روشن
          </button>
          <button
            type="button"
            aria-pressed={!action.actionOn}
            onClick={() => onChange({ actionOn: false, targetValue: undefined })}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              !action.actionOn
                ? "bg-destructive text-destructive-foreground"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            خاموش
          </button>
        </fieldset>
      )}

      {/* Per-Action Dashboard Condition */}
      <MacroConditionEditor
        index={index}
        condition={action.condition}
        segments={allSegments}
        onChange={(nextCondition) => onChange({ condition: nextCondition })}
      />
    </div>
  );
}
