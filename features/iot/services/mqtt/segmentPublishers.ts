import {
  type AnalogSegmentOptions,
  clampAnalogValue,
  clampPwmFrequency,
  clampPwmResolution,
  hasExplicitAnalogTargetValue,
  isAnalogOutputType,
  MAX_ANALOG_OUTPUT_VALUE,
} from "@/features/iot/utils/analogOutput";
import { publishMqttCommand } from "./client";
import {
  ANALOG_SEGMENT_EXT_SIZE,
  MAX_RULE_ACTIONS_PER_SIDE,
  MQTT_OPCODES,
  PIN_STATE_HIGH,
  PIN_STATE_LOW,
  RULE_ACTION_SIZE,
  RULE_ANALOG_ACTION_SIZE,
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
}

export const buildAddSegmentFrame = (
  id: string,
  type: string,
  pin: number,
  value: boolean,
  analogOptions?: AnalogSegmentOptions,
): Uint8Array => {
  const idBytes = textEncoder.encode(id);
  const typeBytes = textEncoder.encode(type);
  const isAnalog = isAnalogOutputType(type);
  const baseSize = 3 + idBytes.length + 1 + typeBytes.length + 1;
  const buf = new Uint8Array(baseSize + (isAnalog ? ANALOG_SEGMENT_EXT_SIZE : 0));

  buf[0] = MQTT_OPCODES.ADD_SEGMENT;
  buf[1] = pin & 0xff;
  buf[2] = isAnalog ? PIN_STATE_LOW : value ? PIN_STATE_HIGH : PIN_STATE_LOW;

  let offset = 3;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = 0;
  buf.set(typeBytes, offset);
  offset += typeBytes.length;
  buf[offset++] = 0;

  if (isAnalog) {
    const view = new DataView(buf.buffer);
    const resolution = clampPwmResolution(analogOptions?.pwmResolution);
    const frequency = clampPwmFrequency(analogOptions?.pwmFrequency);
    const initialValue = clampAnalogValue(analogOptions?.initialValue ?? 0, resolution);

    buf[offset++] = resolution;
    view.setUint16(offset, frequency, true);
    offset += 2;
    view.setUint16(offset, initialValue, true);
  }

  return buf;
};

export const publishAddSegmentCommand = (
  id: string,
  type: string,
  pin: number,
  value: boolean,
  analogOptions?: AnalogSegmentOptions,
) => {
  const buf = buildAddSegmentFrame(id, type, pin, value, analogOptions);
  publishMqttCommand(buf, `Published add_segment: pin=${pin} id=${id} type=${type}`);
};

export const buildDeleteSegmentFrame = (id: string): Uint8Array => {
  const idBytes = textEncoder.encode(id);
  const buf = new Uint8Array(1 + idBytes.length + 1);
  buf[0] = MQTT_OPCODES.DELETE_SEGMENT;
  buf.set(idBytes, 1);
  buf[1 + idBytes.length] = 0;

  return buf;
};

export const publishDeleteSegmentCommand = (id: string) => {
  const buf = buildDeleteSegmentFrame(id);
  publishMqttCommand(buf, `Published delete_segment: id=${id}`);
};

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
    view.setInt32(offset, a.reqHold || 0, true);
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
    const clampedTargetValue = hasAnalog
      ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(a.targetValue)))
      : RULE_TARGET_VALUE_BOOLEAN;

    buf[offset++] = (Number(a.targetPin || -1) | 0) & 0xff;
    view.setInt32(offset, a.reqHold || 0, true);
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

  if (!Number.isInteger(inputPin) || inputPin < 0 || inputPin > 39) {
    throw new RangeError(`Invalid input GPIO: ${inputPin}`);
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
  if (!Number.isInteger(inputPin) || inputPin < 0 || inputPin > 39) {
    throw new RangeError(`Invalid input GPIO: ${inputPin}`);
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

export const publishUpdateRuleCommand = (
  inputPin: number,
  highActions: RuleActionFrameInput[] = [],
  lowActions: RuleActionFrameInput[] = [],
) => {
  const usesAnalogTargets =
    highActions.some((a) => hasExplicitAnalogTargetValue(a.targetValue)) ||
    lowActions.some((a) => hasExplicitAnalogTargetValue(a.targetValue));

  const buf = usesAnalogTargets
    ? buildUpdateRuleAnalogFrame(inputPin, highActions, lowActions)
    : buildUpdateRuleFrame(inputPin, highActions, lowActions);

  publishMqttCommand(
    buf,
    `Published ${usesAnalogTargets ? "update_rule_analog(0x0B)" : "update_rule(0x05)"}: input_gpio=${inputPin} size=${buf.length}b`,
  );
};
