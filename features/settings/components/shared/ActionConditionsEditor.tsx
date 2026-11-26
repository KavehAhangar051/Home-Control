"use client";

import { useId, useState } from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { ShieldCheck } from "@/components/ui/hugeicons-groups/controls";
import { Clock, Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  ConditionLogic,
  MacroActionCondition,
  MacroAnalogOutputOperator,
  MacroConditionParameter,
  MacroValueUnit,
  RuleGuardCondition,
  Segment,
  SegmentConditionParameter,
} from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  adcValueToPercent,
  clampAdcResolution,
  getAdcMaxValue,
  isAnalogInputSegment,
  isDigitalInputSegment,
  MAX_RULE_CONDITIONS_PER_ACTION,
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

interface ConditionRowProps {
  actionLabel: string;
  conditionIndex: number;
  condition: MacroActionCondition;
  segments: readonly Segment[];
  allowTimeRange: boolean;
  allowFailureMessage: boolean;
  excludeSourcePin?: string;
  onChange: (next: MacroActionCondition) => void;
  onRemove: () => void;
}

function getAvailableSegmentsForParam(
  parameter: MacroConditionParameter,
  segments: readonly Segment[],
  excludeSourcePin?: string,
): Segment[] {
  const excluded = excludeSourcePin?.trim();
  const notExcluded = (s: Segment) =>
    s.pin.trim().length > 0 && (!excluded || s.pin.trim() !== excluded);

  switch (parameter) {
    case "digital_input":
      return segments.filter((s) => isDigitalInputSegment(s) && notExcluded(s));
    case "analog_input":
      return segments.filter((s) => isAnalogInputSegment(s) && notExcluded(s));
    case "digital_output":
      return segments.filter((s) => isDigitalMacroOutput(s) && notExcluded(s));
    case "analog_output":
      return segments.filter((s) => isAnalogOutputSegment(s) && notExcluded(s));
    default:
      return [];
  }
}

function createInitialSegmentCondition(
  parameter: MacroConditionParameter,
  segments: readonly Segment[],
  excludeSourcePin?: string,
  previousFailureMessage = "",
): MacroActionCondition {
  const filteredSegments = excludeSourcePin
    ? segments.filter((s) => s.pin.trim() !== excludeSourcePin.trim())
    : segments;
  return createDefaultMacroCondition(parameter, filteredSegments, previousFailureMessage);
}

function ConditionRow({
  actionLabel,
  conditionIndex,
  condition,
  segments,
  allowTimeRange,
  allowFailureMessage,
  excludeSourcePin,
  onChange,
  onRemove,
}: ConditionRowProps) {
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

  const isEnabled = condition.enabled !== false;
  const parameterOptions = allowTimeRange
    ? MACRO_CONDITION_PARAMETER_META
    : MACRO_CONDITION_PARAMETER_META.filter((item) => item.id !== "time_range");

  const matchingSegments = getAvailableSegmentsForParam(
    condition.parameter,
    segments,
    excludeSourcePin,
  );

  const selectedSourcePin = String(condition.sourcePin ?? "").trim();
  const selectedSourceSeg = selectedSourcePin
    ? segments.find((s) => s.pin.trim() === selectedSourcePin)
    : undefined;

  const isAnalogNumeric =
    condition.parameter === "analog_input" ||
    (condition.parameter === "analog_output" &&
      condition.operator !== "is_on" &&
      condition.operator !== "is_off");

  const unit: MacroValueUnit = condition.unit === "raw" ? "raw" : "percent";
  const maxRawLimit = (() => {
    if (condition.parameter === "analog_input") {
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
    if (!selectedSourcePin || !selectedSourceSeg) return null;

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

  const selectedDays = condition.days ?? [];

  const patchCondition = (patch: Partial<MacroActionCondition>) => {
    onChange({ ...condition, ...patch });
  };

  const toggleWeekday = (day: number) => {
    const exists = selectedDays.includes(day);
    const nextDays = exists ? selectedDays.filter((d) => d !== day) : [...selectedDays, day];
    patchCondition({ days: nextDays });
  };

  return (
    <div
      className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
        isEnabled
          ? "border-border-color bg-card-bg-solid"
          : "border-border-color/60 bg-card-bg-solid opacity-65"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/60 pb-2">
        <span className="rounded-md border border-border-color bg-bg-primary px-2 py-0.5 text-[11px] font-bold text-text-primary">
          شرط {conditionIndex + 1}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={`وضعیت شرط ${conditionIndex + 1} برای ${actionLabel}`}
            onClick={() => patchCondition({ enabled: !isEnabled })}
            className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
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
            label={`حذف شرط ${conditionIndex + 1}`}
          />
        </div>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="space-y-1">
          <Label htmlFor={paramId} className="font-semibold text-text-secondary">
            بررسی بر اساس
          </Label>
          <Select
            id={paramId}
            aria-label={`پارامتر شرط ${conditionIndex + 1} ${actionLabel}`}
            value={condition.parameter}
            onChange={(e) => {
              const nextParam = e.target.value as MacroConditionParameter;
              onChange(
                createInitialSegmentCondition(
                  nextParam,
                  segments,
                  excludeSourcePin,
                  condition.failureMessage ?? "",
                ),
              );
            }}
            className="bg-bg-primary text-xs"
          >
            {parameterOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>

        {allowTimeRange && condition.parameter === "time_range" ? (
          <div className="space-y-2.5">
            <fieldset
              aria-label={`حالت بازه زمانی شرط ${conditionIndex + 1} ${actionLabel}`}
              className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-bg-primary p-1"
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
                    ? "bg-accent3 text-accent3-foreground"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                خارج از این بازه
              </button>
            </fieldset>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor={startId} className="font-semibold text-text-secondary">
                  از ساعت
                </Label>
                <Input
                  id={startId}
                  type="time"
                  dir="ltr"
                  value={condition.startTime ?? "18:00"}
                  onChange={(e) => patchCondition({ startTime: e.target.value })}
                  className="bg-bg-primary text-xs font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={endId} className="font-semibold text-text-secondary">
                  تا ساعت
                </Label>
                <Input
                  id={endId}
                  type="time"
                  dir="ltr"
                  value={condition.endTime ?? "06:00"}
                  onChange={(e) => patchCondition({ endTime: e.target.value })}
                  className="bg-bg-primary text-xs font-mono tabular-nums"
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
                          : "border-border-color bg-bg-primary text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {w.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <Label htmlFor={sourcePinId} className="font-semibold text-text-secondary">
                  قطعه مرجع
                </Label>
                {liveReadoutText && (
                  <span className="font-mono text-[10px] text-accent3 tabular-nums">
                    {liveReadoutText}
                  </span>
                )}
              </div>
              <Select
                id={sourcePinId}
                aria-label={`قطعه مرجع شرط ${conditionIndex + 1} ${actionLabel}`}
                value={selectedSourcePin}
                onChange={(e) => patchCondition({ sourcePin: e.target.value })}
                className="bg-bg-primary text-xs"
              >
                <option value="">
                  {matchingSegments.length === 0
                    ? "هیچ قطعه‌ای از این نوع در داشبورد ثبت نشده است"
                    : "انتخاب قطعه..."}
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

            {(condition.parameter === "digital_input" ||
              condition.parameter === "digital_output") && (
              <fieldset
                aria-label={`وضعیت مورد انتظار شرط ${conditionIndex + 1} ${actionLabel}`}
                className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-bg-primary p-1"
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
                  {condition.parameter === "digital_input" ? "فعال باشد" : "روشن باشد"}
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
                  {condition.parameter === "digital_input" ? "غیرفعال باشد" : "خاموش باشد"}
                </button>
              </fieldset>
            )}

            {(condition.parameter === "analog_input" ||
              condition.parameter === "analog_output") && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={opId} className="font-semibold text-text-secondary">
                      شرط مقایسه
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
                      className="bg-bg-primary text-xs"
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
                      <span className="block font-semibold text-text-secondary">واحد مقدار</span>
                      <fieldset
                        aria-label={`واحد مقدار شرط ${conditionIndex + 1} ${actionLabel}`}
                        className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-bg-primary p-1"
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
                        {isRangeOperator(condition.operator) ? "از مقدار" : "مقدار آستانه"} (0 تا{" "}
                        {numericMaxLimit}
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
                        className="bg-bg-primary text-xs font-mono tabular-nums"
                      />
                    </div>

                    {isRangeOperator(condition.operator) && (
                      <div className="space-y-1">
                        <Label htmlFor={maxValId} className="font-semibold text-text-secondary">
                          تا مقدار (0 تا {numericMaxLimit}
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
                          className="bg-bg-primary text-xs font-mono tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {allowFailureMessage && (
          <div className="space-y-1 border-t border-border-color/60 pt-2.5">
            <Label htmlFor={msgId} className="font-semibold text-text-secondary">
              پیام در صورت برقرار نبودن شرط
            </Label>
            <Input
              id={msgId}
              value={condition.failureMessage ?? ""}
              maxLength={140}
              onChange={(e) => patchCondition({ failureMessage: e.target.value })}
              placeholder="مثلاً: به دلیل روز بودن هوا، چراغ حیاط روشن نشد."
              className="bg-bg-primary text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export interface ActionConditionsEditorProps {
  actionLabel: string;
  conditions: readonly MacroActionCondition[];
  conditionLogic?: ConditionLogic;
  segments: readonly Segment[];
  allowTimeRange?: boolean;
  allowFailureMessage?: boolean;
  excludeSourcePin?: string;
  maxConditions?: number;
  title?: string;
  onChange: (nextConditions: MacroActionCondition[], nextLogic?: ConditionLogic) => void;
}

export function ActionConditionsEditor({
  actionLabel,
  conditions,
  conditionLogic,
  segments,
  allowTimeRange = false,
  allowFailureMessage = false,
  excludeSourcePin,
  maxConditions,
  title = "شرط‌های اجرا",
  onChange,
}: ActionConditionsEditorProps) {
  const [rowKeys, setRowKeys] = useState<string[]>(() =>
    conditions.map((_, pos) => `cnd-${pos}-${Math.random().toString(36).slice(2, 8)}`),
  );

  const activeCount = conditions.filter((c) => c.enabled !== false).length;
  const isMaxReached = maxConditions !== undefined && conditions.length >= maxConditions;
  const effectiveLogic: ConditionLogic = conditionLogic === "or" ? "or" : "and";

  const pickDefaultParameter = (): MacroConditionParameter => {
    if (allowTimeRange && conditions.length === 0) return "time_range";

    const candidateOrder: MacroConditionParameter[] = [
      "digital_output",
      "digital_input",
      "analog_input",
      "analog_output",
    ];
    for (const param of candidateOrder) {
      if (getAvailableSegmentsForParam(param, segments, excludeSourcePin).length > 0) {
        return param;
      }
    }
    return allowTimeRange ? "time_range" : "digital_output";
  };

  const handleAddCondition = () => {
    if (isMaxReached) return;
    const nextCond = createInitialSegmentCondition(
      pickDefaultParameter(),
      segments,
      excludeSourcePin,
    );
    setRowKeys((prev) => [
      ...prev.slice(0, conditions.length),
      `cnd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ]);
    onChange([...conditions, nextCond], effectiveLogic);
  };

  const handleUpdateCondition = (index: number, nextCond: MacroActionCondition) => {
    const next = conditions.map((item, i) => (i === index ? nextCond : item));
    onChange(next, effectiveLogic);
  };

  const handleRemoveCondition = (index: number) => {
    setRowKeys((prev) => prev.filter((_, i) => i !== index));
    const next = conditions.filter((_, i) => i !== index);
    onChange(next, next.length > 1 ? effectiveLogic : undefined);
  };

  return (
    <div className="rounded-xl border border-border-color/80 bg-bg-primary/50 p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <ShieldCheck
            aria-hidden="true"
            className={`size-3.5 shrink-0 ${activeCount > 0 ? "text-accent3" : "text-text-muted"}`}
          />
          <span>{title}</span>
          {conditions.length > 0 && (
            <span
              dir="ltr"
              className="rounded-md border border-border-color bg-card-bg-solid px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-text-secondary"
            >
              {conditions.length}
              {maxConditions !== undefined ? ` / ${maxConditions}` : ""}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={isMaxReached}
          onClick={handleAddCondition}
          className="inline-flex items-center gap-1 rounded-lg border border-border-color bg-card-bg-solid px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:border-accent3 hover:text-text-primary disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus aria-hidden="true" className="size-3" />
          <span>افزودن شرط</span>
        </button>
      </div>

      {conditions.length >= 2 && (
        <>
          <div className="text-[11px] leading-5 text-text-secondary">منطق ترکیب شرط‌ها</div>
          <fieldset
            aria-label={`منطق ترکیب شرط‌های ${actionLabel}`}
            className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-card-bg-solid p-1"
          >
            <button
            type="button"
            aria-pressed={effectiveLogic === "and"}
            onClick={() => onChange([...conditions], "and")}
            className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              effectiveLogic === "and"
                ? "bg-accent3 text-accent3-foreground"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            همه شرط‌ها (AND)
          </button>
          <button
            type="button"
            aria-pressed={effectiveLogic === "or"}
            onClick={() => onChange([...conditions], "or")}
            className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
              effectiveLogic === "or"
                ? "bg-accent3 text-accent3-foreground"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            حداقل یکی (OR)
            </button>
          </fieldset>
        </>
      )}

      {conditions.length > 0 && (
        <div className="space-y-2.5">
          {conditions.map((cond, cIdx) => {
            const key = rowKeys[cIdx] ?? `cnd-${cond.parameter}-${cIdx}`;
            return (
              <ConditionRow
                key={key}
                actionLabel={actionLabel}
                conditionIndex={cIdx}
                condition={cond}
                segments={segments}
                allowTimeRange={allowTimeRange}
                allowFailureMessage={allowFailureMessage}
                excludeSourcePin={excludeSourcePin}
                onChange={(nextCond) => handleUpdateCondition(cIdx, nextCond)}
                onRemove={() => handleRemoveCondition(cIdx)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface RuleGuardConditionsEditorProps {
  actionLabel: string;
  conditions?: readonly RuleGuardCondition[];
  conditionLogic?: ConditionLogic;
  segments: readonly Segment[];
  excludeSourcePin: string;
  onChange: (nextConditions: RuleGuardCondition[] | undefined, nextLogic?: ConditionLogic) => void;
}

export function RuleGuardConditionsEditor({
  actionLabel,
  conditions,
  conditionLogic,
  segments,
  excludeSourcePin,
  onChange,
}: RuleGuardConditionsEditorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-text-secondary">
        این شرط‌ها روی خود ESP32 و پیش از اجرای عملیات بررسی می‌شوند؛ برای اجرای آن‌ها به اتصال
        لحظه‌ای داشبورد نیاز نیست.
      </p>
      <ActionConditionsEditor
        actionLabel={actionLabel}
        title="شرط‌های پیش‌نیاز روی ESP32"
        conditions={(conditions ?? []).map((c) => ({ ...c, failureMessage: "" }))}
        conditionLogic={conditionLogic}
        segments={segments}
        allowTimeRange={false}
        allowFailureMessage={false}
        excludeSourcePin={excludeSourcePin}
        maxConditions={MAX_RULE_CONDITIONS_PER_ACTION}
        onChange={(nextConds, nextLogic) => {
          const guardConds: RuleGuardCondition[] = nextConds
            .filter((c) => c.parameter !== "time_range")
            .map(({ failureMessage: _ignored, parameter, sourcePin, ...rest }) => ({
              ...rest,
              parameter: parameter as SegmentConditionParameter,
              sourcePin: sourcePin ?? "",
            }));
          onChange(
            guardConds.length > 0 ? guardConds : undefined,
            guardConds.length > 1 ? nextLogic : undefined,
          );
        }}
      />
    </div>
  );
}
