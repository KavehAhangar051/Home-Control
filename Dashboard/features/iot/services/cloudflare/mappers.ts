import type {
  AnalogRangeRule,
  RuleGuardCondition,
  AnalogRangeTriggerMode,
  RuleAction,
  RuleActionType,
  Segment,
  SegmentRule,
} from "@/features/iot/hooks/store/types";
import type { EspConfig } from "@/features/iot/services/esp32Config";
import {
  ANALOG_INPUT_TYPE,
  clampAdcResolution,
  clampAdcValue,
  getAdcMaxValue,
  isAnalogInputType,
  MAX_ANALOG_RANGE_RULES,
  MAX_RULE_ACTIONS_PER_SIDE,
  MAX_RULE_CONDITIONS_PER_ACTION,
  normalizeAnalogInputConfig,
} from "@/features/iot/utils/analogInput";
import {
  ANALOG_OUTPUT_TYPE,
  clampAnalogValue,
  clampPwmFrequency,
  clampPwmResolution,
  hasExplicitAnalogTargetValue,
  isAnalogOutputType,
  MAX_ANALOG_OUTPUT_VALUE,
} from "@/features/iot/utils/analogOutput";
import {
  isValidRemotePin,
  isVirtualPin,
  MAX_AUX_NODES,
  normalizeAuxNodeRecord,
} from "@/features/iot/utils/auxNodeUtils";
import { normalizeMacroRecord, normalizeRuleGuardCondition } from "@/features/iot/utils/macroEngine";
import { CANONICAL_CONFIG_VERSION, createDefaultDeviceInfo } from "../config/defaults";
import { getCloudflareWorkerUrl } from "./config";

const DEFAULT_SEGMENT_GROUP = "Test";

type LegacySingleTargetRule = SegmentRule & {
  targetPin?: string | number;
  triggerState?: boolean;
  actionState?: boolean;
};

type LegacyDualTargetRule = SegmentRule & {
  targetPinHigh?: string | number;
  reqHoldHigh?: number;
  actionOnHigh?: boolean;
  actionTypeHigh?: number;
  delayHigh?: number;
  targetPinLow?: string | number;
  reqHoldLow?: number;
  actionOnLow?: boolean;
  actionTypeLow?: number;
  delayLow?: number;
};

type RawAnalogRangeInput = Omit<AnalogRangeRule, "targetPin" | "triggerMode" | "actionType"> & {
  targetPin: string | number;
  triggerMode: AnalogRangeTriggerMode | "enter" | "exit" | number;
  actionType?: RuleActionType | number;
  actionOn?: boolean;
  aval?: number;
};

type RawRuleActionInput = RuleAction & {
  requiredHoldTime?: number;
  actionState?: boolean;
  aval?: number;
};

type LegacyAutomationRecord = NonNullable<EspConfig["automations"]>[number] & {
  targetPin?: string;
  actionOn?: boolean;
};

export interface CloudflareSerializedConfig extends Omit<EspConfig, "segments"> {
  segments_definition: EspConfig["segments"];
}

export type CloudflareRawPayload = Partial<Omit<EspConfig, "automations">> & {
  segments_definition?: EspConfig["segments"];
  automations?: LegacyAutomationRecord[];
};

/**
 * Returns the canonical group name for a segment group string,
 * defining away empty/missing group special cases.
 */
export function resolveSegmentGroup(group?: string | null): string {
  const trimmed = group?.trim();

  return trimmed ? trimmed : DEFAULT_SEGMENT_GROUP;
}

/** Returns true when a rule defines at least one trigger action or enabled analog range rule. */
export function isSegmentRuleActive(rule?: SegmentRule | null): boolean {
  if (!rule) return false;

  return (
    (rule.highActions?.length ?? 0) > 0 ||
    (rule.lowActions?.length ?? 0) > 0 ||
    Boolean(rule.analogRanges?.some((range) => range.enabled !== false))
  );
}

function normalizeTriggerMode(raw: AnalogRangeTriggerMode | "enter" | "exit" | number): 0 | 1 {
  if (raw === 1 || raw === "exit") return 1;

  return 0;
}

function normalizeRuleActionType(raw?: number): RuleActionType {
  if (raw === 1 || raw === 2) return raw;

  return 0;
}

export function normalizeAnalogRangeRule(
  raw: RawAnalogRangeInput,
  adcResolution?: number | null,
): AnalogRangeRule {
  const maxAdcValue = getAdcMaxValue(adcResolution);
  const rawMin = Number.isFinite(raw.minValue)
    ? Math.min(maxAdcValue, Math.max(0, Math.round(raw.minValue)))
    : 0;
  const rawMax = Number.isFinite(raw.maxValue)
    ? Math.min(maxAdcValue, Math.max(0, Math.round(raw.maxValue)))
    : maxAdcValue;
  const minValue = Math.min(rawMin, rawMax);
  const maxValue = Math.max(rawMin, rawMax);
  const maxHysteresis = Math.floor(maxAdcValue / 2);
  const hysteresis = Number.isFinite(raw.hysteresis)
    ? Math.min(maxHysteresis, Math.max(0, Math.round(raw.hysteresis)))
    : 0;

  const rawTargetValue = raw.targetValue ?? raw.aval;
  const hasAnalog = hasExplicitAnalogTargetValue(rawTargetValue);
  const targetValue = hasAnalog
    ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(rawTargetValue)))
    : rawTargetValue === -1
      ? -1
      : undefined;
  const actionState = hasAnalog
    ? (targetValue as number) > 0
    : Boolean(raw.actionState ?? raw.actionOn);
  const delay = Number.isFinite(raw.delay) ? Math.min(60, Math.max(0, Math.round(raw.delay))) : 0;

  const normalizedRange: AnalogRangeRule = {
    minValue,
    maxValue,
    hysteresis,
    triggerMode: normalizeTriggerMode(raw.triggerMode),
    targetPin: String(raw.targetPin ?? "").trim(),
    actionState,
    actionType: normalizeRuleActionType(raw.actionType),
    delay,
    enabled: raw.enabled !== false,
  };

  if (targetValue !== undefined) {
    normalizedRange.targetValue = targetValue;
  }

  if (Array.isArray(raw.conditions) && raw.conditions.length > 0) {
    const normalizedConds = raw.conditions
      .slice(0, MAX_RULE_CONDITIONS_PER_ACTION)
      .map((c) => normalizeRuleGuardCondition(c))
      .filter((c): c is RuleGuardCondition => Boolean(c));
    if (normalizedConds.length > 0) {
      normalizedRange.conditions = normalizedConds;
      if (raw.conditionLogic === "or" && normalizedConds.length > 1) {
        normalizedRange.conditionLogic = "or";
      }
    }
  }

  return normalizedRange;
}

/**
 * Pure normalization of legacy single-target, dual-target, and V2 digital/analog-range
 * segment rules into canonical structure without mutating the input.
 */
export function normalizeSegmentRule(
  rule?: SegmentRule | LegacySingleTargetRule | LegacyDualTargetRule,
  adcResolution?: number | null,
): SegmentRule | undefined {
  if (!rule) return undefined;

  if ("targetPin" in rule) {
    const triggerState = rule.triggerState ?? true;
    const targetPin =
      rule.targetPin !== undefined && rule.targetPin !== null ? String(rule.targetPin).trim() : "";

    return {
      highActions:
        triggerState && targetPin
          ? [
              {
                reqHold: 0,
                targetPin,
                actionOn: rule.actionState ?? true,
                actionType: 0,
                delay: 0,
              },
            ]
          : [],
      lowActions:
        !triggerState && targetPin
          ? [
              {
                reqHold: 0,
                targetPin,
                actionOn: rule.actionState ?? false,
                actionType: 0,
                delay: 0,
              },
            ]
          : [],
    };
  }

  if ("targetPinHigh" in rule || "targetPinLow" in rule) {
    const highPin =
      rule.targetPinHigh !== undefined && rule.targetPinHigh !== null
        ? String(rule.targetPinHigh).trim()
        : "";
    const lowPin =
      rule.targetPinLow !== undefined && rule.targetPinLow !== null
        ? String(rule.targetPinLow).trim()
        : "";

    return {
      highActions: highPin
        ? [
            {
              reqHold: rule.reqHoldHigh ?? 0,
              targetPin: highPin,
              actionOn: rule.actionOnHigh ?? true,
              actionType: rule.actionTypeHigh ?? 0,
              delay: rule.delayHigh ?? 0,
            },
          ]
        : [],
      lowActions: lowPin
        ? [
            {
              reqHold: rule.reqHoldLow ?? 0,
              targetPin: lowPin,
              actionOn: rule.actionOnLow ?? false,
              actionType: rule.actionTypeLow ?? 0,
              delay: rule.delayLow ?? 0,
            },
          ]
        : [],
    };
  }

  const normalizeAction = (action: RawRuleActionInput): RuleAction => {
    const rawTargetValue = action.targetValue ?? action.aval;
    const rawHold = action.reqHold ?? action.requiredHoldTime ?? 0;
    const normalizedAction: RuleAction = {
      reqHold: Number.isFinite(rawHold) ? Math.round(rawHold) : 0,
      targetPin: String(action.targetPin ?? "").trim(),
      actionOn: Boolean(action.actionOn ?? action.actionState),
      ...(action.actionType !== undefined ? { actionType: action.actionType } : {}),
      ...(action.delay !== undefined ? { delay: action.delay } : {}),
    };

    if (hasExplicitAnalogTargetValue(rawTargetValue)) {
      const clampedVal = Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(rawTargetValue)));
      normalizedAction.targetValue = clampedVal;
      normalizedAction.actionOn = clampedVal > 0;
    } else if (rawTargetValue === -1) {
      normalizedAction.targetValue = -1;
    }

    if (Array.isArray(action.conditions) && action.conditions.length > 0) {
      const normalizedConds = action.conditions
        .slice(0, MAX_RULE_CONDITIONS_PER_ACTION)
        .map((c) => normalizeRuleGuardCondition(c))
        .filter((c): c is RuleGuardCondition => Boolean(c));
      if (normalizedConds.length > 0) {
        normalizedAction.conditions = normalizedConds;
        if (action.conditionLogic === "or" && normalizedConds.length > 1) {
          normalizedAction.conditionLogic = "or";
        }
      }
    }

    return normalizedAction;
  };

  const highActions = rule.highActions
    ? (rule.highActions as RawRuleActionInput[]).slice(0, MAX_RULE_ACTIONS_PER_SIDE).map(normalizeAction)
    : [];
  const lowActions = rule.lowActions
    ? (rule.lowActions as RawRuleActionInput[]).slice(0, MAX_RULE_ACTIONS_PER_SIDE).map(normalizeAction)
    : [];

  const analogRanges = Array.isArray(rule.analogRanges)
    ? (rule.analogRanges as RawAnalogRangeInput[])
        .slice(0, MAX_ANALOG_RANGE_RULES)
        .map((range) => normalizeAnalogRangeRule(range, adcResolution))
    : undefined;

  const normalizedRule: SegmentRule = {
    highActions,
    lowActions,
  };

  if (analogRanges !== undefined) {
    normalizedRule.analogRanges = analogRanges;
  }

  if (rule.active !== undefined || analogRanges !== undefined) {
    normalizedRule.active = isSegmentRuleActive(normalizedRule);
  }

  return normalizedRule;
}

/**
 * Normalizes a segment record at the boundary so callers never have to handle
 * legacy rule schemas, alias types (`pwm_output`), or missing group names.
 */
export function normalizeSegmentRecord(segment: Segment): Segment {
  const isAnalogInput = isAnalogInputType(segment.type);
  const normalizedAdcRes = isAnalogInput ? clampAdcResolution(segment.adcResolution) : undefined;
  const normalizedRule = normalizeSegmentRule(segment.rule, normalizedAdcRes);

  const normalized: Segment = {
    ...segment,
    group: resolveSegmentGroup(segment.group),
  };

  if (isAnalogOutputType(segment.type)) {
    const pwmResolution = clampPwmResolution(segment.pwmResolution);
    const pwmFrequency = clampPwmFrequency(segment.pwmFrequency);
    normalized.type = ANALOG_OUTPUT_TYPE;
    normalized.pwmResolution = pwmResolution;
    normalized.pwmFrequency = pwmFrequency;

    if (segment.analogValue !== undefined) {
      normalized.analogValue = clampAnalogValue(segment.analogValue, pwmResolution);
      normalized.state = normalized.analogValue > 0;
    }

    if (segment.lastNonZeroValue !== undefined && segment.lastNonZeroValue > 0) {
      normalized.lastNonZeroValue = Math.max(
        1,
        clampAnalogValue(segment.lastNonZeroValue, pwmResolution),
      );
    }
  } else if (isAnalogInput) {
    const adcConfig = normalizeAnalogInputConfig({
      adcResolution: segment.adcResolution,
      adcSampleIntervalMs: segment.adcSampleIntervalMs,
      adcDeltaThreshold: segment.adcDeltaThreshold,
      adcHighThreshold: segment.adcHighThreshold,
      adcLowThreshold: segment.adcLowThreshold,
    });
    normalized.type = ANALOG_INPUT_TYPE;
    normalized.adcResolution = adcConfig.adcResolution;
    normalized.adcSampleIntervalMs = adcConfig.adcSampleIntervalMs;
    normalized.adcDeltaThreshold = adcConfig.adcDeltaThreshold;
    normalized.adcHighThreshold = adcConfig.adcHighThreshold;
    normalized.adcLowThreshold = adcConfig.adcLowThreshold;

    if (segment.analogValue !== undefined) {
      normalized.analogValue = clampAdcValue(segment.analogValue, adcConfig.adcResolution);
    }
  }

  if (normalizedRule !== undefined) {
    normalized.rule = normalizedRule;
  }

  const parsedPin = Number(segment.pin);
  const inferredVirtual =
    segment.isVirtual === true || (segment.pin !== "" && isVirtualPin(parsedPin));

  if (inferredVirtual) {
    normalized.isVirtual = true;

    const parsedNodeId = Number(segment.nodeId);
    if (Number.isInteger(parsedNodeId) && parsedNodeId >= 1 && parsedNodeId <= MAX_AUX_NODES) {
      normalized.nodeId = parsedNodeId;
    } else {
      delete normalized.nodeId;
    }

    const parsedRemotePin = Number(segment.remotePin);
    if (
      segment.remotePin !== undefined &&
      Number.isInteger(parsedRemotePin) &&
      isValidRemotePin(parsedRemotePin)
    ) {
      normalized.remotePin = parsedRemotePin;
    } else {
      delete normalized.remotePin;
    }
  } else {
    delete normalized.isVirtual;
    delete normalized.nodeId;
    delete normalized.remotePin;
  }

  return normalized;
}

function normalizeAuxNodesList(
  rawNodes?: EspConfig["auxNodes"],
): NonNullable<EspConfig["auxNodes"]> {
  if (!Array.isArray(rawNodes)) return [];

  const seenIds = new Set<number>();
  const normalized: NonNullable<EspConfig["auxNodes"]> = [];

  for (const rawNode of rawNodes) {
    if (!rawNode || typeof rawNode !== "object") continue;
    const clean = normalizeAuxNodeRecord(rawNode);
    if (!clean || seenIds.has(clean.nodeId)) continue;
    seenIds.add(clean.nodeId);
    normalized.push(clean);
  }

  return normalized;
}

function buildNormalizedPreferences(
  prefs?: Partial<EspConfig["preferences"]>,
): EspConfig["preferences"] {
  return {
    theme_mode: prefs?.theme_mode || "dark",
    accent_color_3: prefs?.accent_color_3 || "#E5E7EB",
    accent_color_4: prefs?.accent_color_4 || "#3B82F6",
    font_family: prefs?.font_family || "dana",
    animations_enabled: prefs?.animations_enabled ?? true,
    animations_fps: prefs?.animations_fps ?? 60,
    header_animation: prefs?.header_animation || "fade",
    header_title: prefs?.header_title || "سامانه کنترل هوشمند IoT",
    matrix_density: prefs?.matrix_density ?? 40,
    matrix_size: prefs?.matrix_size ?? 4,
    matrix_hover_size: prefs?.matrix_hover_size ?? 3,
    matrix_color: prefs?.matrix_color || "#E5E7EB",
    matrix_moving: prefs?.matrix_moving ?? true,
    matrix_mouse_effect: prefs?.matrix_mouse_effect ?? true,
    matrix_twinkle_effect: prefs?.matrix_twinkle_effect ?? false,
    matrix_twinkle_speed: prefs?.matrix_twinkle_speed ?? 50,
    header_position: prefs?.header_position || "top",
    dashboard_width: prefs?.dashboard_width || 1,
    dashboard_bg_color: prefs?.dashboard_bg_color,
    dashboard_bg_opacity: prefs?.dashboard_bg_opacity,
    manual_save_mode: prefs?.manual_save_mode ?? false,
    cuneiform_opacity: prefs?.cuneiform_opacity ?? 0.08,
    cuneiform_color: prefs?.cuneiform_color || "accent3",
  };
}

function buildNormalizedLayout(layout?: Partial<EspConfig["layout"]>): EspConfig["layout"] {
  return {
    groups_order: layout?.groups_order || [],
    groups_cols: layout?.groups_cols || 1,
    group_configs: layout?.group_configs || {},
  };
}

function normalizeAutomationRecord(
  auto: LegacyAutomationRecord,
): NonNullable<EspConfig["automations"]>[number] {
  if (auto.targetPin !== undefined && !auto.actions) {
    const { targetPin, actionOn, ...rest } = auto;

    return {
      ...rest,
      actions: [{ targetPin, actionOn }],
    };
  }

  const normalizedSegConds = Array.isArray(auto.segmentConditions)
    ? auto.segmentConditions
        .map((c) => normalizeRuleGuardCondition(c))
        .filter((c): c is RuleGuardCondition => Boolean(c))
    : undefined;

  if (normalizedSegConds && normalizedSegConds.length > 0) {
    return {
      ...auto,
      segmentConditions: normalizedSegConds,
      ...(auto.segmentConditionLogic === "or" && normalizedSegConds.length > 1
        ? { segmentConditionLogic: "or" as const }
        : { segmentConditionLogic: undefined }),
    };
  }

  return auto;
}

/**
 * Maps our dashboard-stored state schema to the agreed Cloudflare config format.
 */
export function serializeToCloudflare(config: Partial<EspConfig>): CloudflareSerializedConfig {
  return {
    version: config.version || CANONICAL_CONFIG_VERSION,
    device: config.device || createDefaultDeviceInfo(),
    preferences: buildNormalizedPreferences(config.preferences),
    layout: buildNormalizedLayout(config.layout),
    segments_definition: (config.segments || []).map((seg) => {
      const normalized = normalizeSegmentRecord(seg);

      if (normalized.rule) {
        return {
          ...normalized,
          rule: {
            ...normalized.rule,
            active: isSegmentRuleActive(normalized.rule),
          },
        };
      }

      return normalized;
    }),
    automations: (config.automations || []).map(normalizeAutomationRecord),
    macros: (config.macros || []).map(normalizeMacroRecord),
    voiceCommands: config.voiceCommands || [],
    auxNodes: normalizeAuxNodesList(config.auxNodes),
    mqtt: config.mqtt,
    wifi: config.wifi,
    worker_url: config.worker_url || getCloudflareWorkerUrl(),
  };
}

/**
 * Maps the Cloudflare config structure back to our native dashboard format,
 * normalizing legacy automation and segment rule schemas at the boundary.
 */
export function deserializeFromCloudflare(cfData: CloudflareRawPayload): EspConfig {
  const rawSegments = cfData.segments_definition || cfData.segments || [];

  return {
    version: cfData.version || CANONICAL_CONFIG_VERSION,
    device: cfData.device || createDefaultDeviceInfo(),
    preferences: buildNormalizedPreferences(cfData.preferences),
    layout: buildNormalizedLayout(cfData.layout),
    segments: rawSegments.map(normalizeSegmentRecord),
    automations: (cfData.automations || []).map(normalizeAutomationRecord),
    macros: (cfData.macros || []).map(normalizeMacroRecord),
    voiceCommands: cfData.voiceCommands || [],
    auxNodes: normalizeAuxNodesList(cfData.auxNodes),
    mqtt: cfData.mqtt,
    wifi: cfData.wifi,
    worker_url: cfData.worker_url || undefined,
  };
}
