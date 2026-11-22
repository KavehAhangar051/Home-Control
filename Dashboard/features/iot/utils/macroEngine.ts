import type {
  Macro,
  MacroAction,
  MacroActionCondition,
  MacroAnalogOutputOperator,
  MacroConditionParameter,
  MacroNumericOperator,
  MacroValueUnit,
} from "@/features/iot/services/config/types";
import {
  adcValueToPercent,
  clampAdcResolution,
  getAdcMaxValue,
  isAnalogInputSegment,
  isDigitalInputSegment,
  isReadOnlyInputSegment,
} from "@/features/iot/utils/analogInput";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  isAnalogOutputSegment,
  MAX_ANALOG_OUTPUT_VALUE,
} from "@/features/iot/utils/analogOutput";

export interface MacroSegmentSnapshot {
  id?: string;
  pin: string;
  title: string;
  type: string;
  state?: boolean;
  analogValue?: number;
  pwmResolution?: number;
  adcResolution?: number;
}

export interface MacroEvaluationContext {
  segments: readonly MacroSegmentSnapshot[];
  pinsState: Readonly<Record<string, boolean>>;
  pinsAnalogValue: Readonly<Record<string, number>>;
  pinsPwmResolution?: Readonly<Record<string, number>>;
  now?: Date;
}

export interface MacroConditionEvaluationResult {
  passed: boolean;
  fallbackReason?: string;
}

export interface MacroAnalogDispatchAction {
  targetPin: string;
  targetValue: number;
  actionOn: boolean;
}

export interface MacroDigitalDispatchAction {
  targetPin: string;
  actionOn: boolean;
}

export interface MacroBlockedAction {
  action: MacroAction;
  index: number;
  message: string;
}

export interface MacroExecutionPlan {
  digitalActions: MacroDigitalDispatchAction[];
  analogActions: MacroAnalogDispatchAction[];
  blockedActions: MacroBlockedAction[];
  passedCount: number;
  blockedCount: number;
}

export const MACRO_CONDITION_PARAMETER_META: ReadonlyArray<{
  id: MacroConditionParameter;
  label: string;
  hint: string;
}> = [
  {
    id: "time_range",
    label: "زمان کلیک شدن دکمه",
    hint: "بررسی ساعت (و در صورت نیاز روزهای هفته) هنگام کلیک",
  },
  {
    id: "digital_input",
    label: "وضعیت ورودی دیجیتال",
    hint: "بررسی فعال یا غیرفعال بودن یک کلید/سنسور دیجیتال",
  },
  {
    id: "analog_input",
    label: "وضعیت ورودی آنالوگ (ADC)",
    hint: "مقایسه مقدار زنده سنسور آنالوگ بر حسب درصد یا عدد خام",
  },
  {
    id: "digital_output",
    label: "وضعیت خروجی دیجیتال",
    hint: "بررسی روشن یا خاموش بودن یک رله/خروجی دیجیتال",
  },
  {
    id: "analog_output",
    label: "وضعیت خروجی آنالوگ (PWM)",
    hint: "بررسی وضعیت یا میزان شدت زنده یک خروجی آنالوگ PWM",
  },
];

export const MACRO_NUMERIC_OPERATOR_LABELS: ReadonlyArray<{
  value: MacroNumericOperator;
  label: string;
}> = [
  { value: "gt", label: "بیشتر از (>)" },
  { value: "gte", label: "بیشتر یا مساوی (≥)" },
  { value: "lt", label: "کمتر از (<)" },
  { value: "lte", label: "کمتر یا مساوی (≤)" },
  { value: "eq", label: "برابر با (=)" },
  { value: "between", label: "داخل بازه (بین دو مقدار)" },
  { value: "outside", label: "خارج از بازه" },
];

export const MACRO_ANALOG_OUTPUT_OPERATOR_LABELS: ReadonlyArray<{
  value: MacroAnalogOutputOperator;
  label: string;
}> = [
  { value: "is_on", label: "روشن باشد" },
  { value: "is_off", label: "خاموش باشد" },
  ...MACRO_NUMERIC_OPERATOR_LABELS,
];

export const MACRO_WEEKDAY_OPTIONS: ReadonlyArray<{
  day: number;
  shortLabel: string;
  label: string;
}> = [
  { day: 6, shortLabel: "ش", label: "شنبه" },
  { day: 0, shortLabel: "ی", label: "یکشنبه" },
  { day: 1, shortLabel: "د", label: "دوشنبه" },
  { day: 2, shortLabel: "س", label: "سه‌شنبه" },
  { day: 3, shortLabel: "چ", label: "چهارشنبه" },
  { day: 4, shortLabel: "پ", label: "پنج‌شنبه" },
  { day: 5, shortLabel: "ج", label: "جمعه" },
];

const VALID_PARAMETERS = new Set<MacroConditionParameter>([
  "time_range",
  "digital_input",
  "analog_input",
  "digital_output",
  "analog_output",
]);

const VALID_NUMERIC_OPERATORS = new Set<MacroNumericOperator>([
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
  "between",
  "outside",
]);

const VALID_ANALOG_OUTPUT_OPERATORS = new Set<MacroAnalogOutputOperator>([
  "is_on",
  "is_off",
  "gt",
  "gte",
  "lt",
  "lte",
  "eq",
  "between",
  "outside",
]);

export function isRangeOperator(op?: MacroAnalogOutputOperator): boolean {
  return op === "between" || op === "outside";
}

export function isControllableMacroOutput(segment?: MacroSegmentSnapshot | null): boolean {
  if (!segment) return false;
  if (segment.type === "placeholder" || isReadOnlyInputSegment(segment)) return false;

  return segment.pin.trim().length > 0;
}

export function isDigitalMacroOutput(segment?: MacroSegmentSnapshot | null): boolean {
  return isControllableMacroOutput(segment) && !isAnalogOutputSegment(segment);
}

/** Parses strict `"HH:MM"` into minutes since midnight (`0..1439`), or `null` if invalid. */
export function parseClockTimeMinutes(raw?: string | null): number | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx <= 0 || colonIdx !== trimmed.lastIndexOf(":")) return null;

  const hStr = trimmed.slice(0, colonIdx);
  const mStr = trimmed.slice(colonIdx + 1);
  if (hStr.length < 1 || hStr.length > 2 || mStr.length !== 2) return null;
  if (!/^\d+$/.test(hStr) || !/^\d+$/.test(mStr)) return null;

  const hours = Number.parseInt(hStr, 10);
  const minutes = Number.parseInt(mStr, 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function compareNumericValue(
  current: number,
  operator: MacroNumericOperator,
  primaryValue: number,
  secondaryMax?: number,
): boolean {
  switch (operator) {
    case "gt":
      return current > primaryValue;
    case "gte":
      return current >= primaryValue;
    case "lt":
      return current < primaryValue;
    case "lte":
      return current <= primaryValue;
    case "eq":
      return current === primaryValue;
    case "between": {
      const boundB = secondaryMax ?? primaryValue;
      const lo = Math.min(primaryValue, boundB);
      const hi = Math.max(primaryValue, boundB);

      return current >= lo && current <= hi;
    }
    case "outside": {
      const boundB = secondaryMax ?? primaryValue;
      const lo = Math.min(primaryValue, boundB);
      const hi = Math.max(primaryValue, boundB);

      return current < lo || current > hi;
    }
  }
}

export function createDefaultMacroCondition(
  parameter: MacroConditionParameter,
  segments: readonly MacroSegmentSnapshot[],
  previousFailureMessage = "",
): MacroActionCondition {
  const base = {
    enabled: true,
    parameter,
    failureMessage: previousFailureMessage,
  };

  switch (parameter) {
    case "time_range":
      return {
        ...base,
        startTime: "18:00",
        endTime: "06:00",
        timeMode: "inside",
        days: [],
      };
    case "digital_input": {
      const firstInput = segments.find((s) => isDigitalInputSegment(s) && s.pin.trim().length > 0);

      return {
        ...base,
        sourcePin: firstInput?.pin.trim() ?? "",
        expectedState: true,
      };
    }
    case "analog_input": {
      const firstAdc = segments.find((s) => isAnalogInputSegment(s) && s.pin.trim().length > 0);

      return {
        ...base,
        sourcePin: firstAdc?.pin.trim() ?? "",
        operator: "gt",
        unit: "percent",
        value: 50,
        maxValue: 80,
      };
    }
    case "digital_output": {
      const firstDigitalOut = segments.find((s) => isDigitalMacroOutput(s));

      return {
        ...base,
        sourcePin: firstDigitalOut?.pin.trim() ?? "",
        expectedState: true,
      };
    }
    case "analog_output": {
      const firstPwmOut = segments.find((s) => isAnalogOutputSegment(s) && s.pin.trim().length > 0);

      return {
        ...base,
        sourcePin: firstPwmOut?.pin.trim() ?? "",
        operator: "is_on",
        unit: "percent",
        value: 50,
        maxValue: 80,
      };
    }
  }
}

/**
 * Evaluates a single dashboard-side macro action condition against live state at click time.
 */
export function evaluateMacroCondition(
  condition: MacroActionCondition | undefined | null,
  context: MacroEvaluationContext,
): MacroConditionEvaluationResult {
  if (!condition?.enabled) {
    return { passed: true };
  }

  const now = context.now ?? new Date();

  switch (condition.parameter) {
    case "time_range": {
      const startMin = parseClockTimeMinutes(condition.startTime);
      const endMin = parseClockTimeMinutes(condition.endTime);

      if (startMin === null || endMin === null) {
        return { passed: false, fallbackReason: "بازه زمانی شرط معتبر نیست." };
      }

      const days = Array.isArray(condition.days) ? condition.days : [];
      const dayMatches = days.length === 0 || days.includes(now.getDay());
      const nowMin = now.getHours() * 60 + now.getMinutes();

      const inClockWindow =
        startMin <= endMin
          ? nowMin >= startMin && nowMin <= endMin
          : nowMin >= startMin || nowMin <= endMin;

      const isInsideSchedule = dayMatches && inClockWindow;
      const passed = condition.timeMode === "outside" ? !isInsideSchedule : isInsideSchedule;

      return {
        passed,
        fallbackReason: passed ? undefined : "زمان فعلی با بازه مجاز تعریف‌شده هم‌خوانی ندارد.",
      };
    }

    case "digital_input":
    case "digital_output": {
      const pin = String(condition.sourcePin ?? "").trim();
      if (!pin) {
        return { passed: false, fallbackReason: "پایه مرجع شرط انتخاب نشده است." };
      }

      const segment = context.segments.find((s) => s.pin.trim() === pin);
      const liveState = Object.hasOwn(context.pinsState, pin)
        ? Boolean(context.pinsState[pin])
        : Boolean(segment?.state);
      const expected = Boolean(condition.expectedState);
      const passed = liveState === expected;

      return {
        passed,
        fallbackReason: passed
          ? undefined
          : `وضعیت «${segment?.title ?? `GPIO ${pin}`}» با شرط تعیین‌شده مطابقت ندارد.`,
      };
    }

    case "analog_input": {
      const pin = String(condition.sourcePin ?? "").trim();
      if (!pin) {
        return { passed: false, fallbackReason: "سنسور آنالوگ مرجع شرط انتخاب نشده است." };
      }

      const segment = context.segments.find((s) => s.pin.trim() === pin);
      const resolution = clampAdcResolution(
        context.pinsPwmResolution?.[pin] ?? segment?.adcResolution,
      );
      const rawValue = Object.hasOwn(context.pinsAnalogValue, pin)
        ? context.pinsAnalogValue[pin]
        : (segment?.analogValue ?? 0);
      const unit: MacroValueUnit = condition.unit === "raw" ? "raw" : "percent";
      const currentVal = unit === "percent" ? adcValueToPercent(rawValue, resolution) : rawValue;
      const op: MacroNumericOperator =
        condition.operator &&
        VALID_NUMERIC_OPERATORS.has(condition.operator as MacroNumericOperator)
          ? (condition.operator as MacroNumericOperator)
          : "gt";
      const primary = Number.isFinite(condition.value) ? (condition.value as number) : 0;
      const passed = compareNumericValue(currentVal, op, primary, condition.maxValue);

      return {
        passed,
        fallbackReason: passed
          ? undefined
          : `مقدار سنسور «${segment?.title ?? `GPIO ${pin}`}» شرط تعیین‌شده را برآورده نمی‌کند.`,
      };
    }

    case "analog_output": {
      const pin = String(condition.sourcePin ?? "").trim();
      if (!pin) {
        return { passed: false, fallbackReason: "خروجی آنالوگ مرجع شرط انتخاب نشده است." };
      }

      const segment = context.segments.find((s) => s.pin.trim() === pin);
      const resolution = clampPwmResolution(
        context.pinsPwmResolution?.[pin] ?? segment?.pwmResolution,
      );
      const rawDuty = Object.hasOwn(context.pinsAnalogValue, pin)
        ? context.pinsAnalogValue[pin]
        : (segment?.analogValue ?? 0);
      const isOn = Object.hasOwn(context.pinsState, pin)
        ? Boolean(context.pinsState[pin]) || rawDuty > 0
        : rawDuty > 0 || Boolean(segment?.state);
      const op: MacroAnalogOutputOperator =
        condition.operator && VALID_ANALOG_OUTPUT_OPERATORS.has(condition.operator)
          ? condition.operator
          : "is_on";

      if (op === "is_on") {
        return {
          passed: isOn,
          fallbackReason: isOn
            ? undefined
            : `خروجی «${segment?.title ?? `GPIO ${pin}`}» روشن نیست.`,
        };
      }

      if (op === "is_off") {
        const isOff = !isOn && rawDuty === 0;

        return {
          passed: isOff,
          fallbackReason: isOff
            ? undefined
            : `خروجی «${segment?.title ?? `GPIO ${pin}`}» خاموش نیست.`,
        };
      }

      const unit: MacroValueUnit = condition.unit === "raw" ? "raw" : "percent";
      const currentVal = unit === "percent" ? analogDutyToPercent(rawDuty, resolution) : rawDuty;
      const primary = Number.isFinite(condition.value) ? (condition.value as number) : 0;
      const passed = compareNumericValue(currentVal, op, primary, condition.maxValue);

      return {
        passed,
        fallbackReason: passed
          ? undefined
          : `شدت خروجی «${segment?.title ?? `GPIO ${pin}`}» شرط تعیین‌شده را برآورده نمی‌کند.`,
      };
    }
  }
}

/**
 * Evaluates every action of a clicked custom button (macro) in the dashboard,
 * splitting passing actions into digital batch (`0x08`) and explicit analog PWM (`0x0A`)
 * commands while collecting user-defined failure messages for blocked actions.
 */
export function evaluateMacroExecution(
  macro: Macro,
  context: MacroEvaluationContext,
): MacroExecutionPlan {
  const resolvedByPin = new Map<
    string,
    | { kind: "digital"; targetPin: string; actionOn: boolean }
    | { kind: "analog"; targetPin: string; targetValue: number; actionOn: boolean }
  >();
  const blockedActions: MacroBlockedAction[] = [];
  let passedCount = 0;

  for (let i = 0; i < macro.actions.length; i++) {
    const action = macro.actions[i];
    const targetPin = String(action.targetPin ?? "").trim();
    if (!targetPin) continue;

    const evalResult = evaluateMacroCondition(action.condition, context);

    if (!evalResult.passed) {
      const customMessage = action.condition?.failureMessage?.trim();
      const targetSeg = context.segments.find((s) => s.pin.trim() === targetPin);
      const fallback =
        evalResult.fallbackReason ??
        `شرط اجرای عملیات روی «${targetSeg?.title ?? `GPIO ${targetPin}`}» برقرار نیست.`;

      blockedActions.push({
        action,
        index: i,
        message: customMessage || fallback,
      });
      continue;
    }

    passedCount += 1;

    const targetSeg = context.segments.find((s) => s.pin.trim() === targetPin);
    if (isAnalogOutputSegment(targetSeg) && hasExplicitAnalogTargetValue(action.targetValue)) {
      const resolution = clampPwmResolution(
        context.pinsPwmResolution?.[targetPin] ?? targetSeg?.pwmResolution,
      );
      const clampedDuty = clampAnalogValue(action.targetValue, resolution);
      resolvedByPin.set(targetPin, {
        kind: "analog",
        targetPin,
        targetValue: clampedDuty,
        actionOn: clampedDuty > 0,
      });
    } else if (hasExplicitAnalogTargetValue(action.targetValue)) {
      const clampedDuty = Math.min(
        MAX_ANALOG_OUTPUT_VALUE,
        Math.max(0, Math.round(action.targetValue)),
      );
      resolvedByPin.set(targetPin, {
        kind: "analog",
        targetPin,
        targetValue: clampedDuty,
        actionOn: clampedDuty > 0,
      });
    } else {
      resolvedByPin.set(targetPin, {
        kind: "digital",
        targetPin,
        actionOn: Boolean(action.actionOn),
      });
    }
  }

  const digitalActions: MacroDigitalDispatchAction[] = [];
  const analogActions: MacroAnalogDispatchAction[] = [];

  for (const item of resolvedByPin.values()) {
    if (item.kind === "analog") {
      analogActions.push({
        targetPin: item.targetPin,
        targetValue: item.targetValue,
        actionOn: item.actionOn,
      });
    } else {
      digitalActions.push({
        targetPin: item.targetPin,
        actionOn: item.actionOn,
      });
    }
  }

  return {
    digitalActions,
    analogActions,
    blockedActions,
    passedCount,
    blockedCount: blockedActions.length,
  };
}

/**
 * Normalizes a persisted `MacroActionCondition` from Cloudflare or user drafts.
 */
export function normalizeMacroActionCondition(
  raw?: Partial<MacroActionCondition> | null,
): MacroActionCondition | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const parameter: MacroConditionParameter =
    raw.parameter && VALID_PARAMETERS.has(raw.parameter) ? raw.parameter : "time_range";

  const normalized: MacroActionCondition = {
    enabled: raw.enabled !== false,
    parameter,
    failureMessage: typeof raw.failureMessage === "string" ? raw.failureMessage.trim() : "",
  };

  if (parameter === "time_range") {
    normalized.startTime =
      parseClockTimeMinutes(raw.startTime) !== null ? raw.startTime!.trim() : "18:00";
    normalized.endTime =
      parseClockTimeMinutes(raw.endTime) !== null ? raw.endTime!.trim() : "06:00";
    normalized.timeMode = raw.timeMode === "outside" ? "outside" : "inside";
    if (Array.isArray(raw.days) && raw.days.length > 0) {
      normalized.days = Array.from(
        new Set(raw.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
      );
    }

    return normalized;
  }

  normalized.sourcePin = String(raw.sourcePin ?? "").trim();

  if (parameter === "digital_input" || parameter === "digital_output") {
    normalized.expectedState = Boolean(raw.expectedState);

    return normalized;
  }

  if (parameter === "analog_input") {
    const op: MacroNumericOperator =
      raw.operator && VALID_NUMERIC_OPERATORS.has(raw.operator as MacroNumericOperator)
        ? (raw.operator as MacroNumericOperator)
        : "gt";
    const unit: MacroValueUnit = raw.unit === "raw" ? "raw" : "percent";
    const val = Number.isFinite(raw.value) ? Math.max(0, Math.round(raw.value as number)) : 0;

    normalized.operator = op;
    normalized.unit = unit;
    normalized.value =
      unit === "percent" ? Math.min(100, val) : Math.min(MAX_ANALOG_OUTPUT_VALUE, val);

    if (isRangeOperator(op)) {
      const clampedVal = normalized.value;
      const maxVal = Number.isFinite(raw.maxValue)
        ? Math.max(0, Math.round(raw.maxValue as number))
        : clampedVal;
      const clampedMax =
        unit === "percent" ? Math.min(100, maxVal) : Math.min(MAX_ANALOG_OUTPUT_VALUE, maxVal);
      normalized.value = Math.min(clampedVal, clampedMax);
      normalized.maxValue = Math.max(clampedVal, clampedMax);
    }

    return normalized;
  }

  // analog_output
  const op: MacroAnalogOutputOperator =
    raw.operator && VALID_ANALOG_OUTPUT_OPERATORS.has(raw.operator) ? raw.operator : "is_on";
  normalized.operator = op;

  if (op !== "is_on" && op !== "is_off") {
    const unit: MacroValueUnit = raw.unit === "raw" ? "raw" : "percent";
    const val = Number.isFinite(raw.value) ? Math.max(0, Math.round(raw.value as number)) : 0;
    normalized.unit = unit;
    normalized.value =
      unit === "percent" ? Math.min(100, val) : Math.min(MAX_ANALOG_OUTPUT_VALUE, val);

    if (isRangeOperator(op)) {
      const clampedVal = normalized.value;
      const maxVal = Number.isFinite(raw.maxValue)
        ? Math.max(0, Math.round(raw.maxValue as number))
        : clampedVal;
      const clampedMax =
        unit === "percent" ? Math.min(100, maxVal) : Math.min(MAX_ANALOG_OUTPUT_VALUE, maxVal);
      normalized.value = Math.min(clampedVal, clampedMax);
      normalized.maxValue = Math.max(clampedVal, clampedMax);
    }
  }

  return normalized;
}

/**
 * Normalizes a persisted `Macro` at the Cloudflare boundary while keeping legacy
 * `{ targetPin, actionOn }` actions untouched when no analog value or condition is present.
 */
export function normalizeMacroRecord(raw: Macro): Macro {
  const normalizedActions: MacroAction[] = Array.isArray(raw.actions)
    ? raw.actions.map((action) => {
        const hasAnalog = hasExplicitAnalogTargetValue(action.targetValue);
        const clampedTargetValue = hasExplicitAnalogTargetValue(action.targetValue)
          ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(action.targetValue)))
          : undefined;
        const normalizedCondition = action.condition
          ? normalizeMacroActionCondition(action.condition)
          : undefined;

        const nextAction: MacroAction = {
          targetPin: String(action.targetPin ?? "").trim(),
          actionOn: hasAnalog ? (clampedTargetValue as number) > 0 : Boolean(action.actionOn),
        };

        if (clampedTargetValue !== undefined) {
          nextAction.targetValue = clampedTargetValue;
        }

        if (normalizedCondition) {
          nextAction.condition = normalizedCondition;
        }

        return nextAction;
      })
    : [];

  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "").trim(),
    ...(raw.icon ? { icon: raw.icon } : {}),
    actions: normalizedActions,
  };
}

/**
 * Validates a macro draft before saving in `MacrosSection`.
 */
export function validateMacroDraft(
  title: string,
  actions: readonly MacroAction[],
  segments: readonly MacroSegmentSnapshot[],
): string | null {
  if (!title.trim()) {
    return "برای دکمه سفارشی یک نام وارد کنید.";
  }

  if (actions.length === 0) {
    return "حداقل یک عملیات اضافه کنید.";
  }

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const indexLabel = i + 1;
    const targetPin = String(action.targetPin ?? "").trim();
    const targetSegment = segments.find(
      (segment) => isControllableMacroOutput(segment) && segment.pin.trim() === targetPin,
    );

    if (!targetSegment) {
      return `عملیات ${indexLabel}: پایه خروجی انتخاب‌شده معتبر نیست.`;
    }

    if (isAnalogOutputSegment(targetSegment) && hasExplicitAnalogTargetValue(action.targetValue)) {
      const maxDuty = getAnalogMaxDuty(clampPwmResolution(targetSegment.pwmResolution));
      if (
        !Number.isInteger(action.targetValue) ||
        action.targetValue < 0 ||
        action.targetValue > maxDuty
      ) {
        return `عملیات ${indexLabel}: مقدار خروجی آنالوگ باید بین ۰ تا ${maxDuty} باشد.`;
      }
    }

    const cond = action.condition;
    if (!cond?.enabled) continue;

    if (cond.parameter === "time_range") {
      if (
        parseClockTimeMinutes(cond.startTime) === null ||
        parseClockTimeMinutes(cond.endTime) === null
      ) {
        return `عملیات ${indexLabel}: ساعت شروع و پایان شرط زمان را به‌درستی وارد کنید.`;
      }
      continue;
    }

    const sourcePin = String(cond.sourcePin ?? "").trim();
    if (!sourcePin) {
      return `عملیات ${indexLabel}: سگمنت مرجع شرط را انتخاب کنید.`;
    }

    const sourceSeg = segments.find((s) => s.pin.trim() === sourcePin && s.type !== "placeholder");
    if (!sourceSeg) {
      return `عملیات ${indexLabel}: سگمنت مرجع شرط (GPIO ${sourcePin}) در داشبورد وجود ندارد.`;
    }

    if (cond.parameter === "analog_input") {
      const maxLimit =
        cond.unit === "raw" ? getAdcMaxValue(clampAdcResolution(sourceSeg.adcResolution)) : 100;
      const val = cond.value ?? -1;
      if (!Number.isFinite(val) || val < 0 || val > maxLimit) {
        return `عملیات ${indexLabel}: مقدار شرط سنسور آنالوگ باید بین ۰ تا ${maxLimit} باشد.`;
      }
      if (isRangeOperator(cond.operator)) {
        const maxV = cond.maxValue ?? -1;
        if (!Number.isFinite(maxV) || maxV < 0 || maxV > maxLimit || val > maxV) {
          return `عملیات ${indexLabel}: بازه شرط سنسور آنالوگ معتبر نیست (حداقل نباید از حداکثر بیشتر باشد).`;
        }
      }
    } else if (
      cond.parameter === "analog_output" &&
      cond.operator !== "is_on" &&
      cond.operator !== "is_off"
    ) {
      const maxLimit =
        cond.unit === "raw" ? getAnalogMaxDuty(clampPwmResolution(sourceSeg.pwmResolution)) : 100;
      const val = cond.value ?? -1;
      if (!Number.isFinite(val) || val < 0 || val > maxLimit) {
        return `عملیات ${indexLabel}: مقدار شرط خروجی آنالوگ باید بین ۰ تا ${maxLimit} باشد.`;
      }
      if (isRangeOperator(cond.operator)) {
        const maxV = cond.maxValue ?? -1;
        if (!Number.isFinite(maxV) || maxV < 0 || maxV > maxLimit || val > maxV) {
          return `عملیات ${indexLabel}: بازه شرط خروجی آنالوگ معتبر نیست.`;
        }
      }
    }
  }

  return null;
}
