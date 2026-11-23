import type {
  AnalogRangeRule,
  AuxNodeConfig,
  GroupsSlice,
  Segment,
} from "@/features/iot/hooks/store/types";
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
import {
  allocateNextVirtualPin,
  getAuxNodeActiveSegmentCount,
  isLocalGpioPin,
  isValidRemotePin,
  isVirtualPin,
  MAX_AUX_NODES,
  MAX_TOTAL_SEGMENTS,
} from "@/features/iot/utils/auxNodeUtils";
import { validateEsp32Pin, validateManagedPin } from "@/features/iot/utils/pinValidation";

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
  isVirtual?: boolean;
  nodeId?: number;
  remotePin?: number;
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
 * Generates deterministic pin-based IDs:
 * - `gpio_<0..39>` for local ESP32 GPIO segments
 * - `vpin_<40..127>` for virtual auxiliary-node segments
 * Falls back to random IDs otherwise.
 */
export function createHardwareSegmentId(
  pin: string | number | undefined,
  randomFn: () => number = Math.random,
): string {
  const parsed = pin !== undefined && String(pin).trim() !== "" ? Number(pin) : Number.NaN;

  if (isLocalGpioPin(parsed)) {
    return `gpio_${parsed}`;
  }

  if (isVirtualPin(parsed)) {
    return `vpin_${parsed}`;
  }

  return createSegmentId(randomFn);
}

/**
 * Pure domain decision for adding or replacing a placeholder segment (local ESP32 or virtual Auxiliary ESP).
 * Enforces hardware GPIO validation, 48-segment firmware cap, auxiliary node capacity & remotePin uniqueness,
 * preserves placeholder group ownership, and formats deterministic default titles.
 */
export function planAddSegment(params: {
  input: AddSegmentInput;
  segments: readonly Segment[];
  targetPlaceholderId: string | null;
  auxNodes?: readonly AuxNodeConfig[];
  createId?: () => string;
}): AddSegmentDecision {
  const { input, segments, targetPlaceholderId, auxNodes, createId } = params;

  const targetPlaceholder = targetPlaceholderId
    ? segments.find((s) => s.id === targetPlaceholderId)
    : undefined;

  const isVirtual = Boolean(input.isVirtual || targetPlaceholder?.isVirtual);
  const resolvedNodeId = input.nodeId ?? targetPlaceholder?.nodeId;

  if (input.type !== "placeholder") {
    const activeCount = segments.filter((s) => s.type !== "placeholder").length;
    if (activeCount >= MAX_TOTAL_SEGMENTS) {
      return {
        ok: false,
        errorMessage: `حداکثر ${MAX_TOTAL_SEGMENTS} سگمنت فعال (محلی + مجازی) در برد مرکزی پشتیبانی می‌شود.`,
      };
    }
  }

  let finalPin = input.pin.trim();
  let resolvedRemotePin: number | undefined;
  let ownerNode: AuxNodeConfig | undefined;

  if (isVirtual && input.type !== "placeholder") {
    if (
      resolvedNodeId === undefined ||
      !Number.isInteger(resolvedNodeId) ||
      resolvedNodeId < 1 ||
      resolvedNodeId > MAX_AUX_NODES
    ) {
      return { ok: false, errorMessage: "برد کمکی معتبر انتخاب نشده است." };
    }

    if (auxNodes) {
      ownerNode = auxNodes.find((n) => n.nodeId === resolvedNodeId);
      if (!ownerNode) {
        return { ok: false, errorMessage: "برد کمکی انتخاب‌شده در لیست بردها پیدا نشد." };
      }

      const nodeActiveCount = getAuxNodeActiveSegmentCount(segments, ownerNode.nodeId);
      if (nodeActiveCount >= ownerNode.pinCapacity) {
        return {
          ok: false,
          errorMessage: `ظرفیت پایه‌های برد «${ownerNode.name}» (${ownerNode.pinCapacity} پایه) تکمیل شده است.`,
        };
      }
    }

    const parsedRemotePin =
      input.remotePin !== undefined
        ? Number(input.remotePin)
        : finalPin !== ""
          ? Number(finalPin)
          : Number.NaN;

    if (!isValidRemotePin(parsedRemotePin)) {
      return {
        ok: false,
        errorMessage: "شماره پایه روی برد کمکی (Remote GPIO) باید عددی صحیح بین ۰ تا ۳۹ باشد.",
      };
    }

    resolvedRemotePin = parsedRemotePin;

    const duplicateRemote = segments.some(
      (s) =>
        s.type !== "placeholder" &&
        s.isVirtual &&
        s.nodeId === resolvedNodeId &&
        s.remotePin === resolvedRemotePin,
    );
    if (duplicateRemote) {
      return {
        ok: false,
        errorMessage: `پایه GPIO ${resolvedRemotePin} روی این برد کمکی قبلاً تخصیص داده شده است.`,
      };
    }

    const explicitVirtualPin = finalPin !== "" ? Number(finalPin) : Number.NaN;
    const allocatedVirtualPin =
      isVirtualPin(explicitVirtualPin) &&
      !segments.some((s) => s.type !== "placeholder" && Number(s.pin) === explicitVirtualPin)
        ? explicitVirtualPin
        : allocateNextVirtualPin(segments);

    if (allocatedVirtualPin === null) {
      return {
        ok: false,
        errorMessage: "ظرفیت پایه‌های مجازی (vPin 40 تا 127) تکمیل شده است.",
      };
    }

    finalPin = String(allocatedVirtualPin);
  } else if (finalPin && input.type !== "placeholder") {
    const validation = validateEsp32Pin(finalPin, input.type);

    if (!validation.isValid) {
      return { ok: false, errorMessage: validation.message };
    }
  }

  const finalGroup = ownerNode?.groupName || resolveSegmentGroup(input.group);
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

  const resolvedId = createId
    ? createId()
    : input.type === "placeholder"
      ? createSegmentId()
      : createHardwareSegmentId(finalPin);

  const displayPinForTitle =
    isVirtual && resolvedRemotePin !== undefined
      ? `Remote GPIO ${resolvedRemotePin}`
      : `GPIO ${finalPin}`;

  const newSegment: Segment = {
    id: resolvedId,
    type: isAnalogOutput ? ANALOG_OUTPUT_TYPE : isAnalogInput ? ANALOG_INPUT_TYPE : input.type,
    pin: finalPin,
    title:
      input.title ||
      (isAnalogOutput
        ? `خروجی آنالوگ PWM (${displayPinForTitle})`
        : isAnalogInput
          ? `ورودی آنالوگ ADC (${displayPinForTitle})`
          : input.type === "input"
            ? `ورودی دیجیتال (${displayPinForTitle})`
            : `کنترل پایه دیجیتال (${displayPinForTitle})`),
    group: finalGroup,
    mode: isAnalogOutput || isAnalogInput ? "switch" : input.mode || "switch",
    auto_off: isAnalogInput ? 0 : input.auto_off || 0,
    icon: input.icon,
    ...(isVirtual && resolvedNodeId !== undefined
      ? {
          isVirtual: true,
          nodeId: resolvedNodeId,
          ...(resolvedRemotePin !== undefined ? { remotePin: resolvedRemotePin } : {}),
        }
      : {}),
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
      newSegment.group = ownerNode?.groupName || resolveSegmentGroup(nextSegments[index].group);
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
    finalGroup: newSegment.group,
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

    const validation = validateManagedPin(
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

    const pinValidation = validateManagedPin(
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
