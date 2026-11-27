"use client";

import { useId } from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  ConditionLogic,
  MacroActionCondition,
  MacroAnalogOutputOperator,
  MacroConditionParameter,
  MacroNumericOperator,
  MacroValueUnit,
  RuleGuardCondition,
  Segment,
  SegmentConditionParameter,
} from "@/features/iot/hooks/store/types";
import {
  clampAdcResolution,
  getAdcMaxValue,
  isAnalogInputSegment,
  isDigitalInputSegment,
  MAX_RULE_CONDITIONS_PER_ACTION,
} from "@/features/iot/utils/analogInput";
import {
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

interface ActionConditionsEditorProps {
  actionLabel: string;
  title?: string;
  conditions: readonly MacroActionCondition[];
  conditionLogic?: ConditionLogic;
  segments: readonly Segment[];
  allowTimeRange?: boolean;
  allowFailureMessage?: boolean;
  maxConditions?: number;
  excludeSourcePin?: string;
  onChange: (nextConditions: MacroActionCondition[], nextLogic?: ConditionLogic) => void;
}

function createInitialCondition(
  segments: readonly Segment[],
  allowTimeRange: boolean,
  excludeSourcePin?: string,
): MacroActionCondition {
  const usableSegments = excludeSourcePin
    ? segments.filter((s) => s.pin.trim() !== excludeSourcePin.trim())
    : segments;

  if (allowTimeRange) {
    return createDefaultMacroCondition("time_range", usableSegments);
  }

  if (usableSegments.some((s) => isDigitalInputSegment(s) && s.pin.trim().length > 0)) {
    return createDefaultMacroCondition("digital_input", usableSegments);
  }
  if (usableSegments.some((s) => isAnalogInputSegment(s) && s.pin.trim().length > 0)) {
    return createDefaultMacroCondition("analog_input", usableSegments);
  }
  if (usableSegments.some((s) => isDigitalMacroOutput(s))) {
    return createDefaultMacroCondition("digital_output", usableSegments);
  }
  if (usableSegments.some((s) => isAnalogOutputSegment(s) && s.pin.trim().length > 0)) {
    return createDefaultMacroCondition("analog_output", usableSegments);
  }

  return createDefaultMacroCondition("digital_input", usableSegments);
}

export function ActionConditionsEditor({
  actionLabel,
  title = "شرط‌های اجرای عملیات",
  conditions,
  conditionLogic = "and",
  segments,
  allowTimeRange = true,
  allowFailureMessage = true,
  maxConditions = 6,
  excludeSourcePin,
  onChange,
}: ActionConditionsEditorProps) {
  const baseId = useId();
  const excludedPin = excludeSourcePin?.trim();
  const eligibleSegments = excludedPin
    ? segments.filter((s) => s.pin.trim() !== excludedPin)
    : segments;

  const parameterOptions = MACRO_CONDITION_PARAMETER_META.filter(
    (meta) => allowTimeRange || meta.id !== "time_range",
  );

  const canAddMore = conditions.length < maxConditions;

  const handleAddCondition = () => {
    if (!canAddMore) return;
    const nextCond = createInitialCondition(segments, allowTimeRange, excludeSourcePin);
    const nextList = [...conditions, nextCond];
    onChange(nextList, nextList.length > 1 ? conditionLogic : undefined);
  };

  const handleUpdateCondition = (index: number, nextCond: MacroActionCondition) => {
    const nextList = conditions.map((c, idx) => (idx === index ? nextCond : c));
    onChange(nextList, nextList.length > 1 ? conditionLogic : undefined);
  };

  const handleRemoveCondition = (index: number) => {
    const nextList = conditions.filter((_, idx) => idx !== index);
    onChange(nextList, nextList.length > 1 ? conditionLogic : undefined);
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-border-color/80 bg-bg-primary/60 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-text-primary">{title}</span>
          {conditions.length > 0 && (
            <span
              dir="ltr"
              className="rounded-md border border-border-color bg-card-bg-solid px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-text-secondary"
            >
              {conditions.length} / {maxConditions}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddCondition}
          disabled={!canAddMore}
          aria-label={`افزودن شرط به ${actionLabel}`}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-accent3/50 bg-accent3/10 px-2.5 py-1 text-[11px] font-semibold text-accent3 transition-colors hover:bg-accent3 hover:text-accent3-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          افزودن شرط
        </button>
      </div>

      {conditions.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-color bg-card-bg-solid px-2.5 py-1.5">
          <span className="text-[11px] font-medium text-text-secondary">
            ترکیب منطقی شرط‌های {actionLabel}:
          </span>
          <div className="inline-flex rounded-lg border border-border-color bg-bg-primary p-0.5">
            <button
              type="button"
              aria-pressed={conditionLogic !== "or"}
              onClick={() => onChange([...conditions], "and")}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                conditionLogic !== "or"
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              همه شرط‌ها (AND)
            </button>
            <button
              type="button"
              aria-pressed={conditionLogic === "or"}
              onClick={() => onChange([...conditions], "or")}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                conditionLogic === "or"
                  ? "bg-accent3 text-accent3-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              حداقل یک شرط (OR)
            </button>
          </div>
        </div>
      )}

      {conditions.length === 0 ? (
        <p className="text-[11px] leading-5 text-text-muted">
          شرطی تعریف نشده است؛ عملیات بدون محدودیت اجرا می‌شود.
        </p>
      ) : (
        <div className="space-y-2.5">
          {conditions.map((cond, idx) => {
            const condId = `${baseId}-cond-${idx}`;
            const paramId = `${condId}-param`;
            const sourceId = `${condId}-source`;
            const opId = `${condId}-op`;
            const unitId = `${condId}-unit`;
            const valId = `${condId}-val`;
            const maxValId = `${condId}-maxval`;
            const startId = `${condId}-start`;
            const endId = `${condId}-end`;
            const timeModeId = `${condId}-timemode`;
            const msgId = `${condId}-msg`;

            const matchingSegments = eligibleSegments.filter((seg) => {
              if (seg.type === "placeholder" || !seg.pin.trim()) return false;
              switch (cond.parameter) {
                case "digital_input":
                  return isDigitalInputSegment(seg);
                case "analog_input":
                  return isAnalogInputSegment(seg);
                case "digital_output":
                  return isDigitalMacroOutput(seg);
                case "analog_output":
                  return isAnalogOutputSegment(seg);
                default:
                  return false;
              }
            });

            const selectedSegment = matchingSegments.find(
              (s) => s.pin.trim() === (cond.sourcePin ?? "").trim(),
            );
            const rawMaxLimit =
              cond.parameter === "analog_input"
                ? getAdcMaxValue(clampAdcResolution(selectedSegment?.adcResolution))
                : getAnalogMaxDuty(clampPwmResolution(selectedSegment?.pwmResolution));
            const numericMax = cond.unit === "raw" ? rawMaxLimit : 100;
            const showNumericFields =
              cond.parameter === "analog_input" ||
              (cond.parameter === "analog_output" &&
                cond.operator !== "is_on" &&
                cond.operator !== "is_off");

            return (
              <div
                key={condId}
                className={`space-y-2.5 rounded-xl border border-border-color bg-card-bg-solid p-3 ${
                  cond.enabled === false ? "opacity-65" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-color/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-bg-primary px-2 py-0.5 text-[11px] font-bold text-text-primary">
                      شرط {idx + 1}
                    </span>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-text-secondary">
                      <input
                        type="checkbox"
                        checked={cond.enabled !== false}
                        onChange={(e) =>
                          handleUpdateCondition(idx, { ...cond, enabled: e.target.checked })
                        }
                        className="size-3.5 accent-accent3"
                      />
                      <span>فعال</span>
                    </label>
                  </div>

                  <DeleteButton
                    size="sm"
                    resetAfter={0}
                    onConfirm={() => handleRemoveCondition(idx)}
                    label={`حذف شرط ${idx + 1} از ${actionLabel}`}
                  />
                </div>

                {/* Condition parameter type */}
                <div className="space-y-1">
                  <Label htmlFor={paramId} className="font-semibold text-text-secondary">
                    نوع شرط
                  </Label>
                  <Select
                    id={paramId}
                    value={cond.parameter}
                    onChange={(e) => {
                      const nextParam = e.target.value as MacroConditionParameter;
                      const rebuilt = createDefaultMacroCondition(
                        nextParam,
                        eligibleSegments,
                        cond.failureMessage,
                      );
                      handleUpdateCondition(idx, { ...rebuilt, enabled: cond.enabled });
                    }}
                    className="bg-bg-primary text-xs"
                  >
                    {parameterOptions.map((meta) => (
                      <option key={meta.id} value={meta.id}>
                        {meta.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {cond.parameter === "time_range" ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor={startId} className="font-semibold text-text-secondary">
                          از ساعت
                        </Label>
                        <Input
                          id={startId}
                          type="time"
                          dir="ltr"
                          value={cond.startTime ?? "18:00"}
                          onChange={(e) =>
                            handleUpdateCondition(idx, { ...cond, startTime: e.target.value })
                          }
                          className="bg-bg-primary font-mono text-xs"
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
                          value={cond.endTime ?? "06:00"}
                          onChange={(e) =>
                            handleUpdateCondition(idx, { ...cond, endTime: e.target.value })
                          }
                          className="bg-bg-primary font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={timeModeId} className="font-semibold text-text-secondary">
                          وضعیت بازه
                        </Label>
                        <Select
                          id={timeModeId}
                          value={cond.timeMode === "outside" ? "outside" : "inside"}
                          onChange={(e) =>
                            handleUpdateCondition(idx, {
                              ...cond,
                              timeMode: e.target.value === "outside" ? "outside" : "inside",
                            })
                          }
                          className="bg-bg-primary text-xs"
                        >
                          <option value="inside">داخل بازه زمانی</option>
                          <option value="outside">خارج از بازه زمانی</option>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="block text-[11px] font-medium text-text-secondary">
                        روزهای هفته (در صورت انتخاب نشدن، هر روز بررسی می‌شود)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {MACRO_WEEKDAY_OPTIONS.map((w) => {
                          const activeDays = cond.days ?? [];
                          const selected = activeDays.includes(w.day);
                          return (
                            <button
                              key={w.day}
                              type="button"
                              aria-pressed={selected}
                              title={w.label}
                              onClick={() => {
                                const nextDays = selected
                                  ? activeDays.filter((d) => d !== w.day)
                                  : [...activeDays, w.day];
                                handleUpdateCondition(idx, {
                                  ...cond,
                                  days: nextDays.length > 0 ? nextDays : undefined,
                                });
                              }}
                              className={`min-h-8 min-w-8 cursor-pointer rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                                selected
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
                      <Label htmlFor={sourceId} className="font-semibold text-text-secondary">
                        قطعه مرجع شرط
                      </Label>
                      <Select
                        id={sourceId}
                        value={cond.sourcePin ?? ""}
                        onChange={(e) =>
                          handleUpdateCondition(idx, { ...cond, sourcePin: e.target.value })
                        }
                        className="bg-bg-primary text-xs"
                      >
                        <option value="">
                          {matchingSegments.length === 0
                            ? "قطعه متناسبی در داشبورد یافت نشد"
                            : "انتخاب قطعه مرجع..."}
                        </option>
                        {matchingSegments.map((seg) => (
                          <option key={seg.id} value={seg.pin.trim()}>
                            {seg.title} — GPIO {seg.pin}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {(cond.parameter === "digital_input" ||
                      cond.parameter === "digital_output") && (
                      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border-color bg-bg-primary p-1">
                        <button
                          type="button"
                          aria-pressed={Boolean(cond.expectedState)}
                          onClick={() =>
                            handleUpdateCondition(idx, { ...cond, expectedState: true })
                          }
                          className={`cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                            cond.expectedState
                              ? "bg-accent3 text-accent3-foreground"
                              : "text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {cond.parameter === "digital_input" ? "فعال (HIGH)" : "روشن"}
                        </button>
                        <button
                          type="button"
                          aria-pressed={!cond.expectedState}
                          onClick={() =>
                            handleUpdateCondition(idx, { ...cond, expectedState: false })
                          }
                          className={`cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                            !cond.expectedState
                              ? "bg-destructive text-destructive-foreground"
                              : "text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {cond.parameter === "digital_input" ? "غیرفعال (LOW)" : "خاموش"}
                        </button>
                      </div>
                    )}

                    {(cond.parameter === "analog_input" || cond.parameter === "analog_output") && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={opId} className="font-semibold text-text-secondary">
                              عملگر مقایسه
                            </Label>
                            <Select
                              id={opId}
                              value={
                                cond.operator ??
                                (cond.parameter === "analog_output" ? "is_on" : "gt")
                              }
                              onChange={(e) => {
                                const nextOp = e.target.value as MacroAnalogOutputOperator;
                                handleUpdateCondition(idx, {
                                  ...cond,
                                  operator:
                                    cond.parameter === "analog_input"
                                      ? (nextOp as MacroNumericOperator)
                                      : nextOp,
                                });
                              }}
                              className="bg-bg-primary text-xs"
                            >
                              {(cond.parameter === "analog_output"
                                ? MACRO_ANALOG_OUTPUT_OPERATOR_LABELS
                                : MACRO_NUMERIC_OPERATOR_LABELS
                              ).map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </Select>
                          </div>

                          {showNumericFields && (
                            <div className="space-y-1">
                              <Label htmlFor={unitId} className="font-semibold text-text-secondary">
                                واحد مقدار
                              </Label>
                              <Select
                                id={unitId}
                                value={cond.unit === "raw" ? "raw" : "percent"}
                                onChange={(e) => {
                                  const nextUnit: MacroValueUnit =
                                    e.target.value === "raw" ? "raw" : "percent";
                                  handleUpdateCondition(idx, {
                                    ...cond,
                                    unit: nextUnit,
                                    value:
                                      nextUnit === "percent" ? 50 : Math.round(rawMaxLimit / 2),
                                    ...(isRangeOperator(cond.operator)
                                      ? {
                                          maxValue:
                                            nextUnit === "percent"
                                              ? 80
                                              : Math.round(rawMaxLimit * 0.8),
                                        }
                                      : {}),
                                  });
                                }}
                                className="bg-bg-primary text-xs"
                              >
                                <option value="percent">درصد (۰ تا ۱۰۰٪)</option>
                                <option value="raw">مقدار خام (۰ تا {rawMaxLimit})</option>
                              </Select>
                            </div>
                          )}
                        </div>

                        {showNumericFields && (
                          <div
                            className={`grid gap-2 ${
                              isRangeOperator(cond.operator) ? "grid-cols-2" : "grid-cols-1"
                            }`}
                          >
                            <div className="space-y-1">
                              <Label htmlFor={valId} className="font-semibold text-text-secondary">
                                {isRangeOperator(cond.operator) ? "حداقل مقدار" : "مقدار آستانه"}
                              </Label>
                              <Input
                                id={valId}
                                type="number"
                                dir="ltr"
                                min={0}
                                max={numericMax}
                                value={cond.value ?? 0}
                                onChange={(e) => {
                                  const parsed = Number.parseInt(e.target.value, 10);
                                  handleUpdateCondition(idx, {
                                    ...cond,
                                    value: Number.isFinite(parsed)
                                      ? Math.min(numericMax, Math.max(0, parsed))
                                      : 0,
                                  });
                                }}
                                className="bg-bg-primary font-mono text-xs tabular-nums"
                              />
                            </div>

                            {isRangeOperator(cond.operator) && (
                              <div className="space-y-1">
                                <Label
                                  htmlFor={maxValId}
                                  className="font-semibold text-text-secondary"
                                >
                                  حداکثر مقدار
                                </Label>
                                <Input
                                  id={maxValId}
                                  type="number"
                                  dir="ltr"
                                  min={0}
                                  max={numericMax}
                                  value={cond.maxValue ?? numericMax}
                                  onChange={(e) => {
                                    const parsed = Number.parseInt(e.target.value, 10);
                                    handleUpdateCondition(idx, {
                                      ...cond,
                                      maxValue: Number.isFinite(parsed)
                                        ? Math.min(numericMax, Math.max(0, parsed))
                                        : 0,
                                    });
                                  }}
                                  className="bg-bg-primary font-mono text-xs tabular-nums"
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
                  <div className="space-y-1">
                    <Label htmlFor={msgId} className="font-semibold text-text-secondary">
                      پیام خطای دلخواه در صورت برقرار نبودن شرط (اختیاری)
                    </Label>
                    <Input
                      id={msgId}
                      type="text"
                      value={cond.failureMessage ?? ""}
                      onChange={(e) =>
                        handleUpdateCondition(idx, { ...cond, failureMessage: e.target.value })
                      }
                      placeholder="مثال: در پارکینگ بسته است"
                      className="bg-bg-primary text-xs"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface RuleGuardConditionsEditorProps {
  actionLabel: string;
  title?: string;
  conditions?: readonly RuleGuardCondition[];
  conditionLogic?: ConditionLogic;
  segments: readonly Segment[];
  excludeSourcePin?: string;
  onChange: (nextConditions: RuleGuardCondition[] | undefined, nextLogic?: ConditionLogic) => void;
}

export function RuleGuardConditionsEditor({
  actionLabel,
  title = "شرط‌های نگهبان سخت‌افزاری",
  conditions = [],
  conditionLogic,
  segments,
  excludeSourcePin,
  onChange,
}: RuleGuardConditionsEditorProps) {
  const mapped: MacroActionCondition[] = conditions.map((cond) => ({
    ...cond,
    failureMessage: "",
  }));

  return (
    <ActionConditionsEditor
      actionLabel={actionLabel}
      title={title}
      conditions={mapped}
      conditionLogic={conditionLogic}
      segments={segments}
      allowTimeRange={false}
      allowFailureMessage={false}
      maxConditions={MAX_RULE_CONDITIONS_PER_ACTION}
      excludeSourcePin={excludeSourcePin}
      onChange={(nextList, nextLogic) => {
        const cleaned: RuleGuardCondition[] = nextList
          .filter((c) => c.parameter !== "time_range")
          .map(({ failureMessage: _ignored, parameter, sourcePin, ...rest }) => ({
            ...rest,
            parameter: parameter as SegmentConditionParameter,
            sourcePin: sourcePin ?? "",
          }));

        onChange(
          cleaned.length > 0 ? cleaned : undefined,
          cleaned.length > 1 ? (nextLogic ?? "and") : undefined,
        );
      }}
    />
  );
}
