"use client";

import { useId } from "react";
import { DashboardSlider } from "@/components/motion/dashboard-slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MacroAction,
  MacroAnalogMode,
  MacroAnalogStepUnit,
} from "@/features/iot/hooks/store/types";
import {
  analogDutyToPercent,
  clampAnalogValue,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";

interface MacroAnalogActionFieldsProps {
  index: number;
  action: MacroAction;
  pwmResolution: number;
  onChange: (updates: Partial<MacroAction>) => void;
}

const PERCENT_PRESETS = [0, 25, 50, 75, 100] as const;
const STEP_PERCENT_PRESETS = [-25, -10, -5, 5, 10, 25] as const;

export function MacroAnalogActionFields({
  index,
  action,
  pwmResolution,
  onChange,
}: MacroAnalogActionFieldsProps) {
  const baseId = useId();
  const stepInputId = `${baseId}-step`;
  const rawInputId = `${baseId}-raw`;

  const maxDuty = getAnalogMaxDuty(pwmResolution);
  const mode: MacroAnalogMode = action.analogMode ?? "set";
  const currentDuty = hasExplicitAnalogTargetValue(action.targetValue)
    ? clampAnalogValue(action.targetValue, pwmResolution)
    : action.actionOn
      ? percentToAnalogDuty(50, pwmResolution)
      : 0;
  const currentPercent = analogDutyToPercent(currentDuty, pwmResolution);

  const stepUnit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
  const stepDelta = Number.isFinite(action.stepDelta) ? (action.stepDelta as number) : 10;
  const maxStepBound = stepUnit === "percent" ? 100 : maxDuty;

  const handleModeChange = (nextMode: MacroAnalogMode) => {
    if (nextMode === mode) return;

    if (nextMode === "set") {
      onChange({
        analogMode: "set",
        targetValue: currentDuty,
        actionOn: currentDuty > 0,
        stepDelta: undefined,
        stepUnit: undefined,
        powerToggle: undefined,
      });
      return;
    }

    if (nextMode === "step") {
      onChange({
        analogMode: "step",
        stepDelta:
          Number.isFinite(action.stepDelta) && action.stepDelta !== 0 ? action.stepDelta : 10,
        stepUnit: action.stepUnit === "raw" ? "raw" : "percent",
        targetValue: undefined,
        powerToggle: undefined,
        actionOn: true,
      });
      return;
    }

    onChange({
      analogMode: "power",
      powerToggle: action.powerToggle ?? true,
      actionOn: action.powerToggle === false ? action.actionOn : true,
      targetValue: undefined,
      stepDelta: undefined,
      stepUnit: undefined,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border-color bg-bg-primary/60 p-3 text-xs">
      <div
        role="tablist"
        aria-label={`حالت کنترل آنالوگ عملیات ${index + 1}`}
        className="grid grid-cols-3 gap-1 rounded-xl border border-border-color bg-card-bg-solid p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "set"}
          onClick={() => handleModeChange("set")}
          className={`min-h-9 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
            mode === "set"
              ? "bg-accent3 text-accent3-foreground"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          مقدار دقیق
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "step"}
          onClick={() => handleModeChange("step")}
          className={`min-h-9 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
            mode === "step"
              ? "bg-accent3 text-accent3-foreground"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          تغییر پله‌ای
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "power"}
          onClick={() => handleModeChange("power")}
          className={`min-h-9 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
            mode === "power"
              ? "bg-accent3 text-accent3-foreground"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          روشن/خاموش
        </button>
      </div>

      {mode === "set" && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-text-secondary">شدت هدف ({pwmResolution} بیت)</span>
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
              onChange({ analogMode: "set", targetValue: clamped, actionOn: clamped > 0 });
            }}
            label="شدت خروجی"
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
            aria-label={`شدت PWM عملیات ${index + 1}`}
            formatValueText={(val) => `${analogDutyToPercent(val, pwmResolution)} درصد`}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
              {PERCENT_PRESETS.map((pct) => {
                const presetDuty = percentToAnalogDuty(pct, pwmResolution);
                const selected = currentPercent === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() =>
                      onChange({
                        analogMode: "set",
                        targetValue: presetDuty,
                        actionOn: presetDuty > 0,
                      })
                    }
                    className={`min-h-8 cursor-pointer rounded-md border px-2 font-mono text-[11px] tabular-nums transition-colors ${
                      selected
                        ? "border-accent3 bg-accent3 font-semibold text-accent3-foreground"
                        : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor={rawInputId} className="text-[11px] text-text-muted">
                خام:
              </Label>
              <Input
                id={rawInputId}
                type="number"
                dir="ltr"
                min={0}
                max={maxDuty}
                value={currentDuty}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  const clamped = clampAnalogValue(
                    Number.isFinite(parsed) ? parsed : 0,
                    pwmResolution,
                  );
                  onChange({ analogMode: "set", targetValue: clamped, actionOn: clamped > 0 });
                }}
                className="h-8 w-20 bg-card-bg-solid px-2 font-mono text-xs tabular-nums"
              />
            </div>
          </div>
        </div>
      )}

      {mode === "step" && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-card-bg-solid p-1">
            <button
              type="button"
              aria-pressed={stepUnit === "percent"}
              onClick={() => onChange({ analogMode: "step", stepUnit: "percent" })}
              className={`min-h-8 cursor-pointer rounded-lg px-2 text-[11px] font-semibold transition-colors ${
                stepUnit === "percent"
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              تغییر درصدی (٪)
            </button>
            <button
              type="button"
              aria-pressed={stepUnit === "raw"}
              onClick={() => onChange({ analogMode: "step", stepUnit: "raw" })}
              className={`min-h-8 cursor-pointer rounded-lg px-2 text-[11px] font-semibold transition-colors ${
                stepUnit === "raw"
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              تغییر خام (۰..{maxDuty})
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={stepInputId} className="font-semibold text-text-secondary">
                مقدار گام تغییر ({stepUnit === "percent" ? "درصد" : "مقدار خام"})
              </Label>
              <span dir="ltr" className="font-mono text-[11px] text-text-muted tabular-nums">
                -{maxStepBound} .. +{maxStepBound}
              </span>
            </div>
            <Input
              id={stepInputId}
              type="number"
              dir="ltr"
              min={-maxStepBound}
              max={maxStepBound}
              value={stepDelta}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                onChange({
                  analogMode: "step",
                  stepUnit,
                  stepDelta: Number.isFinite(parsed)
                    ? Math.min(maxStepBound, Math.max(-maxStepBound, parsed))
                    : 0,
                });
              }}
              className="bg-card-bg-solid font-mono text-xs tabular-nums"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
            {STEP_PERCENT_PRESETS.map((delta) => {
              const targetDelta =
                stepUnit === "percent"
                  ? delta
                  : (delta < 0 ? -1 : 1) *
                    Math.max(1, percentToAnalogDuty(Math.abs(delta), pwmResolution));
              const isSelected = stepDelta === targetDelta;

              return (
                <button
                  key={delta}
                  type="button"
                  onClick={() =>
                    onChange({
                      analogMode: "step",
                      stepUnit,
                      stepDelta: targetDelta,
                    })
                  }
                  className={`min-h-8 cursor-pointer rounded-md border px-2 font-mono text-[11px] tabular-nums transition-colors ${
                    isSelected
                      ? "border-accent3 bg-accent3 font-semibold text-accent3-foreground"
                      : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary"
                  }`}
                >
                  {targetDelta > 0 ? `+${targetDelta}` : targetDelta}
                  {stepUnit === "percent" ? "%" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === "power" && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border-color bg-card-bg-solid p-1">
            <button
              type="button"
              aria-pressed={!action.powerToggle && action.actionOn}
              onClick={() =>
                onChange({
                  analogMode: "power",
                  powerToggle: false,
                  actionOn: true,
                  targetValue: undefined,
                })
              }
              className={`min-h-9 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                !action.powerToggle && action.actionOn
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              روشن کردن
            </button>
            <button
              type="button"
              aria-pressed={!action.powerToggle && !action.actionOn}
              onClick={() =>
                onChange({
                  analogMode: "power",
                  powerToggle: false,
                  actionOn: false,
                  targetValue: undefined,
                })
              }
              className={`min-h-9 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                !action.powerToggle && !action.actionOn
                  ? "bg-destructive text-destructive-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              خاموش کردن
            </button>
            <button
              type="button"
              aria-pressed={Boolean(action.powerToggle)}
              onClick={() =>
                onChange({
                  analogMode: "power",
                  powerToggle: true,
                  actionOn: true,
                  targetValue: undefined,
                })
              }
              className={`min-h-9 cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${
                action.powerToggle
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              معکوس (Toggle)
            </button>
          </div>
          <p className="text-[11px] leading-5 text-text-muted">
            شدت PWM ذخیره‌شده حفظ می‌شود و تنها وضعیت روشن یا خاموش خروجی ارسال می‌گردد.
          </p>
        </div>
      )}
    </div>
  );
}
