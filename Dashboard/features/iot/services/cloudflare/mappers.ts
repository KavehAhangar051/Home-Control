import type { RuleAction, Segment, SegmentRule } from "@/features/iot/hooks/store/types";
import type { EspConfig } from "@/features/iot/services/esp32Config";
import {
  ANALOG_OUTPUT_TYPE,
  clampAnalogValue,
  clampPwmFrequency,
  clampPwmResolution,
  hasExplicitAnalogTargetValue,
  isAnalogOutputType,
  MAX_ANALOG_OUTPUT_VALUE,
} from "@/features/iot/utils/analogOutput";
import { CANONICAL_CONFIG_VERSION, createDefaultDeviceInfo } from "../config/defaults";
import { getCloudflareWorkerUrl } from "./config";

const DEFAULT_SEGMENT_GROUP = "Test";

type LegacySingleTargetRule = SegmentRule & {
  targetPin?: string;
  triggerState?: boolean;
  actionState?: boolean;
};

type LegacyDualTargetRule = SegmentRule & {
  targetPinHigh?: string;
  reqHoldHigh?: number;
  actionOnHigh?: boolean;
  actionTypeHigh?: number;
  delayHigh?: number;
  targetPinLow?: string;
  reqHoldLow?: number;
  actionOnLow?: boolean;
  actionTypeLow?: number;
  delayLow?: number;
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

/**
 * Pure normalization of legacy single-target and dual-target segment rules into
 * the canonical `{ highActions, lowActions }` structure without mutating the input.
 */
export function normalizeSegmentRule(
  rule?: SegmentRule | LegacySingleTargetRule | LegacyDualTargetRule,
): SegmentRule | undefined {
  if (!rule) return undefined;

  if ("targetPin" in rule) {
    const triggerState = rule.triggerState ?? true;
    const targetPin = rule.targetPin;

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
    return {
      highActions: rule.targetPinHigh
        ? [
            {
              reqHold: rule.reqHoldHigh || 0,
              targetPin: rule.targetPinHigh,
              actionOn: rule.actionOnHigh ?? true,
              actionType: rule.actionTypeHigh || 0,
              delay: rule.delayHigh || 0,
            },
          ]
        : [],
      lowActions: rule.targetPinLow
        ? [
            {
              reqHold: rule.reqHoldLow || 0,
              targetPin: rule.targetPinLow,
              actionOn: rule.actionOnLow ?? false,
              actionType: rule.actionTypeLow || 0,
              delay: rule.delayLow || 0,
            },
          ]
        : [],
    };
  }

  const normalizeAction = (action: RuleAction & { aval?: number }): RuleAction => {
    const rawTargetValue = action.targetValue ?? action.aval;
    const normalizedAction: RuleAction = {
      reqHold: action.reqHold,
      targetPin: action.targetPin,
      actionOn: action.actionOn,
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

    return normalizedAction;
  };

  return {
    highActions: rule.highActions ? rule.highActions.map(normalizeAction) : [],
    lowActions: rule.lowActions ? rule.lowActions.map(normalizeAction) : [],
  };
}

/**
 * Normalizes a segment record at the boundary so callers never have to handle
 * legacy rule schemas, alias types (`pwm_output`), or missing group names.
 */
export function normalizeSegmentRecord(segment: Segment): Segment {
  const normalizedRule = normalizeSegmentRule(segment.rule);

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
  }

  if (normalizedRule !== undefined) {
    normalized.rule = normalizedRule;
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
    segments_definition: (config.segments || []).map(normalizeSegmentRecord),
    automations: config.automations || [],
    macros: config.macros || [],
    voiceCommands: config.voiceCommands || [],
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
    macros: cfData.macros || [],
    voiceCommands: cfData.voiceCommands || [],
    mqtt: cfData.mqtt,
    wifi: cfData.wifi,
    worker_url: cfData.worker_url || undefined,
  };
}
