import type { AnalogRangeRule, GroupsSlice, Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  ANALOG_INPUT_TYPE,
  type AnalogInputSegmentOptions,
  getAdcMaxValue,
  getMaxAnalogHysteresis,
  isAnalogInputType,
  isReadOnlyInputSegment,
  MAX_ANALOG_RANGE_RULES,
  normalizeAnalogInputConfig,
  RULE_TRIGGER_DOUBLE_CLICK,
} from "@/features/iot/utils/analogInput";
import {
  ANALOG_OUTPUT_TYPE,
  type AnalogSegmentOptions,
  clampAnalogValue,
  clampPwmFrequency,
  clampPwmResolution,
  getAnalogMaxDuty,
  hasExplicitAnalogTargetValue,
  isAnalogOutputType,
  MAX_ANALOG_OUTPUT_VALUE,
} from "@/features/iot/utils/analogOutput";
import { validateEsp32Pin } from "@/features/iot/utils/pinValidation";

export interface AddSegmentInput {
  type: string;
  pin: string;
  title?: string;
  group?: string;
  mode?: "switch" | "push";
  auto_off?: number;
  icon?: string;
  groupIcon?: string;
  analogConfig?: AnalogSegmentOptions;
  analogInputConfig?: AnalogInputSegmentOptions;
}

export type AddSegmentDecision =
  | { ok: false; errorMessage: string }
  | {
      ok: true;
      newSegment: Segment;
      finalGroup: string;
      nextSegments: Segment[];
      replacedPlaceholder: boolean;
    };

export function createSegmentId(randomFn: () => number = Math.random): string {
  return randomFn().toString(36).substring(2, 9);
}

/**
 * Pure domain decision for adding or replacing a placeholder segment.
 * Enforces hardware GPIO validation, preserves placeholder group ownership,
 * and formats deterministic default titles.
 */
export function planAddSegment(params: {
  input: AddSegmentInput;
  segments: readonly Segment[];
  targetPlaceholderId: string | null;
  createId?: () => string;
}): AddSegmentDecision {
  const { input, segments, targetPlaceholderId, createId = createSegmentId } = params;

  if (input.pin && input.type !== "placeholder") {
    const validation = validateEsp32Pin(input.pin, input.type);

    if (!validation.isValid) {
      return { ok: false, errorMessage: validation.message };
    }
  }

  const finalGroup = resolveSegmentGroup(input.group);
  const isAnalogOutput = isAnalogOutputType(input.type);
  const isAnalogInput = isAnalogInputType(input.type);

  const analogResolution = isAnalogOutput
    ? clampPwmResolution(input.analogConfig?.pwmResolution)
    : undefined;
  const analogFrequency = isAnalogOutput
    ? clampPwmFrequency(input.analogConfig?.pwmFrequency)
    : undefined;
  const analogInitialValue = isAnalogOutput
    ? clampAnalogValue(input.analogConfig?.initialValue ?? 0, analogResolution)
    : undefined;
  const adcConfig = isAnalogInput ? normalizeAnalogInputConfig(input.analogInputConfig) : undefined;

  const newSegment: Segment = {
    id: createId(),
    type: isAnalogOutput ? ANALOG_OUTPUT_TYPE : isAnalogInput ? ANALOG_INPUT_TYPE : input.type,
    pin: input.pin,
    title:
      input.title ||
      (isAnalogOutput
        ? `خروجی آنالوگ PWM (GPIO ${input.pin})`
        : isAnalogInput
          ? `ورودی آنالوگ ADC (GPIO ${input.pin})`
          : `کنترل پایه دیجیتال (GPIO ${input.pin})`),
    group: finalGroup,
    mode: isAnalogOutput || isAnalogInput ? "switch" : input.mode || "switch",
    auto_off: isAnalogInput ? 0 : input.auto_off || 0,
    icon: input.icon,
    ...(isAnalogOutput && analogResolution !== undefined && analogFrequency !== undefined
      ? {
          pwmResolution: analogResolution,
          pwmFrequency: analogFrequency,
          analogValue: analogInitialValue ?? 0,
          lastNonZeroValue:
            analogInitialValue && analogInitialValue > 0
              ? analogInitialValue
              : getAnalogMaxDuty(analogResolution),
          state: Boolean(analogInitialValue && analogInitialValue > 0),
        }
      : {}),
    ...(isAnalogInput && adcConfig
      ? {
          adcResolution: adcConfig.adcResolution,
          adcSampleIntervalMs: adcConfig.adcSampleIntervalMs,
          adcDeltaThreshold: adcConfig.adcDeltaThreshold,
          adcHighThreshold: adcConfig.adcHighThreshold,
          adcLowThreshold: adcConfig.adcLowThreshold,
          analogValue: 0,
          state: false,
        }
      : {}),
  };

  const nextSegments = [...segments];
  let replacedPlaceholder = false;

  if (targetPlaceholderId) {
    const index = nextSegments.findIndex((s) => s.id === targetPlaceholderId);

    if (index !== -1) {
      newSegment.group = resolveSegmentGroup(nextSegments[index].group);
      nextSegments[index] = newSegment;
      replacedPlaceholder = true;
    } else {
      nextSegments.push(newSegment);
    }
  } else {
    nextSegments.push(newSegment);
  }

  return {
    ok: true,
    newSegment,
    finalGroup,
    nextSegments,
    replacedPlaceholder,
  };
}

export function planGroupConfigRegistration(
  prev: GroupsSlice["groupConfigs"],
  finalGroup: string,
  groupIcon?: string,
): GroupsSlice["groupConfigs"] {
  const current = prev[finalGroup] || { maxCols: 3 };

  if (groupIcon && !("icon" in current && current.icon)) {
    return { ...prev, [finalGroup]: { ...current, icon: groupIcon } };
  }

  if (!prev[finalGroup]) {
    return { ...prev, [finalGroup]: current };
  }

  return prev;
}

export function planGroupOrderRegistration(prev: readonly string[], finalGroup: string): string[] {
  return prev.includes(finalGroup) ? [...prev] : [...prev, finalGroup];
}

export interface RemoveGroupPlan {
  nextGroupsOrder: string[];
  nextSegments: Segment[];
}

export function planRemoveGroup(params: {
  groupsOrder: readonly string[];
  segments: readonly Segment[];
  groupId: string;
}): RemoveGroupPlan {
  return {
    nextGroupsOrder: params.groupsOrder.filter((g) => g !== params.groupId),
    nextSegments: params.segments.filter((s) => resolveSegmentGroup(s.group) !== params.groupId),
  };
}

export function validateRuleActionList(
  actions?: Array<{
    targetPin: string;
    reqHold?: number;
    actionType?: number;
    delay?: number;
    targetValue?: number | null;
  }>,
  segments?: readonly Segment[],
): string | null {
  if (!actions) return null;
  if (actions.length > 4) return "هر حالت حداکثر می‌تواند ۴ عملیات داشته باشد.";

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const targetPin = action.targetPin.trim();

    if (!targetPin) return "برای هر عملیات باید پایه خروجی مقصد انتخاب شود.";

    const matchedSeg = segments?.find(
      (s) => s.type !== "placeholder" && s.pin.trim() === targetPin,
    );
    if (isReadOnlyInputSegment(matchedSeg)) {
      return `پایه GPIO ${targetPin} به‌عنوان ورودی تعریف شده و نمی‌تواند هدف خروجی باشد.`;
    }

    const validation = validateEsp32Pin(
      targetPin,
      isAnalogOutputType(matchedSeg?.type) ? "analog_output" : "output",
    );
    if (!validation.isValid) return validation.message;

    if (
      action.reqHold !== undefined &&
      action.reqHold !== RULE_TRIGGER_DOUBLE_CLICK &&
      action.reqHold !== 0 &&
      action.reqHold !== 3 &&
      action.reqHold !== 5 &&
      action.reqHold !== 10
    ) {
      return "شرط فعال‌سازی باید دابل کلیک یا نگه‌داشتن ۰، ۳، ۵ یا ۱۰ ثانیه باشد.";
    }

    if (
      action.actionType !== undefined &&
      action.actionType !== 0 &&
      action.actionType !== 1 &&
      action.actionType !== 2
    ) {
      return "نوع عملیات انتخاب‌شده معتبر نیست.";
    }

    if (
      action.delay !== undefined &&
      (!Number.isInteger(action.delay) || action.delay < 0 || action.delay > 60)
    ) {
      return "تأخیر عملیات باید بین ۰ تا ۶۰ ثانیه باشد.";
    }

    if (
      hasExplicitAnalogTargetValue(action.targetValue) &&
      (!Number.isInteger(action.targetValue) ||
        action.targetValue < 0 ||
        action.targetValue > MAX_ANALOG_OUTPUT_VALUE)
    ) {
      return "مقدار دقیق PWM باید عددی صحیح بین ۰ تا ۴۰۹۵ باشد.";
    }
  }

  return null;
}

/**
 * Validates V2 multi-range rules (`analogRanges`) for an `analog_input` segment
 * against ADC resolution limits, hysteresis upper bound, target output type, and timing bounds.
 */
export function validateAnalogRangeRuleList(
  ranges: readonly AnalogRangeRule[] | undefined,
  inputPin: string,
  adcResolution?: number | null,
  segments?: readonly Segment[],
): string | null {
  if (!ranges || ranges.length === 0) return null;
  if (ranges.length > MAX_ANALOG_RANGE_RULES) {
    return `حداکثر ${MAX_ANALOG_RANGE_RULES} بازه شرط برای هر ورودی آنالوگ مجاز است.`;
  }

  const maxAdcValue = getAdcMaxValue(adcResolution);
  const maxHysteresis = getMaxAnalogHysteresis(adcResolution);
  const normalizedInputPin = inputPin.trim();

  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    const indexLabel = i + 1;

    if (
      !Number.isInteger(r.minValue) ||
      !Number.isInteger(r.maxValue) ||
      r.minValue < 0 ||
      r.maxValue > maxAdcValue ||
      r.minValue > r.maxValue
    ) {
      return `بازه ${indexLabel}: حداقل و حداکثر باید بین ۰ تا ${maxAdcValue} باشد و حداقل از حداکثر بیشتر نباشد.`;
    }

    if (!Number.isInteger(r.hysteresis) || r.hysteresis < 0 || r.hysteresis > maxHysteresis) {
      return `بازه ${indexLabel}: مقدار هیسترزیس باید بین ۰ تا ${maxHysteresis} باشد.`;
    }

    if (r.triggerMode !== 0 && r.triggerMode !== 1) {
      return `بازه ${indexLabel}: زمان اجرا (ورود یا خروج از بازه) معتبر نیست.`;
    }

    const targetPin = String(r.targetPin ?? "").trim();
    if (!targetPin) {
      return `بازه ${indexLabel}: باید یک خروجی هدف انتخاب شود.`;
    }

    if (targetPin === normalizedInputPin) {
      return `بازه ${indexLabel}: خروجی هدف نمی‌تواند همان پایه ورودی (GPIO ${normalizedInputPin}) باشد.`;
    }

    const matchedSeg = segments?.find(
      (s) => s.type !== "placeholder" && s.pin.trim() === targetPin,
    );

    if (isReadOnlyInputSegment(matchedSeg)) {
      return `بازه ${indexLabel}: پایه GPIO ${targetPin} ورودی است و نمی‌تواند خروجی هدف باشد.`;
    }

    if (segments && !matchedSeg) {
      return `بازه ${indexLabel}: خروجی هدف با GPIO ${targetPin} در لیست قطعات پیدا نشد.`;
    }

    const pinValidation = validateEsp32Pin(
      targetPin,
      isAnalogOutputType(matchedSeg?.type) ? "analog_output" : "output",
    );
    if (!pinValidation.isValid) {
      return `بازه ${indexLabel}: ${pinValidation.message}`;
    }

    if (r.actionType !== 0 && r.actionType !== 1 && r.actionType !== 2) {
      return `بازه ${indexLabel}: نوع عملیات معتبر نیست.`;
    }

    if (
      !Number.isInteger(r.delay) ||
      r.delay < 0 ||
      r.delay > 60 ||
      (r.actionType > 0 && r.delay < 1)
    ) {
      return r.actionType > 0
        ? `بازه ${indexLabel}: زمان عملیات برای حالت تأخیر/مدت‌دار باید بین ۱ تا ۶۰ ثانیه باشد.`
        : `بازه ${indexLabel}: تأخیر باید بین ۰ تا ۶۰ ثانیه باشد.`;
    }

    if (hasExplicitAnalogTargetValue(r.targetValue)) {
      const targetMax = matchedSeg?.pwmResolution
        ? getAnalogMaxDuty(matchedSeg.pwmResolution)
        : MAX_ANALOG_OUTPUT_VALUE;

      if (!Number.isInteger(r.targetValue) || r.targetValue < 0 || r.targetValue > targetMax) {
        return `بازه ${indexLabel}: مقدار دقیق PWM باید بین ۰ تا ${targetMax} باشد.`;
      }
    }
  }

  return null;
}
