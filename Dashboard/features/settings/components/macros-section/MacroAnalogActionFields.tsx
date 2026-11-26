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

const PWM_PERCENT_PRESETS = [0, 25, 50, 75, 100] as const;
const STEP_PERCENT_PRESETS = [5, 10, 20, 25, 50] as const;

interface MacroAnalogActionFieldsProps {
  index: number;
  action: MacroAction;
  pwmResolution: number;
  onChange: (updates: Partial<MacroAction>) => void;
}

export function MacroAnalogActionFields({
  index,
  action,
  pwmResolution,
  onChange,
}: MacroAnalogActionFieldsProps) {
  const stepInputId = useId();
  const maxDuty = getAnalogMaxDuty(pwmResolution);
  const mode: MacroAnalogMode =
    action.analogMode ?? (hasExplicitAnalogTargetValue(action.targetValue) ? "set" : "power");

  const currentDuty = hasExplicitAnalogTargetValue(action.targetValue)
    ? clampAnalogValue(action.targetValue, pwmResolution)
    : action.actionOn
      ? maxDuty
      : 0;
  const currentPercent = analogDutyToPercent(currentDuty, pwmResolution);

  const stepUnit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
  const rawDelta =
    typeof action.stepDelta === "number" && Number.isFinite(action.stepDelta) && action.stepDelta !== 0
      ? Math.round(action.stepDelta)
      : 10;
  const isDecrease = rawDelta < 0;
  const maxStep = stepUnit === "percent" ? 100 : maxDuty;
  const absStep = Math.min(maxStep, Math.max(1, Math.abs(rawDelta)));

  const handleModeChange = (nextMode: MacroAnalogMode) => {
    if (nextMode === "set") {
      const nextDuty = hasExplicitAnalogTargetValue(action.targetValue)
        ? clampAnalogValue(action.targetValue, pwmResolution)
        : percentToAnalogDuty(50, pwmResolution);
      onChange({
        analogMode: "set",
        targetValue: nextDuty,
        actionOn: nextDuty > 0,
        stepDelta: undefined,
        stepUnit: undefined,
        powerToggle: undefined,
      });
      return;
    }

    if (nextMode === "step") {
      const nextDelta =
        typeof action.stepDelta === "number" && Number.isFinite(action.stepDelta) && action.stepDelta !== 0
          ? Math.round(action.stepDelta)
          : 10;
      onChange({
        analogMode: "step",
        targetValue: undefined,
        stepDelta: nextDelta,
        stepUnit: action.stepUnit ?? "percent",
        actionOn: nextDelta > 0,
        powerToggle: undefined,
      });
      return;
    }

    onChange({
      analogMode: "power",
      targetValue: undefined,
      stepDelta: undefined,
      stepUnit: undefined,
    });
  };

  const applyStep = (nextAbs: number, nextDecrease: boolean, nextUnit: MacroAnalogStepUnit) => {
    const unitLimit = nextUnit === "percent" ? 100 : maxDuty;
    const clampedAbs = Math.min(unitLimit, Math.max(1, Math.round(nextAbs) || 1));
    const signed = nextDecrease ? -clampedAbs : clampedAbs;
    onChange({
      analogMode: "step",
      targetValue: undefined,
      stepUnit: nextUnit,
      stepDelta: signed,
      actionOn: !nextDecrease,
      powerToggle: undefined,
    });
  };

  const stepPresets =
    stepUnit === "percent"
      ? STEP_PERCENT_PRESETS
      : Array.from(
          new Set([1, 10, 25, 50, Math.min(maxDuty, 100)].map((v) => Math.min(maxDuty, v))),
        );

  return (
    <div className="space-y-2.5 rounded-xl border border-border-color bg-bg-primary/60 p-3">
      <div
        role="tablist"
        aria-label={`حالت کنترل آنالوگ عملیات ${index + 1}`}
        className="grid grid-cols-3 gap-1 rounded-lg border border-border-color bg-card-bg-solid p-1 text-[11px]"
      >
        {(
          [
            { id: "set", label: "مقدار ثابت" },
            { id: "step", label: "پله‌ای (+/-)" },
            { id: "power", label: "روشن / خاموش" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => handleModeChange(tab.id)}
            className={`cursor-pointer rounded-md px-2 py-1.5 font-semibold transition-colors ${
              mode === tab.id
                ? "bg-accent3 text-accent3-foreground"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "set" && (
        <>
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
              onChange({ analogMode: "set", targetValue: clamped, actionOn: clamped > 0 });
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
                    onClick={() =>
                      onChange({ analogMode: "set", targetValue: presetDuty, actionOn: presetDuty > 0 })
                    }
                    className={`cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors ${
                      isSelected
                        ? "border-accent3 bg-accent3 font-semibold text-accent3-foreground"
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
                onChange({ analogMode: "set", targetValue: clamped, actionOn: clamped > 0 });
              }}
              className="h-7 w-24 bg-card-bg-solid px-2 font-mono text-xs tabular-nums"
            />
          </div>
        </>
      )}

      {mode === "step" && (
        <div className="space-y-2.5 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-color bg-card-bg-solid p-1">
              <button
                type="button"
                aria-pressed={!isDecrease}
                onClick={() => applyStep(absStep, false, stepUnit)}
                className={`cursor-pointer rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
                  !isDecrease
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                افزایش (+)
              </button>
              <button
                type="button"
                aria-pressed={isDecrease}
                onClick={() => applyStep(absStep, true, stepUnit)}
                className={`cursor-pointer rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
                  isDecrease
                    ? "bg-destructive text-destructive-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                کاهش (-)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-color bg-card-bg-solid p-1">
              <button
                type="button"
                aria-pressed={stepUnit === "percent"}
                onClick={() => applyStep(absStep, isDecrease, "percent")}
                className={`cursor-pointer rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
                  stepUnit === "percent"
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                درصد (%)
              </button>
              <button
                type="button"
                aria-pressed={stepUnit === "raw"}
                onClick={() => applyStep(absStep, isDecrease, "raw")}
                className={`cursor-pointer rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
                  stepUnit === "raw"
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                مقدار خام
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
              {stepPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyStep(preset, isDecrease, stepUnit)}
                  className={`cursor-pointer rounded-md border px-2 py-0.5 font-mono text-[10px] tabular-nums transition-colors ${
                    absStep === preset
                      ? "border-accent3 bg-accent3 font-semibold text-accent3-foreground"
                      : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary"
                  }`}
                >
                  {isDecrease ? "-" : "+"}
                  {preset}
                  {stepUnit === "percent" ? "%" : ""}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Label htmlFor={stepInputId} className="text-[11px] text-text-secondary">
                گام
              </Label>
              <Input
                id={stepInputId}
                type="number"
                dir="ltr"
                min={1}
                max={maxStep}
                value={absStep}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  applyStep(Number.isFinite(parsed) ? parsed : 1, isDecrease, stepUnit);
                }}
                className="h-7 w-20 bg-card-bg-solid px-2 font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          <p className="text-[11px] text-text-muted">
            با هر بار کلیک، مقدار فعلی خروجی{" "}
            <span dir="ltr" className="font-mono font-semibold text-text-primary">
              {isDecrease ? "-" : "+"}
              {absStep}
              {stepUnit === "percent" ? "%" : ` / ${maxDuty}`}
            </span>{" "}
            {isDecrease ? "کاهش" : "افزایش"} می‌یابد.
          </p>
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
                  actionOn: true,
                  powerToggle: false,
                  targetValue: undefined,
                })
              }
              className={`cursor-pointer rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                !action.powerToggle && action.actionOn
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              روشن (آخرین مقدار)
            </button>
            <button
              type="button"
              aria-pressed={!action.powerToggle && !action.actionOn}
              onClick={() =>
                onChange({
                  analogMode: "power",
                  actionOn: false,
                  powerToggle: false,
                  targetValue: undefined,
                })
              }
              className={`cursor-pointer rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                !action.powerToggle && !action.actionOn
                  ? "bg-destructive text-destructive-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              خاموش
            </button>
            <button
              type="button"
              aria-pressed={Boolean(action.powerToggle)}
              onClick={() =>
                onChange({
                  analogMode: "power",
                  actionOn: true,
                  powerToggle: true,
                  targetValue: undefined,
                })
              }
              className={`cursor-pointer rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors ${
                action.powerToggle
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              تغییر وضعیت (Toggle)
            </button>
          </div>
          <p className="text-[11px] text-text-muted">
            شدت روشنایی قبلی روی سخت‌افزار و داشبورد حفظ شده و در زمان روشن شدن بازگردانی می‌شود.
          </p>
        </div>
      )}
    </div>
  );
}

