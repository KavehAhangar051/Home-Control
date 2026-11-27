import type {
  MacroAction,
  MacroActionCondition,
  MacroAnalogStepUnit,
  MacroHttpHeader,
  MacroHttpMethod,
  MacroHttpRequestConfig,
  RuleGuardCondition,
} from "@/features/iot/services/config/types";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import type {
  MacroEvaluationContext,
  MacroSegmentSnapshot,
} from "@/features/iot/utils/macroEngine";

export const DEFAULT_MACRO_HTTP_TIMEOUT_MS = 5000;
export const MIN_MACRO_HTTP_TIMEOUT_MS = 500;
export const MAX_MACRO_HTTP_TIMEOUT_MS = 30000;

export const VALID_MACRO_HTTP_METHODS: readonly MacroHttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

const VALID_HTTP_METHOD_SET = new Set<string>(VALID_MACRO_HTTP_METHODS);

/** Returns true only when `raw` parses as an `http:` or `https:` URL with a non-empty host. */
export function isValidHttpUrl(raw?: string | null): boolean {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.trim().length > 0
    );
  } catch {
    return false;
  }
}

/** Normalizes a persisted or drafted HTTP/HTTPS macro action payload. */
export function normalizeMacroHttpRequest(
  raw?: Partial<MacroHttpRequestConfig> | null,
): MacroHttpRequestConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const upperMethod = String(raw.method ?? "GET")
    .trim()
    .toUpperCase();
  const method: MacroHttpMethod = VALID_HTTP_METHOD_SET.has(upperMethod)
    ? (upperMethod as MacroHttpMethod)
    : "GET";

  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : undefined;
  const contentType =
    typeof raw.contentType === "string" && raw.contentType.trim()
      ? raw.contentType.trim()
      : undefined;

  const headers: MacroHttpHeader[] | undefined = Array.isArray(raw.headers)
    ? raw.headers
        .filter((h): h is MacroHttpHeader => Boolean(h && typeof h === "object"))
        .map((h) => ({
          ...(typeof h.id === "string" && h.id ? { id: h.id } : {}),
          key: String(h.key ?? "").trim(),
          value: String(h.value ?? ""),
        }))
        .filter((h) => h.key.length > 0)
    : undefined;

  const timeoutMs =
    typeof raw.timeoutMs === "number" && Number.isFinite(raw.timeoutMs)
      ? Math.min(
          MAX_MACRO_HTTP_TIMEOUT_MS,
          Math.max(MIN_MACRO_HTTP_TIMEOUT_MS, Math.round(raw.timeoutMs)),
        )
      : DEFAULT_MACRO_HTTP_TIMEOUT_MS;

  const body = typeof raw.body === "string" ? raw.body : undefined;

  return {
    ...(label ? { label } : {}),
    method,
    url,
    ...(contentType ? { contentType } : {}),
    ...(headers && headers.length > 0 ? { headers } : {}),
    ...(body !== undefined ? { body } : {}),
    timeoutMs,
  };
}

/**
 * Computes the target PWM duty cycle after applying a signed step delta.
 * Percentage deltas step cleanly in whole percent space before converting back to duty
 * so e.g. 50% (128/255) + 10% yields 60% = 153 rather than drifting by rounding.
 */
export function resolveMacroAnalogStepTarget(
  currentDuty: number,
  stepDelta: number,
  stepUnit: MacroAnalogStepUnit | undefined,
  resolution: number,
): number {
  const safeRes = clampPwmResolution(resolution);
  const safeDelta = Number.isFinite(stepDelta) ? stepDelta : 0;

  if (stepUnit === "raw") {
    return clampAnalogValue(currentDuty + safeDelta, safeRes);
  }

  const currentPercent = analogDutyToPercent(currentDuty, safeRes);
  const nextPercent = Math.min(100, Math.max(0, currentPercent + safeDelta));
  return percentToAnalogDuty(nextPercent, safeRes);
}

/** Resolves an `analog_output` macro action into a concrete digital toggle or PWM duty command. */
export function resolveAnalogSegmentMacroDispatch(
  action: MacroAction,
  targetPin: string,
  targetSeg: MacroSegmentSnapshot,
  context: MacroEvaluationContext,
  runningAnalogByPin: Map<string, number>,
  runningBoolByPin: Map<string, boolean>,
):
  | { kind: "digital"; targetPin: string; actionOn: boolean }
  | { kind: "analog"; targetPin: string; targetValue: number; actionOn: boolean } {
  const resolution = clampPwmResolution(
    context.pinsPwmResolution?.[targetPin] ?? targetSeg.pwmResolution,
  );

  const currentBool = runningBoolByPin.has(targetPin)
    ? (runningBoolByPin.get(targetPin) as boolean)
    : Object.hasOwn(context.pinsState, targetPin)
      ? Boolean(context.pinsState[targetPin])
      : Boolean(targetSeg.state);

  const currentDuty = runningAnalogByPin.has(targetPin)
    ? (runningAnalogByPin.get(targetPin) as number)
    : clampAnalogValue(
        Object.hasOwn(context.pinsAnalogValue, targetPin)
          ? context.pinsAnalogValue[targetPin]
          : (targetSeg.analogValue ?? 0),
        resolution,
      );

  if (action.analogMode === "power") {
    const nextOn = action.powerToggle ? !currentBool : Boolean(action.actionOn);
    runningBoolByPin.set(targetPin, nextOn);
    return { kind: "digital", targetPin, actionOn: nextOn };
  }

  if (action.analogMode === "step") {
    const delta = Number.isFinite(action.stepDelta) ? (action.stepDelta as number) : 0;
    const unit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
    const nextDuty = resolveMacroAnalogStepTarget(currentDuty, delta, unit, resolution);
    const nextOn = nextDuty > 0;
    runningAnalogByPin.set(targetPin, nextDuty);
    runningBoolByPin.set(targetPin, nextOn);
    return { kind: "analog", targetPin, targetValue: nextDuty, actionOn: nextOn };
  }

  if (hasExplicitAnalogTargetValue(action.targetValue)) {
    const clampedDuty = clampAnalogValue(action.targetValue, resolution);
    const nextOn = clampedDuty > 0;
    runningAnalogByPin.set(targetPin, clampedDuty);
    runningBoolByPin.set(targetPin, nextOn);
    return { kind: "analog", targetPin, targetValue: clampedDuty, actionOn: nextOn };
  }

  const nextOn = Boolean(action.actionOn);
  runningBoolByPin.set(targetPin, nextOn);
  return { kind: "digital", targetPin, actionOn: nextOn };
}

function attachNormalizedConditions(
  target: MacroAction,
  source: MacroAction,
  normalizeCondition: (
    raw?: Partial<MacroActionCondition> | null,
  ) => MacroActionCondition | undefined,
): MacroAction {
  const hasConditionsArray = Array.isArray(source.conditions);
  const normalizedConditions = hasConditionsArray
    ? source
        .conditions!.map((cond) => normalizeCondition(cond))
        .filter((cond): cond is MacroActionCondition => Boolean(cond))
    : undefined;
  const normalizedLegacy =
    !hasConditionsArray && source.condition ? normalizeCondition(source.condition) : undefined;

  if (normalizedConditions && normalizedConditions.length > 0) {
    target.conditions = normalizedConditions;
    if (source.conditionLogic === "or" && normalizedConditions.length > 1) {
      target.conditionLogic = "or";
    }
  } else if (normalizedLegacy) {
    target.condition = normalizedLegacy;
  }

  return target;
}

/** Normalizes extended macro actions (`http`, `analogMode: "step" | "power"`); returns null for standard actions. */
export function normalizeExtendedMacroAction(
  action: MacroAction,
  normalizeCondition: (
    raw?: Partial<MacroActionCondition> | null,
  ) => MacroActionCondition | undefined,
): MacroAction | null {
  if (action.actionKind === "http") {
    const normalizedReq = normalizeMacroHttpRequest(action.httpRequest) ?? {
      method: "GET",
      url: "",
      timeoutMs: DEFAULT_MACRO_HTTP_TIMEOUT_MS,
    };
    return attachNormalizedConditions(
      {
        actionKind: "http",
        targetPin: "",
        actionOn: true,
        httpRequest: normalizedReq,
      },
      action,
      normalizeCondition,
    );
  }

  if (action.analogMode === "step") {
    const stepUnit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
    const stepDelta = Number.isFinite(action.stepDelta)
      ? Math.round(action.stepDelta as number)
      : 0;
    return attachNormalizedConditions(
      {
        targetPin: String(action.targetPin ?? "").trim(),
        actionOn: true,
        analogMode: "step",
        stepDelta,
        stepUnit,
      },
      action,
      normalizeCondition,
    );
  }

  if (action.analogMode === "power") {
    return attachNormalizedConditions(
      {
        targetPin: String(action.targetPin ?? "").trim(),
        actionOn: action.powerToggle ? true : Boolean(action.actionOn),
        analogMode: "power",
        ...(action.powerToggle ? { powerToggle: true } : {}),
      },
      action,
      normalizeCondition,
    );
  }

  return null;
}

/** Validates analog PWM `"step"` and `"power"` macro actions against hardware bounds. */
export function validateAnalogStepOrPowerAction(
  action: MacroAction,
  indexLabel: number,
  targetSegment: MacroSegmentSnapshot,
): string | null {
  if (action.analogMode === "power") {
    return null;
  }

  if (action.analogMode === "step") {
    const delta = action.stepDelta;
    if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) {
      return `عملیات ${indexLabel}: مقدار تغییر پله‌ای نباید صفر یا نامعتبر باشد.`;
    }

    const unit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
    const maxDuty = getAnalogMaxDuty(clampPwmResolution(targetSegment.pwmResolution));
    const bound = unit === "percent" ? 100 : maxDuty;

    if (Math.abs(delta) > bound) {
      return `عملیات ${indexLabel}: مقدار تغییر پله‌ای باید بین -${bound} تا +${bound} باشد.`;
    }
  }

  return null;
}

/** Validates HTTP/HTTPS macro action fields, JSON payload syntax, and attached conditions. */
export function validateHttpMacroAction(
  action: MacroAction,
  indexLabel: number,
  segments: readonly MacroSegmentSnapshot[],
  getConditions: (
    action?: Pick<MacroAction, "condition" | "conditions"> | null,
  ) => MacroActionCondition[],
  validateCondition: (
    cond: MacroActionCondition | RuleGuardCondition,
    labelPrefix: string,
    segments: readonly MacroSegmentSnapshot[],
  ) => string | null,
): string | null {
  const req = action.httpRequest;
  if (!req || !isValidHttpUrl(req.url)) {
    return `عملیات ${indexLabel}: نشانی HTTP/HTTPS معتبر وارد کنید.`;
  }

  const upperMethod = String(req.method ?? "GET")
    .trim()
    .toUpperCase() as MacroHttpMethod;
  if (!VALID_HTTP_METHOD_SET.has(upperMethod)) {
    return `عملیات ${indexLabel}: متد HTTP انتخاب‌شده معتبر نیست.`;
  }

  if (
    req.timeoutMs !== undefined &&
    (!Number.isFinite(req.timeoutMs) ||
      req.timeoutMs < MIN_MACRO_HTTP_TIMEOUT_MS ||
      req.timeoutMs > MAX_MACRO_HTTP_TIMEOUT_MS)
  ) {
    return `عملیات ${indexLabel}: زمان انتظار باید بین ${MIN_MACRO_HTTP_TIMEOUT_MS} تا ${MAX_MACRO_HTTP_TIMEOUT_MS} میلی‌ثانیه باشد.`;
  }

  if (
    upperMethod !== "GET" &&
    req.contentType?.toLowerCase().includes("json") &&
    req.body?.trim()
  ) {
    try {
      JSON.parse(req.body);
    } catch {
      return `عملیات ${indexLabel}: ساختار JSON بدنه درخواست معتبر نیست.`;
    }
  }

  const actionConditions = getConditions(action);
  for (let cIdx = 0; cIdx < actionConditions.length; cIdx++) {
    const condError = validateCondition(
      actionConditions[cIdx],
      actionConditions.length > 1
        ? `عملیات ${indexLabel} (شرط ${cIdx + 1})`
        : `عملیات ${indexLabel}`,
      segments,
    );
    if (condError) return condError;
  }

  return null;
}
