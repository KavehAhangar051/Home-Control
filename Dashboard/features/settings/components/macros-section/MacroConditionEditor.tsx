"use client";

import { Clock, ShieldAlert } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  MacroActionCondition,
  MacroAnalogOutputOperator,
  MacroConditionParameter,
  MacroValueUnit,
  Segment,
} from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  adcValueToPercent,
  clampAdcResolution,
  getAdcMaxValue,
  isAnalogInputSegment,
  isDigitalInputSegment,
} from "@/features/iot/utils/analogInput";
import {
  analogDutyToPercent,
  clampPwmResolution,
  getAnalogMaxDuty,
  isAnalogOutputSegment,
} from "@/features/iot/utils/analogOutput";
import {
  createDefaultMacroCondition,
  isDigitalMacroOutput,
  isRangeOperator,
  MACRO_ANALOG_OUTPUT_OPERATOR_LABELS,
  MACRO_CONDITION_PARAMETER_META,
  MACRO_NUMERIC_OPERATOR_LABELS,
  MACRO_WEEKDAY_OPTIONS,
} from "@/features/iot/utils/macroEngine";

interface MacroConditionEditorProps {
  index: number;
  condition?: MacroActionCondition;
  segments: readonly Segment[];
  onChange: (next: MacroActionCondition | undefined) => void;
}

export function MacroConditionEditor({
  index,
  condition,
  segments,
  onChange,
}: MacroConditionEditorProps) {
  const baseId = useId();
  const paramId = `${baseId}-param`;
  const sourcePinId = `${baseId}-source`;
  const opId = `${baseId}-op`;
  const valId = `${baseId}-val`;
  const maxValId = `${baseId}-max`;
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;
  const msgId = `${baseId}-msg`;

  const pinsState = useIoTStore((state) => state.pinsState);
  const pinsAnalogValue = useIoTStore((state) => state.pinsAnalogValue);
  const pinsPwmResolution = useIoTStore((state) => state.pinsPwmResolution);

  const isEnabled = Boolean(condition?.enabled);

  const handleToggleEnabled = () => {
    if (isEnabled) {
      onChange(undefined);

      return;
    }

    onChange(
      condition
        ? { ...condition, enabled: true }
        : createDefaultMacroCondition("time_range", segments),
    );
  };

  const handleParameterChange = (nextParam: MacroConditionParameter) => {
    onChange(createDefaultMacroCondition(nextParam, segments, condition?.failureMessage ?? ""));
  };

  const patchCondition = (patch: Partial<MacroActionCondition>) => {
    if (!condition) return;
    onChange({ ...condition, ...patch });
  };

  const matchingSegments = (() => {
    if (!condition) return [];
    switch (condition.parameter) {
      case "digital_input":
        return segments.filter((s) => isDigitalInputSegment(s) && s.pin.trim().length > 0);
      case "analog_input":
        return segments.filter((s) => isAnalogInputSegment(s) && s.pin.trim().length > 0);
      case "digital_output":
        return segments.filter((s) => isDigitalMacroOutput(s));
      case "analog_output":
        return segments.filter((s) => isAnalogOutputSegment(s) && s.pin.trim().length > 0);
      default:
        return [];
    }
  })();

  const selectedSourcePin = String(condition?.sourcePin ?? "").trim();
  const selectedSourceSeg = selectedSourcePin
    ? segments.find((s) => s.pin.trim() === selectedSourcePin)
    : undefined;

  const isAnalogNumeric =
    condition?.parameter === "analog_input" ||
    (condition?.parameter === "analog_output" &&
      condition.operator !== "is_on" &&
      condition.operator !== "is_off");

  const unit: MacroValueUnit = condition?.unit === "raw" ? "raw" : "percent";
  const maxRawLimit = (() => {
    if (condition?.parameter === "analog_input") {
      return getAdcMaxValue(
        clampAdcResolution(
          pinsPwmResolution[selectedSourcePin] ?? selectedSourceSeg?.adcResolution,
        ),
      );
    }

    return getAnalogMaxDuty(
      clampPwmResolution(pinsPwmResolution[selectedSourcePin] ?? selectedSourceSeg?.pwmResolution),
    );
  })();
  const numericMaxLimit = unit === "percent" ? 100 : maxRawLimit;

  const liveReadoutText = (() => {
    if (!condition || !selectedSourcePin || !selectedSourceSeg) return null;

    if (condition.parameter === "digital_input" || condition.parameter === "digital_output") {
      const liveOn = Object.hasOwn(pinsState, selectedSourcePin)
        ? Boolean(pinsState[selectedSourcePin])
        : Boolean(selectedSourceSeg.state);

      return liveOn ? "وضعیت فعلی: روشن / فعال" : "وضعیت فعلی: خاموش / غیرفعال";
    }

    if (condition.parameter === "analog_input") {
      const res = clampAdcResolution(
        pinsPwmResolution[selectedSourcePin] ?? selectedSourceSeg.adcResolution,
      );
      const raw = pinsAnalogValue[selectedSourcePin] ?? selectedSourceSeg.analogValue ?? 0;

      return `مقدار فعلی: ${raw} (${adcValueToPercent(raw, res)}%)`;
    }

    if (condition.parameter === "analog_output") {
      const res = clampPwmResolution(
        pinsPwmResolution[selectedSourcePin] ?? selectedSourceSeg.pwmResolution,
      );
      const raw = pinsAnalogValue[selectedSourcePin] ?? selectedSourceSeg.analogValue ?? 0;

      return `شدت فعلی: ${analogDutyToPercent(raw, res)}% (${raw}/${getAnalogMaxDuty(res)})`;
    }

    return null;
  })();

  const selectedDays = condition?.days ?? [];

  const toggleWeekday = (day: number) => {
    if (!condition) return;
    const exists = selectedDays.includes(day);
    const nextDays = exists ? selectedDays.filter((d) => d !== day) : [...selectedDays, day];
    patchCondition({ days: nextDays });
  };

  return (
    <div className="rounded-xl border border-border-color/80 bg-bg-primary/50 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <ShieldAlert
            aria-hidden="true"
            className={`size-3.5 shrink-0 ${isEnabled ? "text-accent4" : "text-text-muted"}`}
          />
          <span>شرط اجرای این عملیات (بررسی در داشبورد)</span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label={`فعال‌سازی شرط برای عملیات ${index + 1}`}
          onClick={handleToggleEnabled}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
            isEnabled
              ? "border-accent4/60 bg-accent4/15 text-accent4"
              : "border-border-color bg-card-bg-solid text-text-muted hover:text-text-primary"
          }`}
        >
          {isEnabled ? "شرط فعال است" : "+ افزودن شرط"}
        </button>
      </div>

      {isEnabled && condition && (
        <div className="space-y-3 border-t border-border-color/70 pt-3 text-xs">
          {/* Parameter Type Selector */}
          <div className="space-y-1">
            <Label htmlFor={paramId} className="font-semibold text-text-secondary">
              بررسی بر اساس:
            </Label>
            <Select
              id={paramId}
              aria-label={`پارامتر شرط عملیات ${index + 1}`}
              value={condition.parameter}
              onChange={(e) => handleParameterChange(e.target.value as MacroConditionParameter)}
              className="bg-card-bg-solid text-xs"
            >
              {MACRO_CONDITION_PARAMETER_META.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>

          {/* 1. Time Range Parameter */}
          {condition.parameter === "time_range" && (
            <div className="space-y-2.5">
              <fieldset
                aria-label={`حالت بازه زمانی عملیات ${index + 1}`}
                className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-card-bg-solid p-1"
              >
                <button
                  type="button"
                  aria-pressed={condition.timeMode !== "outside"}
                  onClick={() => patchCondition({ timeMode: "inside" })}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    condition.timeMode !== "outside"
                      ? "bg-accent3 text-accent3-foreground"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  فقط در این بازه زمانی
                </button>
                <button
                  type="button"
                  aria-pressed={condition.timeMode === "outside"}
                  onClick={() => patchCondition({ timeMode: "outside" })}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    condition.timeMode === "outside"
                      ? "bg-accent4 text-accent4-foreground"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  خارج از این بازه زمانی
                </button>
              </fieldset>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor={startId} className="font-semibold text-text-secondary">
                    از ساعت:
                  </Label>
                  <Input
                    id={startId}
                    type="time"
                    dir="ltr"
                    value={condition.startTime ?? "18:00"}
                    onChange={(e) => patchCondition({ startTime: e.target.value })}
                    className="bg-card-bg-solid text-xs font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={endId} className="font-semibold text-text-secondary">
                    تا ساعت:
                  </Label>
                  <Input
                    id={endId}
                    type="time"
                    dir="ltr"
                    value={condition.endTime ?? "06:00"}
                    onChange={(e) => patchCondition({ endTime: e.target.value })}
                    className="bg-card-bg-solid text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock aria-hidden="true" className="size-3" />
                    روزهای هفته (اختیاری؛ خالی = همه روزها)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {MACRO_WEEKDAY_OPTIONS.map((w) => {
                    const active = selectedDays.includes(w.day);

                    return (
                      <button
                        key={w.day}
                        type="button"
                        aria-pressed={active}
                        title={w.label}
                        onClick={() => toggleWeekday(w.day)}
                        className={`min-w-8 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? "border-accent3 bg-accent3 text-accent3-foreground"
                            : "border-border-color bg-card-bg-solid text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {w.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. Segment-Based Parameters */}
          {condition.parameter !== "time_range" && (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <Label htmlFor={sourcePinId} className="font-semibold text-text-secondary">
                    سگمنت مرجع:
                  </Label>
                  {liveReadoutText && (
                    <span className="font-mono text-[10px] text-accent3 tabular-nums">
                      {liveReadoutText}
                    </span>
                  )}
                </div>
                <Select
                  id={sourcePinId}
                  aria-label={`سگمنت مرجع شرط عملیات ${index + 1}`}
                  value={selectedSourcePin}
                  onChange={(e) => patchCondition({ sourcePin: e.target.value })}
                  className="bg-card-bg-solid text-xs"
                >
                  <option value="">
                    {matchingSegments.length === 0
                      ? "هیچ سگمنتی از این نوع در داشبورد ثبت نشده است"
                      : "انتخاب سگمنت..."}
                  </option>
                  {selectedSourcePin &&
                    !matchingSegments.some((s) => s.pin.trim() === selectedSourcePin) && (
                      <option value={selectedSourcePin}>
                        GPIO {selectedSourcePin} (ثبت‌شده قبلی)
                      </option>
                    )}
                  {matchingSegments.map((seg) => (
                    <option key={seg.id} value={seg.pin.trim()}>
                      {seg.title} (GPIO {seg.pin})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Digital Input / Digital Output expected boolean */}
              {(condition.parameter === "digital_input" ||
                condition.parameter === "digital_output") && (
                <fieldset
                  aria-label={`وضعیت مورد انتظار شرط عملیات ${index + 1}`}
                  className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-card-bg-solid p-1"
                >
                  <button
                    type="button"
                    aria-pressed={Boolean(condition.expectedState)}
                    onClick={() => patchCondition({ expectedState: true })}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                      condition.expectedState
                        ? "bg-accent3 text-accent3-foreground"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {condition.parameter === "digital_input"
                      ? "فعال باشد (HIGH)"
                      : "روشن باشد (ON)"}
                  </button>
                  <button
                    type="button"
                    aria-pressed={!condition.expectedState}
                    onClick={() => patchCondition({ expectedState: false })}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                      !condition.expectedState
                        ? "bg-destructive text-destructive-foreground"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {condition.parameter === "digital_input"
                      ? "غیرفعال باشد (LOW)"
                      : "خاموش باشد (OFF)"}
                  </button>
                </fieldset>
              )}

              {/* Analog Input / Analog Output operator + unit + threshold(s) */}
              {(condition.parameter === "analog_input" ||
                condition.parameter === "analog_output") && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={opId} className="font-semibold text-text-secondary">
                        شرط مقایسه:
                      </Label>
                      <Select
                        id={opId}
                        value={
                          condition.operator ??
                          (condition.parameter === "analog_output" ? "is_on" : "gt")
                        }
                        onChange={(e) => {
                          const nextOp = e.target.value as MacroAnalogOutputOperator;
                          patchCondition({
                            operator: nextOp,
                            ...(isRangeOperator(nextOp) && condition.maxValue === undefined
                              ? { maxValue: Math.min(numericMaxLimit, (condition.value ?? 0) + 20) }
                              : {}),
                          });
                        }}
                        className="bg-card-bg-solid text-xs"
                      >
                        {(condition.parameter === "analog_output"
                          ? MACRO_ANALOG_OUTPUT_OPERATOR_LABELS
                          : MACRO_NUMERIC_OPERATOR_LABELS
                        ).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {isAnalogNumeric && (
                      <div className="space-y-1">
                        <span className="block font-semibold text-text-secondary">واحد مقدار:</span>
                        <fieldset
                          aria-label={`واحد مقدار شرط عملیات ${index + 1}`}
                          className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-card-bg-solid p-1"
                        >
                          <button
                            type="button"
                            aria-pressed={unit === "percent"}
                            onClick={() =>
                              patchCondition({
                                unit: "percent",
                                value: Math.min(100, condition.value ?? 50),
                                ...(isRangeOperator(condition.operator)
                                  ? { maxValue: Math.min(100, condition.maxValue ?? 80) }
                                  : {}),
                              })
                            }
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                              unit === "percent"
                                ? "bg-accent3 text-accent3-foreground"
                                : "text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            درصد (%)
                          </button>
                          <button
                            type="button"
                            aria-pressed={unit === "raw"}
                            onClick={() =>
                              patchCondition({
                                unit: "raw",
                                value: Math.min(maxRawLimit, condition.value ?? 0),
                                ...(isRangeOperator(condition.operator)
                                  ? {
                                      maxValue: Math.min(
                                        maxRawLimit,
                                        condition.maxValue ?? maxRawLimit,
                                      ),
                                    }
                                  : {}),
                              })
                            }
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                              unit === "raw"
                                ? "bg-accent3 text-accent3-foreground"
                                : "text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            عدد خام
                          </button>
                        </fieldset>
                      </div>
                    )}
                  </div>

                  {isAnalogNumeric && (
                    <div
                      className={`grid gap-2 ${isRangeOperator(condition.operator) ? "grid-cols-2" : "grid-cols-1"}`}
                    >
                      <div className="space-y-1">
                        <Label htmlFor={valId} className="font-semibold text-text-secondary">
                          {isRangeOperator(condition.operator) ? "از مقدار:" : "مقدار آستانه:"} (0
                          تا {numericMaxLimit}
                          {unit === "percent" ? "%" : ""})
                        </Label>
                        <Input
                          id={valId}
                          type="number"
                          dir="ltr"
                          min={0}
                          max={numericMaxLimit}
                          value={condition.value ?? 0}
                          onChange={(e) => {
                            const parsed = Number.parseInt(e.target.value, 10);
                            const nextVal = Number.isFinite(parsed)
                              ? Math.min(numericMaxLimit, Math.max(0, parsed))
                              : 0;
                            patchCondition({ value: nextVal });
                          }}
                          className="bg-card-bg-solid text-xs font-mono tabular-nums"
                        />
                      </div>

                      {isRangeOperator(condition.operator) && (
                        <div className="space-y-1">
                          <Label htmlFor={maxValId} className="font-semibold text-text-secondary">
                            تا مقدار: (0 تا {numericMaxLimit}
                            {unit === "percent" ? "%" : ""})
                          </Label>
                          <Input
                            id={maxValId}
                            type="number"
                            dir="ltr"
                            min={0}
                            max={numericMaxLimit}
                            value={condition.maxValue ?? numericMaxLimit}
                            onChange={(e) => {
                              const parsed = Number.parseInt(e.target.value, 10);
                              const nextMax = Number.isFinite(parsed)
                                ? Math.min(numericMaxLimit, Math.max(0, parsed))
                                : 0;
                              patchCondition({ maxValue: nextMax });
                            }}
                            className="bg-card-bg-solid text-xs font-mono tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom Failure Message */}
          <div className="space-y-1 border-t border-border-color/60 pt-2.5">
            <Label htmlFor={msgId} className="font-semibold text-text-secondary">
              پیام در صورت برقرار نبودن شرط:
            </Label>
            <Input
              id={msgId}
              value={condition.failureMessage}
              maxLength={140}
              onChange={(e) => patchCondition({ failureMessage: e.target.value })}
              placeholder="مثلاً: به دلیل روز بودن هوا، چراغ حیاط روشن نشد."
              className="bg-card-bg-solid text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
