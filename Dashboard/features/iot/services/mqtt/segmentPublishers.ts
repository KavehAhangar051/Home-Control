import type { Segment } from "@/features/iot/hooks/store/types";
import {
  AUX_CHIP_CODE_MAP,
  type AuxChipType,
  type AuxNodeConfig,
  type ConditionLogic,
  type MacroAnalogOutputOperator,
  type RuleGuardCondition,
} from "@/features/iot/services/config/types";
import {
  type AnalogInputSegmentOptions,
  clampAdcResolution,
  isAnalogInputType,
  normalizeAnalogInputConfig,
  percentToAdcValue,
} from "@/features/iot/utils/analogInput";
import {
  type AnalogSegmentOptions,
  clampAnalogValue,
  clampPwmFrequency,
  clampPwmResolution,
  hasExplicitAnalogTargetValue,
  isAnalogOutputType,
  MAX_ANALOG_OUTPUT_VALUE,
  percentToAnalogDuty,
} from "@/features/iot/utils/analogOutput";
import {
  AUX_NODE_NAME_MAX_BYTES,
  isValidManagedPin,
  isValidRemotePin,
  isVirtualPin,
  MAX_AUX_NODES,
  MAX_AUX_PIN_CAPACITY,
  parseAndValidateMac,
  truncateUtf8Bytes,
} from "@/features/iot/utils/auxNodeUtils";
import { publishMqttCommand } from "./client";
import {
  ANALOG_INPUT_CONFIG_BASE_SIZE,
  ANALOG_INPUT_CONFIG_WITH_RES_SIZE,
  ANALOG_INPUT_SEGMENT_EXT_SIZE,
  ANALOG_RANGE_HEADER_SIZE,
  ANALOG_RANGE_RECORD_SIZE,
  ANALOG_SEGMENT_EXT_SIZE,
  AUX_NODE_DELETE_CASCADE_FLAG,
  MAX_ANALOG_RANGE_RULES,
  MAX_RULE_ACTIONS_PER_SIDE,
  MAX_RULE_CONDITIONS_PER_ACTION,
  MQTT_OPCODES,
  PIN_STATE_HIGH,
  PIN_STATE_LOW,
  READ_ANALOG_INPUT_BUFFER_SIZE,
  RULE_ACTION_SIZE,
  RULE_ANALOG_ACTION_SIZE,
  RULE_CONDITION_SIZE,
  RULE_CONDITIONAL_ACTION_BASE_SIZE,
  RULE_TARGET_VALUE_BOOLEAN,
} from "./protocol";

const textEncoder = new TextEncoder();

export interface RuleActionFrameInput {
  reqHold: number;
  targetPin: string;
  actionOn: boolean;
  actionType?: number;
  delay?: number;
  targetValue?: number | null;
  conditions?: RuleGuardCondition[];
  conditionLogic?: ConditionLogic;
}

export interface UpsertAuxNodeFrameInput {
  nodeId: number;
  mac: string;
  pinCapacity: number;
  chipType: AuxChipType;
  name: string;
}

export interface AddVirtualSegmentFrameInput {
  virtualPin: number;
  nodeId: number;
  remotePin: number;
  id: string;
  type: string;
  initState?: boolean;
  analogOptions?: AnalogSegmentOptions;
  analogInputOptions?: AnalogInputSegmentOptions;
}

function writeTrailingSegmentMetadata(
  buf: Uint8Array,
  startOffset: number,
  isAnalogOutput: boolean,
  isAnalogInput: boolean,
  analogOptions?: AnalogSegmentOptions,
  analogInputOptions?: AnalogInputSegmentOptions,
): void {
  let offset = startOffset;

  if (isAnalogOutput) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const resolution = clampPwmResolution(analogOptions?.pwmResolution);
    const frequency = clampPwmFrequency(analogOptions?.pwmFrequency);
    const initialValue = clampAnalogValue(analogOptions?.initialValue ?? 0, resolution);

    buf[offset++] = resolution;
    view.setUint16(offset, frequency, true);
    offset += 2;
    view.setUint16(offset, initialValue, true);
  } else if (isAnalogInput) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const normalized = normalizeAnalogInputConfig(analogInputOptions);

    buf[offset++] = normalized.adcResolution;
    view.setUint16(offset, normalized.adcSampleIntervalMs, true);
    offset += 2;
    view.setUint16(offset, normalized.adcDeltaThreshold, true);
    offset += 2;
    view.setUint16(offset, normalized.adcHighThreshold, true);
    offset += 2;
    view.setUint16(offset, normalized.adcLowThreshold, true);
  }
}

export const buildAddSegmentFrame = (
  id: string,
  type: string,
  pin: number,
  value: boolean,
  analogOptions?: AnalogSegmentOptions,
  analogInputOptions?: AnalogInputSegmentOptions,
): Uint8Array => {
  const idBytes = truncateUtf8Bytes(id, 31);
  const typeBytes = truncateUtf8Bytes(type, 31);
  const isAnalogOutput = isAnalogOutputType(type);
  const isAnalogInput = isAnalogInputType(type);
  const baseSize = 3 + idBytes.length + 1 + typeBytes.length + 1;
  const extSize = isAnalogOutput
    ? ANALOG_SEGMENT_EXT_SIZE
    : isAnalogInput
      ? ANALOG_INPUT_SEGMENT_EXT_SIZE
      : 0;
  const buf = new Uint8Array(baseSize + extSize);

  buf[0] = MQTT_OPCODES.ADD_SEGMENT;
  buf[1] = pin & 0xff;
  buf[2] = isAnalogOutput || isAnalogInput ? PIN_STATE_LOW : value ? PIN_STATE_HIGH : PIN_STATE_LOW;

  let offset = 3;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = 0;
  buf.set(typeBytes, offset);
  offset += typeBytes.length;
  buf[offset++] = 0;

  writeTrailingSegmentMetadata(
    buf,
    offset,
    isAnalogOutput,
    isAnalogInput,
    analogOptions,
    analogInputOptions,
  );

  return buf;
};

export const publishAddSegmentCommand = (
  id: string,
  type: string,
  pin: number,
  value: boolean,
  analogOptions?: AnalogSegmentOptions,
  analogInputOptions?: AnalogInputSegmentOptions,
) => {
  const buf = buildAddSegmentFrame(id, type, pin, value, analogOptions, analogInputOptions);
  publishMqttCommand(buf, `Published add_segment: pin=${pin} id=${id} type=${type}`);
};

/**
 * Builds Opcode `0x0F` (`UPSERT_AUX_NODE`) binary frame:
 * `[0x0F][nodeId:u8 (1..16)][mac:6B][pinCapacity:u8 (1..32)][chipType:u8 (0..5)][name_utf8(<=31B)...][0x00]`.
 */
export const buildUpsertAuxNodeFrame = (
  node: UpsertAuxNodeFrameInput | AuxNodeConfig,
): Uint8Array => {
  if (!Number.isInteger(node.nodeId) || node.nodeId < 1 || node.nodeId > MAX_AUX_NODES) {
    throw new RangeError(`Invalid auxiliary nodeId: ${node.nodeId}`);
  }

  if (
    !Number.isInteger(node.pinCapacity) ||
    node.pinCapacity < 1 ||
    node.pinCapacity > MAX_AUX_PIN_CAPACITY
  ) {
    throw new RangeError(`Invalid auxiliary pinCapacity: ${node.pinCapacity}`);
  }

  const macRes = parseAndValidateMac(node.mac);
  if (!macRes.ok) {
    throw new RangeError(macRes.error);
  }

  const chipCode = AUX_CHIP_CODE_MAP[node.chipType] ?? 0;
  const nameBytes = truncateUtf8Bytes(node.name, AUX_NODE_NAME_MAX_BYTES);

  // Header: 1 (opcode) + 1 (nodeId) + 6 (mac) + 1 (pinCapacity) + 1 (chipType) = 10 bytes
  const buf = new Uint8Array(10 + nameBytes.length + 1);
  buf[0] = MQTT_OPCODES.UPSERT_AUX_NODE;
  buf[1] = node.nodeId & 0xff;
  buf.set(macRes.bytes, 2);
  buf[8] = node.pinCapacity & 0xff;
  buf[9] = chipCode & 0xff;
  buf.set(nameBytes, 10);
  buf[10 + nameBytes.length] = 0;

  return buf;
};

export const publishUpsertAuxNodeCommand = (
  node: UpsertAuxNodeFrameInput | AuxNodeConfig,
): boolean => {
  const buf = buildUpsertAuxNodeFrame(node);

  return publishMqttCommand(
    buf,
    `Published upsert_aux_node(0x0F): nodeId=${node.nodeId} mac=${node.mac} cap=${node.pinCapacity}`,
  );
};

export interface DeleteAuxNodeFrameOptions {
  cascadeSegments?: boolean;
  mac?: string;
}

/**
 * Builds Opcode `0x10` (`DELETE_AUX_NODE`) binary frame:
 * `[0x10][nodeId:u8 (0..16)][flags:u8 (bit0=cascadeSegments)][optional mac:6B]`.
 */
export const buildDeleteAuxNodeFrame = (
  nodeId: number,
  cascadeOrOptions: boolean | DeleteAuxNodeFrameOptions = true,
  macArg?: string,
): Uint8Array => {
  if (!Number.isInteger(nodeId) || nodeId < 0 || nodeId > MAX_AUX_NODES) {
    throw new RangeError(`Invalid auxiliary nodeId: ${nodeId}`);
  }

  const cascadeSegments =
    typeof cascadeOrOptions === "object"
      ? (cascadeOrOptions.cascadeSegments ?? true)
      : cascadeOrOptions;
  const mac = typeof cascadeOrOptions === "object" ? cascadeOrOptions.mac : macArg;

  const parsedMac = mac ? parseAndValidateMac(mac) : null;
  const hasValidMac = Boolean(parsedMac?.ok);

  if (nodeId === 0 && !hasValidMac) {
    throw new RangeError("Deleting auxiliary node requires a valid nodeId (1..16) or MAC address.");
  }

  const flags = cascadeSegments ? AUX_NODE_DELETE_CASCADE_FLAG : 0x00;
  const buf = new Uint8Array(hasValidMac ? 9 : 3);
  buf[0] = MQTT_OPCODES.DELETE_AUX_NODE;
  buf[1] = nodeId & 0xff;
  buf[2] = flags;

  if (parsedMac?.ok) {
    buf.set(parsedMac.bytes, 3);
  }

  return buf;
};

export const publishDeleteAuxNodeCommand = (
  nodeId: number,
  cascadeOrOptions: boolean | DeleteAuxNodeFrameOptions = true,
  macArg?: string,
): boolean => {
  const cascadeSegments =
    typeof cascadeOrOptions === "object"
      ? (cascadeOrOptions.cascadeSegments ?? true)
      : cascadeOrOptions;
  const mac = typeof cascadeOrOptions === "object" ? cascadeOrOptions.mac : macArg;
  const buf = buildDeleteAuxNodeFrame(nodeId, cascadeSegments, mac);

  return publishMqttCommand(
    buf,
    `Published delete_aux_node(0x10): nodeId=${nodeId} cascade=${cascadeSegments}${mac ? ` mac=${mac}` : ""}`,
  );
};

/**
 * Builds Opcode `0x11` (`ADD_VIRTUAL_SEGMENT`) binary frame:
 * `[0x11][virtualPin:u8 (40..127)][nodeId:u8 (1..16)][remotePin:u8 (0..39)][initState:u8][id...][0x00][type...][0x00][optional 5B PWM or 9B ADC metadata]`.
 */
export const buildAddVirtualSegmentFrame = (input: AddVirtualSegmentFrameInput): Uint8Array => {
  if (!isVirtualPin(input.virtualPin)) {
    throw new RangeError(`Invalid virtualPin (expected 40..127): ${input.virtualPin}`);
  }

  if (!Number.isInteger(input.nodeId) || input.nodeId < 1 || input.nodeId > MAX_AUX_NODES) {
    throw new RangeError(`Invalid auxiliary nodeId (expected 1..16): ${input.nodeId}`);
  }

  if (!isValidRemotePin(input.remotePin)) {
    throw new RangeError(`Invalid remotePin (expected 0..39): ${input.remotePin}`);
  }

  const idBytes = truncateUtf8Bytes(input.id, 31);
  const typeBytes = truncateUtf8Bytes(input.type, 31);
  const isAnalogOutput = isAnalogOutputType(input.type);
  const isAnalogInput = isAnalogInputType(input.type);
  const baseSize = 5 + idBytes.length + 1 + typeBytes.length + 1;
  const extSize = isAnalogOutput
    ? ANALOG_SEGMENT_EXT_SIZE
    : isAnalogInput
      ? ANALOG_INPUT_SEGMENT_EXT_SIZE
      : 0;
  const buf = new Uint8Array(baseSize + extSize);

  buf[0] = MQTT_OPCODES.ADD_VIRTUAL_SEGMENT;
  buf[1] = input.virtualPin & 0xff;
  buf[2] = input.nodeId & 0xff;
  buf[3] = input.remotePin & 0xff;
  buf[4] =
    isAnalogOutput || isAnalogInput
      ? PIN_STATE_LOW
      : input.initState
        ? PIN_STATE_HIGH
        : PIN_STATE_LOW;

  let offset = 5;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = 0;
  buf.set(typeBytes, offset);
  offset += typeBytes.length;
  buf[offset++] = 0;

  writeTrailingSegmentMetadata(
    buf,
    offset,
    isAnalogOutput,
    isAnalogInput,
    input.analogOptions,
    input.analogInputOptions,
  );

  return buf;
};

export const publishAddVirtualSegmentCommand = (input: AddVirtualSegmentFrameInput): boolean => {
  const buf = buildAddVirtualSegmentFrame(input);

  return publishMqttCommand(
    buf,
    `Published add_virtual_segment(0x11): vPin=${input.virtualPin} nodeId=${input.nodeId} rPin=${input.remotePin} id=${input.id} type=${input.type}`,
  );
};

/**
 * Builds Opcode `0x0C` (`UPDATE_ANALOG_INPUT_CONFIG`) binary frame (10 or 11 bytes):
 * `[0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]` + optional `[res:u8]`.
 */
export const buildUpdateAnalogInputConfigFrame = (
  pin: number,
  config: AnalogInputSegmentOptions,
): Uint8Array => {
  const includeResolution =
    config.adcResolution !== undefined &&
    Number.isFinite(config.adcResolution) &&
    config.adcResolution > 0;
  const normalized = normalizeAnalogInputConfig({
    ...config,
    adcResolution: includeResolution ? clampAdcResolution(config.adcResolution) : undefined,
  });

  const buf = new Uint8Array(
    includeResolution ? ANALOG_INPUT_CONFIG_WITH_RES_SIZE : ANALOG_INPUT_CONFIG_BASE_SIZE,
  );
  const view = new DataView(buf.buffer);

  buf[0] = MQTT_OPCODES.UPDATE_ANALOG_INPUT_CONFIG;
  buf[1] = pin & 0xff;
  view.setUint16(2, normalized.adcSampleIntervalMs, true);
  view.setUint16(4, normalized.adcDeltaThreshold, true);
  view.setUint16(6, normalized.adcHighThreshold, true);
  view.setUint16(8, normalized.adcLowThreshold, true);

  if (includeResolution) {
    buf[10] = normalized.adcResolution;
  }

  return buf;
};

export const publishUpdateAnalogInputConfigCommand = (
  pin: number,
  config: AnalogInputSegmentOptions,
): boolean => {
  const buf = buildUpdateAnalogInputConfigFrame(pin, config);

  return publishMqttCommand(
    buf,
    `Published update_analog_input_config(0x0C): pin=${pin} size=${buf.length}b`,
  );
};

/**
 * Builds the 2-byte Opcode `0x0D` (`READ_ANALOG_INPUT`) binary frame: `[0x0D][pin:u8]`.
 */
export const buildReadAnalogInputFrame = (pin: number): Uint8Array => {
  const buf = new Uint8Array(READ_ANALOG_INPUT_BUFFER_SIZE);
  buf[0] = MQTT_OPCODES.READ_ANALOG_INPUT;
  buf[1] = pin & 0xff;

  return buf;
};

export const publishReadAnalogInputCommand = (pin: number): boolean => {
  const buf = buildReadAnalogInputFrame(pin);

  return publishMqttCommand(buf, `Published read_analog_input(0x0D): pin=${pin}`);
};

export const buildDeleteSegmentFrame = (id: string, pin?: number | string): Uint8Array => {
  const idBytes = textEncoder.encode(id.slice(0, 31));
  const parsedPin =
    pin !== undefined && pin !== null && String(pin).trim() !== "" ? Number(pin) : Number.NaN;
  const hasValidPin = isValidManagedPin(parsedPin);

  const buf = new Uint8Array(1 + idBytes.length + 1 + (hasValidPin ? 1 : 0));
  buf[0] = MQTT_OPCODES.DELETE_SEGMENT;
  buf.set(idBytes, 1);
  buf[1 + idBytes.length] = 0;

  if (hasValidPin) {
    buf[1 + idBytes.length + 1] = parsedPin & 0xff;
  }

  return buf;
};

export const publishDeleteSegmentCommand = (id: string, pin?: number | string) => {
  const buf = buildDeleteSegmentFrame(id, pin);
  publishMqttCommand(
    buf,
    pin !== undefined
      ? `Published delete_segment: id=${id}, pin=${pin}`
      : `Published delete_segment: id=${id}`,
  );
};

const RULE_CONDITION_OP_CODE: Record<MacroAnalogOutputOperator, number> = {
  is_on: 0,
  is_off: 1,
  gt: 2,
  gte: 3,
  lt: 4,
  lte: 5,
  eq: 6,
  between: 7,
  outside: 8,
};

interface EncodedRuleCondition {
  sourcePin: number;
  opCode: number;
  value: number;
  maxValue: number;
}

function encodeConditionListForWire(
  conditions?: readonly RuleGuardCondition[],
  logic?: ConditionLogic,
  segments?: readonly Pick<Segment, "pin" | "type" | "adcResolution" | "pwmResolution">[],
): { metaByte: number; items: EncodedRuleCondition[] } {
  const enabled = (conditions ?? [])
    .filter((c) => c.enabled !== false && String(c.sourcePin ?? "").trim().length > 0)
    .slice(0, MAX_RULE_CONDITIONS_PER_ACTION);

  const items: EncodedRuleCondition[] = [];
  for (let i = 0; i < enabled.length; i++) {
    const c = enabled[i];
    const parsedPin = Number.parseInt(String(c.sourcePin).trim(), 10);
    if (!isValidManagedPin(parsedPin)) continue;

    if (c.parameter === "digital_input" || c.parameter === "digital_output") {
      items.push({
        sourcePin: parsedPin,
        opCode: c.expectedState ? 0 : 1,
        value: 0,
        maxValue: 0,
      });
      continue;
    }

    const op: MacroAnalogOutputOperator =
      c.operator ?? (c.parameter === "analog_output" ? "is_on" : "gt");
    const opCode = RULE_CONDITION_OP_CODE[op] ?? 2;

    if (op === "is_on" || op === "is_off") {
      items.push({ sourcePin: parsedPin, opCode, value: 0, maxValue: 0 });
      continue;
    }

    const matchedSeg = segments?.find((s) => s.pin.trim() === String(parsedPin));
    const rawValInput = Number.isFinite(c.value) ? Math.max(0, Math.round(c.value as number)) : 0;
    const rawMaxInput = Number.isFinite(c.maxValue)
      ? Math.max(0, Math.round(c.maxValue as number))
      : rawValInput;

    const resolveVal = (v: number): number => {
      if (c.unit !== "raw") {
        if (c.parameter === "analog_input") {
          return percentToAdcValue(v, clampAdcResolution(matchedSeg?.adcResolution));
        }
        return percentToAnalogDuty(v, clampPwmResolution(matchedSeg?.pwmResolution));
      }
      return Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, v));
    };

    const value = resolveVal(rawValInput);
    const maxValue =
      op === "between" || op === "outside" ? resolveVal(rawMaxInput) : 0;
    items.push({
      sourcePin: parsedPin,
      opCode,
      value: op === "between" || op === "outside" ? Math.min(value, maxValue) : value,
      maxValue: op === "between" || op === "outside" ? Math.max(value, maxValue) : 0,
    });
  }

  const logicBit = logic === "or" ? 0x10 : 0x00;
  return {
    metaByte: (items.length & 0x0f) | logicBit,
    items,
  };
}

function writeRuleActionChunk(
  buf: Uint8Array,
  view: DataView,
  startOffset: number,
  actions: RuleActionFrameInput[],
): number {
  let offset = startOffset;
  buf[offset++] = actions.length;

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    buf[offset++] = (Number(a.targetPin || -1) | 0) & 0xff;
    view.setInt32(offset, a.reqHold ?? 0, true);
    offset += 4;
    buf[offset++] = a.actionOn ? 1 : 0;
    buf[offset++] = a.actionType || 0;
    view.setInt32(offset, a.delay || 0, true);
    offset += 4;
  }

  return offset;
}

function writeRuleAnalogActionChunk(
  buf: Uint8Array,
  view: DataView,
  startOffset: number,
  actions: RuleActionFrameInput[],
): number {
  let offset = startOffset;
  buf[offset++] = actions.length;

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const hasAnalog = hasExplicitAnalogTargetValue(a.targetValue);
    const clampedTargetValue = hasExplicitAnalogTargetValue(a.targetValue)
      ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(a.targetValue)))
      : RULE_TARGET_VALUE_BOOLEAN;

    buf[offset++] = (Number(a.targetPin || -1) | 0) & 0xff;
    view.setInt32(offset, a.reqHold ?? 0, true);
    offset += 4;
    buf[offset++] = hasAnalog ? (clampedTargetValue > 0 ? 1 : 0) : a.actionOn ? 1 : 0;
    buf[offset++] = a.actionType || 0;
    view.setInt32(offset, a.delay || 0, true);
    offset += 4;
    view.setInt16(offset, clampedTargetValue, true);
    offset += 2;
  }

  return offset;
}

export const buildUpdateRuleFrame = (
  inputPin: number,
  highActions: RuleActionFrameInput[] = [],
  lowActions: RuleActionFrameInput[] = [],
): Uint8Array => {
  const highLen = highActions.length;
  const lowLen = lowActions.length;

  if (!isValidManagedPin(inputPin)) {
    throw new RangeError(`Invalid input pin (expected 0..127): ${inputPin}`);
  }

  const bufSize = 4 + highLen * RULE_ACTION_SIZE + lowLen * RULE_ACTION_SIZE;

  const buf = new Uint8Array(bufSize);
  const view = new DataView(buf.buffer);

  buf[0] = MQTT_OPCODES.UPDATE_RULE;
  let offset = 1;
  buf[offset++] = inputPin;

  offset = writeRuleActionChunk(buf, view, offset, highActions);
  writeRuleActionChunk(buf, view, offset, lowActions);

  return buf;
};

/**
 * Builds Opcode `0x0B` (`UPDATE_RULE_ANALOG`) binary frame with 13-byte actions carrying
 * `int16 LE targetValue` (`-1` for boolean ON/OFF, `0..4095` for explicit PWM duty).
 */
export const buildUpdateRuleAnalogFrame = (
  inputPin: number,
  highActions: RuleActionFrameInput[] = [],
  lowActions: RuleActionFrameInput[] = [],
): Uint8Array => {
  if (!isValidManagedPin(inputPin)) {
    throw new RangeError(`Invalid input pin (expected 0..127): ${inputPin}`);
  }

  const hi = highActions.slice(0, MAX_RULE_ACTIONS_PER_SIDE);
  const lo = lowActions.slice(0, MAX_RULE_ACTIONS_PER_SIDE);
  const bufSize = 4 + (hi.length + lo.length) * RULE_ANALOG_ACTION_SIZE;

  const buf = new Uint8Array(bufSize);
  const view = new DataView(buf.buffer);

  buf[0] = MQTT_OPCODES.UPDATE_RULE_ANALOG;
  let offset = 1;
  buf[offset++] = inputPin;

  offset = writeRuleAnalogActionChunk(buf, view, offset, hi);
  writeRuleAnalogActionChunk(buf, view, offset, lo);

  return buf;
};

function hasEnabledGuardConditions(conditions?: readonly RuleGuardCondition[]): boolean {
  return Boolean(
    conditions?.some((c) => c.enabled !== false && String(c.sourcePin ?? "").trim().length > 0),
  );
}

/**
 * Builds Opcode `0x12` (`UPDATE_RULE_CONDITIONAL`) binary frame supporting up to
 * 6 actions per side, explicit PWM targetValue, and 0..4 guard conditions per action.
 */
export const buildUpdateRuleConditionalFrame = (
  inputPin: number,
  highActions: RuleActionFrameInput[] = [],
  lowActions: RuleActionFrameInput[] = [],
  segments?: readonly Pick<Segment, "pin" | "type" | "adcResolution" | "pwmResolution">[],
): Uint8Array => {
  if (!isValidManagedPin(inputPin)) {
    throw new RangeError(`Invalid input pin (expected 0..127): ${inputPin}`);
  }

  const encodeSide = (actions: RuleActionFrameInput[]) =>
    actions.slice(0, MAX_RULE_ACTIONS_PER_SIDE).map((a) => ({
      action: a,
      cond: encodeConditionListForWire(a.conditions, a.conditionLogic, segments),
    }));

  const hi = encodeSide(highActions);
  const lo = encodeSide(lowActions);
  const sideBytes = (side: ReturnType<typeof encodeSide>) =>
    side.reduce(
      (sum, entry) => sum + RULE_CONDITIONAL_ACTION_BASE_SIZE + entry.cond.items.length * RULE_CONDITION_SIZE,
      0,
    );

  const buf = new Uint8Array(4 + sideBytes(hi) + sideBytes(lo));
  const view = new DataView(buf.buffer);
  buf[0] = MQTT_OPCODES.UPDATE_RULE_CONDITIONAL;
  let offset = 1;
  buf[offset++] = inputPin & 0xff;

  const writeSide = (side: ReturnType<typeof encodeSide>) => {
    buf[offset++] = side.length;
    for (let i = 0; i < side.length; i++) {
      const { action: a, cond } = side[i];
      const hasAnalog = hasExplicitAnalogTargetValue(a.targetValue);
      const clampedTargetValue = hasExplicitAnalogTargetValue(a.targetValue)
        ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(a.targetValue)))
        : RULE_TARGET_VALUE_BOOLEAN;

      buf[offset++] = (Number(a.targetPin || -1) | 0) & 0xff;
      view.setInt32(offset, a.reqHold ?? 0, true);
      offset += 4;
      buf[offset++] = hasAnalog ? (clampedTargetValue > 0 ? 1 : 0) : a.actionOn ? 1 : 0;
      buf[offset++] = a.actionType || 0;
      view.setInt32(offset, a.delay || 0, true);
      offset += 4;
      view.setInt16(offset, clampedTargetValue, true);
      offset += 2;
      buf[offset++] = cond.metaByte;
      for (let c = 0; c < cond.items.length; c++) {
        const item = cond.items[c];
        buf[offset++] = item.sourcePin & 0xff;
        buf[offset++] = item.opCode & 0xff;
        view.setUint16(offset, item.value, true);
        offset += 2;
        view.setUint16(offset, item.maxValue, true);
        offset += 2;
      }
    }
  };

  writeSide(hi);
  writeSide(lo);
  return buf;
};

export const publishUpdateRuleCommand = (
  inputPin: number,
  highActions: RuleActionFrameInput[] = [],
  lowActions: RuleActionFrameInput[] = [],
  segments?: readonly Pick<Segment, "pin" | "type" | "adcResolution" | "pwmResolution">[],
): boolean => {
  const usesConditional =
    highActions.length > 4 ||
    lowActions.length > 4 ||
    highActions.some((a) => hasEnabledGuardConditions(a.conditions)) ||
    lowActions.some((a) => hasEnabledGuardConditions(a.conditions));
  const usesAnalogTargets =
    highActions.some((a) => hasExplicitAnalogTargetValue(a.targetValue)) ||
    lowActions.some((a) => hasExplicitAnalogTargetValue(a.targetValue));

  const buf = usesConditional
    ? buildUpdateRuleConditionalFrame(inputPin, highActions, lowActions, segments)
    : usesAnalogTargets
      ? buildUpdateRuleAnalogFrame(inputPin, highActions, lowActions)
      : buildUpdateRuleFrame(inputPin, highActions, lowActions);

  const label = usesConditional
    ? "update_rule_conditional(0x12)"
    : usesAnalogTargets
      ? "update_rule_analog(0x0B)"
      : "update_rule(0x05)";

  return publishMqttCommand(
    buf,
    `Published ${label}: input_pin=${inputPin} size=${buf.length}b`,
  );
};

export interface AnalogRangeRuleFrameInput {
  minValue: number;
  maxValue: number;
  hysteresis?: number;
  triggerMode: 0 | 1 | number;
  targetPin: string | number;
  actionState?: boolean;
  targetValue?: number | null;
  actionType?: 0 | 1 | 2 | number;
  delay?: number;
  enabled?: boolean;
  conditions?: RuleGuardCondition[];
  conditionLogic?: ConditionLogic;
}

/**
 * Encodes Opcode `0x0E` (`UPDATE_ANALOG_RANGE_RULES`) Little-Endian binary frame:
 * Header: `[0x0E][inputPin:u8][rangeCount:u8]` + `rangeCount * 12` bytes.
 * Passing zero enabled ranges yields a 3-byte clear-all frame `[0x0E, inputPin, 0x00]`.
 */
export const encodeUpdateAnalogRangeRulesFrame = (
  inputPin: number,
  ranges: readonly AnalogRangeRuleFrameInput[] = [],
): Uint8Array => {
  if (!isValidManagedPin(inputPin)) {
    throw new RangeError(`Invalid input pin (expected 0..127): ${inputPin}`);
  }

  const activeRanges = ranges.filter((r) => r.enabled !== false).slice(0, MAX_ANALOG_RANGE_RULES);
  const buf = new Uint8Array(
    ANALOG_RANGE_HEADER_SIZE + activeRanges.length * ANALOG_RANGE_RECORD_SIZE,
  );
  const view = new DataView(buf.buffer);

  buf[0] = MQTT_OPCODES.UPDATE_ANALOG_RANGE_RULES;
  buf[1] = inputPin & 0xff;
  buf[2] = activeRanges.length & 0xff;

  let offset = ANALOG_RANGE_HEADER_SIZE;

  for (let i = 0; i < activeRanges.length; i++) {
    const r = activeRanges[i];
    const minVal = Math.max(
      0,
      Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.round(Math.min(r.minValue, r.maxValue))),
    );
    const maxVal = Math.max(
      0,
      Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.round(Math.max(r.minValue, r.maxValue))),
    );
    const hysteresis = Math.max(0, Math.min(2047, Math.round(r.hysteresis ?? 0)));
    const parsedTargetPin =
      typeof r.targetPin === "number"
        ? r.targetPin
        : Number.parseInt(String(r.targetPin).trim(), 10);
    const targetPin = Number.isInteger(parsedTargetPin) ? parsedTargetPin : -1;
    const hasAnalogTarget = hasExplicitAnalogTargetValue(r.targetValue);
    const targetValue = hasExplicitAnalogTargetValue(r.targetValue)
      ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(r.targetValue)))
      : RULE_TARGET_VALUE_BOOLEAN;
    const actionState = hasAnalogTarget ? targetValue > 0 : Boolean(r.actionState);
    const actionType = (r.actionType ?? 0) & 0x03;
    const triggerMode = (r.triggerMode ?? 0) & 0x01;
    const flags = (actionState ? 0x01 : 0x00) | (actionType << 1) | (triggerMode << 3);

    view.setUint16(offset + 0, minVal, true);
    view.setUint16(offset + 2, maxVal, true);
    view.setUint16(offset + 4, hysteresis, true);
    view.setInt8(offset + 6, targetPin);
    buf[offset + 7] = flags;
    buf[offset + 8] = Math.min(60, Math.max(0, Math.round(r.delay ?? 0)));
    view.setInt16(offset + 9, targetValue, true);
    buf[offset + 11] = 0;
    offset += ANALOG_RANGE_RECORD_SIZE;
  }

  return buf;
};

export const buildUpdateAnalogRangeRulesFrame = encodeUpdateAnalogRangeRulesFrame;

/**
 * Encodes Opcode `0x13` (`UPDATE_ANALOG_RANGE_RULES_CONDITIONAL`) Little-Endian binary frame:
 * Header: `[0x13][inputPin:u8][rangeCount:u8]` + variable-length 12B record + `condCount * 6B`.
 */
export const encodeUpdateAnalogRangeRulesConditionalFrame = (
  inputPin: number,
  ranges: readonly AnalogRangeRuleFrameInput[] = [],
  segments?: readonly Pick<Segment, "pin" | "type" | "adcResolution" | "pwmResolution">[],
): Uint8Array => {
  if (!isValidManagedPin(inputPin)) {
    throw new RangeError(`Invalid input pin (expected 0..127): ${inputPin}`);
  }

  const activeRanges = ranges
    .filter((r) => r.enabled !== false)
    .slice(0, MAX_ANALOG_RANGE_RULES)
    .map((r) => ({
      range: r,
      cond: encodeConditionListForWire(r.conditions, r.conditionLogic, segments),
    }));

  const totalSize = activeRanges.reduce(
    (sum, entry) => sum + ANALOG_RANGE_RECORD_SIZE + entry.cond.items.length * RULE_CONDITION_SIZE,
    ANALOG_RANGE_HEADER_SIZE,
  );

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);
  buf[0] = MQTT_OPCODES.UPDATE_ANALOG_RANGE_RULES_CONDITIONAL;
  buf[1] = inputPin & 0xff;
  buf[2] = activeRanges.length & 0xff;

  let offset = ANALOG_RANGE_HEADER_SIZE;
  for (let i = 0; i < activeRanges.length; i++) {
    const { range: r, cond } = activeRanges[i];
    const minVal = Math.max(
      0,
      Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.round(Math.min(r.minValue, r.maxValue))),
    );
    const maxVal = Math.max(
      0,
      Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.round(Math.max(r.minValue, r.maxValue))),
    );
    const hysteresis = Math.max(0, Math.min(2047, Math.round(r.hysteresis ?? 0)));
    const parsedTargetPin =
      typeof r.targetPin === "number"
        ? r.targetPin
        : Number.parseInt(String(r.targetPin).trim(), 10);
    const targetPin = Number.isInteger(parsedTargetPin) ? parsedTargetPin : -1;
    const hasAnalogTarget = hasExplicitAnalogTargetValue(r.targetValue);
    const targetValue = hasExplicitAnalogTargetValue(r.targetValue)
      ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(r.targetValue)))
      : RULE_TARGET_VALUE_BOOLEAN;
    const actionState = hasAnalogTarget ? targetValue > 0 : Boolean(r.actionState);
    const actionType = (r.actionType ?? 0) & 0x03;
    const triggerMode = (r.triggerMode ?? 0) & 0x01;
    const flags = (actionState ? 0x01 : 0x00) | (actionType << 1) | (triggerMode << 3);

    view.setUint16(offset + 0, minVal, true);
    view.setUint16(offset + 2, maxVal, true);
    view.setUint16(offset + 4, hysteresis, true);
    view.setInt8(offset + 6, targetPin);
    buf[offset + 7] = flags;
    buf[offset + 8] = Math.min(60, Math.max(0, Math.round(r.delay ?? 0)));
    view.setInt16(offset + 9, targetValue, true);
    buf[offset + 11] = cond.metaByte;
    offset += ANALOG_RANGE_RECORD_SIZE;

    for (let c = 0; c < cond.items.length; c++) {
      const item = cond.items[c];
      buf[offset++] = item.sourcePin & 0xff;
      buf[offset++] = item.opCode & 0xff;
      view.setUint16(offset, item.value, true);
      offset += 2;
      view.setUint16(offset, item.maxValue, true);
      offset += 2;
    }
  }

  return buf;
};

export const publishUpdateAnalogRangeRulesCommand = (
  inputPin: number,
  ranges: readonly AnalogRangeRuleFrameInput[] = [],
  segments?: readonly Pick<Segment, "pin" | "type" | "adcResolution" | "pwmResolution">[],
): boolean => {
  const usesConditional = ranges.some(
    (r) => r.enabled !== false && hasEnabledGuardConditions(r.conditions),
  );

  const buf = usesConditional
    ? encodeUpdateAnalogRangeRulesConditionalFrame(inputPin, ranges, segments)
    : encodeUpdateAnalogRangeRulesFrame(inputPin, ranges);

  return publishMqttCommand(
    buf,
    `Published ${usesConditional ? "update_analog_range_rules_conditional(0x13)" : "update_analog_range_rules(0x0E)"}: input_pin=${inputPin} count=${buf[2]} size=${buf.length}b`,
  );
};
