import type {
  ConditionLogic,
  MacroAction,
  MacroActionCondition,
  MacroAnalogMode,
  MacroAnalogStepUnit,
  MacroHttpHeader,
  MacroHttpMethod,
  MacroHttpRequestConfig,
} from "@/features/iot/services/config/types";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";

export const VALID_MACRO_HTTP_METHODS: ReadonlyArray<MacroHttpMethod> = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

export const DEFAULT_MACRO_HTTP_TIMEOUT_MS = 5000;

export function isValidHttpUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeMacroHttpRequest(
  raw?: MacroHttpRequestConfig | null,
): MacroHttpRequestConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const upperMethod = String(raw.method ?? "GET")
    .trim()
    .toUpperCase() as MacroHttpMethod;
  const method: MacroHttpMethod = VALID_MACRO_HTTP_METHODS.includes(upperMethod)
    ? upperMethod
    : "GET";
  const url = String(raw.url ?? "").trim();
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const contentType = typeof raw.contentType === "string" ? raw.contentType.trim() : "";
  const rawTimeout =
    typeof raw.timeoutMs === "number" ? raw.timeoutMs : DEFAULT_MACRO_HTTP_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(rawTimeout)
    ? Math.min(30000, Math.max(500, Math.round(rawTimeout)))
    : DEFAULT_MACRO_HTTP_TIMEOUT_MS;

  const headers: MacroHttpHeader[] = Array.isArray(raw.headers)
    ? raw.headers
        .map((h) => ({
          key: String(h?.key ?? "").trim(),
          value: String(h?.value ?? ""),
        }))
        .filter((h) => h.key.length > 0)
    : [];

  const body = typeof raw.body === "string" ? raw.body : undefined;

  return {
    ...(label ? { label } : {}),
    method,
    url,
    ...(contentType ? { contentType } : {}),
    ...(headers.length > 0 ? { headers } : {}),
    ...(body && body.trim().length > 0 ? { body } : {}),
    timeoutMs,
  };
}

export function resolveMacroAnalogStepTarget(
  currentDuty: number,
  stepDelta: number,
  stepUnit: MacroAnalogStepUnit,
  resolution: number,
): number {
  const safeCurrent = clampAnalogValue(currentDuty, resolution);
  if (stepUnit === "percent") {
    const currentPercent = analogDutyToPercent(safeCurrent, resolution);
    const nextPercent = Math.min(100, Math.max(0, currentPercent + stepDelta));
    return percentToAnalogDuty(nextPercent, resolution);
  }

  return clampAnalogValue(safeCurrent + stepDelta, resolution);
}

/** Resolves an analog_output macro action (`"set"`, `"step"`, or `"power"`) into concrete dispatch data. */
export function resolveAnalogSegmentMacroDispatch(
  action: MacroAction,
  targetPin: string,
  targetSeg: { analogValue?: number; pwmResolution?: number },
  context: {
    pinsState: Readonly<Record<string, boolean>>;
    pinsAnalogValue: Readonly<Record<string, number>>;
    pinsPwmResolution?: Readonly<Record<string, number>>;
  },
  runningAnalogByPin: Map<string, number>,
  runningBoolByPin: Map<string, boolean>,
):
  | { kind: "analog"; targetPin: string; targetValue: number; actionOn: boolean }
  | { kind: "digital"; targetPin: string; actionOn: boolean } {
  const resolution = clampPwmResolution(
    context.pinsPwmResolution?.[targetPin] ?? targetSeg.pwmResolution,
  );
  const analogMode: MacroAnalogMode =
    action.analogMode ?? (hasExplicitAnalogTargetValue(action.targetValue) ? "set" : "power");

  if (
    analogMode === "step" &&
    typeof action.stepDelta === "number" &&
    Number.isFinite(action.stepDelta) &&
    Math.round(action.stepDelta) !== 0
  ) {
    const baseDuty = runningAnalogByPin.has(targetPin)
      ? runningAnalogByPin.get(targetPin)!
      : context.pinsState[targetPin] === false
        ? 0
        : clampAnalogValue(
            context.pinsAnalogValue[targetPin] ?? targetSeg.analogValue ?? 0,
            resolution,
          );
    const stepUnit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
    const nextDuty = resolveMacroAnalogStepTarget(
      baseDuty,
      Math.round(action.stepDelta),
      stepUnit,
      resolution,
    );

    runningAnalogByPin.set(targetPin, nextDuty);
    runningBoolByPin.set(targetPin, nextDuty > 0);
    return {
      kind: "analog",
      targetPin,
      targetValue: nextDuty,
      actionOn: nextDuty > 0,
    };
  }

  if (analogMode === "power" || !hasExplicitAnalogTargetValue(action.targetValue)) {
    const currentOn = runningBoolByPin.has(targetPin)
      ? runningBoolByPin.get(targetPin)!
      : Boolean(context.pinsState[targetPin]);
    const nextOn = action.powerToggle ? !currentOn : Boolean(action.actionOn);

    runningBoolByPin.set(targetPin, nextOn);
    if (!nextOn) {
      runningAnalogByPin.set(targetPin, 0);
    } else {
      runningAnalogByPin.delete(targetPin);
    }

    return {
      kind: "digital",
      targetPin,
      actionOn: nextOn,
    };
  }

  const clampedDuty = clampAnalogValue(action.targetValue, resolution);
  runningAnalogByPin.set(targetPin, clampedDuty);
  runningBoolByPin.set(targetPin, clampedDuty > 0);
  return {
    kind: "analog",
    targetPin,
    targetValue: clampedDuty,
    actionOn: clampedDuty > 0,
  };
}

function attachNormalizedConditions(
  target: MacroAction,
  rawAction: MacroAction,
  normalizeCondition: (raw?: MacroActionCondition | null) => MacroActionCondition | undefined,
): MacroAction {
  const hasConditionsArray = Array.isArray(rawAction.conditions);
  const normalizedConditions = hasConditionsArray
    ? rawAction.conditions!
        .map((c) => normalizeCondition(c))
        .filter((c): c is MacroActionCondition => Boolean(c))
    : undefined;
  const normalizedLegacyCondition =
    !hasConditionsArray && rawAction.condition
      ? normalizeCondition(rawAction.condition)
      : undefined;

  if (normalizedConditions && normalizedConditions.length > 0) {
    target.conditions = normalizedConditions;
    if (rawAction.conditionLogic === "or" && normalizedConditions.length > 1) {
      target.conditionLogic = "or";
    }
  } else if (normalizedLegacyCondition) {
    target.condition = normalizedLegacyCondition;
  }

  return target;
}

/**
 * Normalizes extended macro action variants (`http`, analog `"step"`, analog `"power"`).
 * Returns `null` for legacy segment/set actions so callers preserve historical schema untouched.
 */
export function normalizeExtendedMacroAction(
  action: MacroAction,
  normalizeCondition: (raw?: MacroActionCondition | null) => MacroActionCondition | undefined,
): MacroAction | null {
  if (action.actionKind === "http") {
    const httpRequest = normalizeMacroHttpRequest(action.httpRequest);
    const nextAction: MacroAction = {
      actionKind: "http",
      targetPin: "",
      actionOn: true,
      ...(httpRequest ? { httpRequest } : {}),
    };
    return attachNormalizedConditions(nextAction, action, normalizeCondition);
  }

  if (action.analogMode === "step") {
    const stepDelta =
      typeof action.stepDelta === "number" && Number.isFinite(action.stepDelta)
        ? Math.round(action.stepDelta)
        : 0;
    const stepUnit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
    const nextAction: MacroAction = {
      targetPin: String(action.targetPin ?? "").trim(),
      actionOn: stepDelta > 0,
      analogMode: "step",
      stepDelta,
      stepUnit,
    };
    return attachNormalizedConditions(nextAction, action, normalizeCondition);
  }

  if (action.analogMode === "power") {
    const nextAction: MacroAction = {
      targetPin: String(action.targetPin ?? "").trim(),
      actionOn: Boolean(action.actionOn),
      analogMode: "power",
      ...(action.powerToggle ? { powerToggle: true } : {}),
    };
    return attachNormalizedConditions(nextAction, action, normalizeCondition);
  }

  return null;
}

export function validateHttpMacroAction<TSeg>(
  action: MacroAction,
  indexLabel: number,
  segments: readonly TSeg[],
  getConditions: (act: MacroAction) => MacroActionCondition[],
  validateConditionFn: (
    cond: MacroActionCondition,
    labelPrefix: string,
    segments: readonly TSeg[],
  ) => string | null,
): string | null {
  const req = action.httpRequest;
  if (!req || !String(req.url ?? "").trim()) {
    return `عملیات ${indexLabel}: آدرس URL درخواست HTTP/HTTPS را وارد کنید.`;
  }

  if (!isValidHttpUrl(req.url)) {
    return `عملیات ${indexLabel}: آدرس URL باید معتبر و با http:// یا https:// شروع شود.`;
  }

  const method = String(req.method ?? "")
    .trim()
    .toUpperCase() as MacroHttpMethod;
  if (!VALID_MACRO_HTTP_METHODS.includes(method)) {
    return `عملیات ${indexLabel}: متد HTTP انتخاب‌شده معتبر نیست.`;
  }

  if (Array.isArray(req.headers)) {
    for (const h of req.headers) {
      if (h.value && !String(h.key ?? "").trim()) {
        return `عملیات ${indexLabel}: کلید هدر HTTP نمی‌تواند خالی باشد.`;
      }
    }
  }

  if (
    method !== "GET" &&
    req.contentType === "application/json" &&
    typeof req.body === "string" &&
    req.body.trim().length > 0
  ) {
    try {
      JSON.parse(req.body);
    } catch {
      return `عملیات ${indexLabel}: ساختار JSON بدنه درخواست معتبر نیست.`;
    }
  }

  if (
    req.timeoutMs !== undefined &&
    (!Number.isFinite(req.timeoutMs) || req.timeoutMs < 500 || req.timeoutMs > 30000)
  ) {
    return `عملیات ${indexLabel}: مهلت زمانی (Timeout) باید بین ۵۰۰ تا ۳۰۰۰۰ میلی‌ثانیه باشد.`;
  }

  const actionConditions = getConditions(action);
  for (let cIdx = 0; cIdx < actionConditions.length; cIdx++) {
    const condError = validateConditionFn(
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

export function validateAnalogStepOrPowerAction(
  action: MacroAction,
  indexLabel: number,
  targetSegment: { pwmResolution?: number },
): string | null {
  if (action.analogMode === "power") return null;

  const delta = action.stepDelta;
  if (typeof delta !== "number" || !Number.isFinite(delta) || Math.round(delta) === 0) {
    return `عملیات ${indexLabel}: مقدار گام (Step) نمی‌تواند صفر باشد.`;
  }

  const absDelta = Math.abs(Math.round(delta));
  const unit: MacroAnalogStepUnit = action.stepUnit === "raw" ? "raw" : "percent";
  const maxStep =
    unit === "percent" ? 100 : getAnalogMaxDuty(clampPwmResolution(targetSegment.pwmResolution));

  if (absDelta < 1 || absDelta > maxStep) {
    return `عملیات ${indexLabel}: مقدار گام آنالوگ باید بین ۱ تا ${maxStep} باشد.`;
  }

  return null;
}

export function normalizeMacroActionDisplayConditionLogic(
  logic?: ConditionLogic,
): ConditionLogic | undefined {
  return logic === "or" ? "or" : undefined;
}

