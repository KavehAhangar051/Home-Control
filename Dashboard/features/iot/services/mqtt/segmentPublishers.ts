import {
  type AnalogInputSegmentOptions,
  clampAdcResolution,
  isAnalogInputType,
  normalizeAnalogInputConfig,
} from "@/features/iot/utils/analogInput";
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
  ANALOG_INPUT_CONFIG_BASE_SIZE,
  ANALOG_INPUT_CONFIG_WITH_RES_SIZE,
  ANALOG_INPUT_SEGMENT_EXT_SIZE,
  ANALOG_SEGMENT_EXT_SIZE,
  MAX_RULE_ACTIONS_PER_SIDE,
  MQTT_OPCODES,
  PIN_STATE_HIGH,
  PIN_STATE_LOW,
  READ_ANALOG_INPUT_BUFFER_SIZE,
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
  analogInputOptions?: AnalogInputSegmentOptions,
): Uint8Array => {
  const idBytes = textEncoder.encode(id);
  const typeBytes = textEncoder.encode(type);
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
  buf[2] =
    isAnalogOutput || isAnalogInput ? PIN_STATE_LOW : value ? PIN_STATE_HIGH : PIN_STATE_LOW;

  let offset = 3;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = 0;
  buf.set(typeBytes, offset);
  offset += typeBytes.length;
  buf[offset++] = 0;

  if (isAnalogOutput) {
    const view = new DataView(buf.buffer);
    const resolution = clampPwmResolution(analogOptions?.pwmResolution);
    const frequency = clampPwmFrequency(analogOptions?.pwmFrequency);
    const initialValue = clampAnalogValue(analogOptions?.initialValue ?? 0, resolution);

    buf[offset++] = resolution;
    view.setUint16(offset, frequency, true);
    offset += 2;
    view.setUint16(offset, initialValue, true);
  } else if (isAnalogInput) {
    const view = new DataView(buf.buffer);
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
