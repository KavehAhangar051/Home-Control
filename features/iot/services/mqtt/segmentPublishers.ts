import { publishMqttCommand } from "./client";
import { MQTT_OPCODES, PIN_STATE_HIGH, PIN_STATE_LOW, RULE_ACTION_SIZE } from "./protocol";

const textEncoder = new TextEncoder();

export interface RuleActionFrameInput {
  reqHold: number;
  targetPin: string;
  actionOn: boolean;
  actionType?: number;
  delay?: number;
}

export const buildAddSegmentFrame = (
  id: string,
  type: string,
  pin: number,
  value: boolean,
): Uint8Array => {
  const idBytes = textEncoder.encode(id);
  const typeBytes = textEncoder.encode(type);

  const buf = new Uint8Array(3 + idBytes.length + 1 + typeBytes.length + 1);
  buf[0] = MQTT_OPCODES.ADD_SEGMENT;
  buf[1] = pin;
  buf[2] = value ? PIN_STATE_HIGH : PIN_STATE_LOW;

  let offset = 3;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = 0;
  buf.set(typeBytes, offset);
  offset += typeBytes.length;
  buf[offset++] = 0;

  return buf;
};

export const publishAddSegmentCommand = (id: string, type: string, pin: number, value: boolean) => {
  const buf = buildAddSegmentFrame(id, type, pin, value);
  publishMqttCommand(buf, `Published add_segment: pin=${pin} id=${id}`);
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

export const buildUpdateRuleFrame = (
  id: string,
  highActions: RuleActionFrameInput[] = [],
  lowActions: RuleActionFrameInput[] = [],
): Uint8Array => {
  const idBytes = textEncoder.encode(id);
  const highLen = highActions.length;
  const lowLen = lowActions.length;

  const bufSize =
    1 + idBytes.length + 1 + 1 + highLen * RULE_ACTION_SIZE + 1 + lowLen * RULE_ACTION_SIZE;

  const buf = new Uint8Array(bufSize);
  const view = new DataView(buf.buffer);

  buf[0] = MQTT_OPCODES.UPDATE_RULE;
  let offset = 1;
  buf.set(idBytes, offset);
  offset += idBytes.length;
  buf[offset++] = 0;

  offset = writeRuleActionChunk(buf, view, offset, highActions);
  writeRuleActionChunk(buf, view, offset, lowActions);

  return buf;
};

export const publishUpdateRuleCommand = (
  id: string,
  highActions: RuleActionFrameInput[] = [],
  lowActions: RuleActionFrameInput[] = [],
) => {
  const buf = buildUpdateRuleFrame(id, highActions, lowActions);
  publishMqttCommand(buf, `Published update_rule: id=${id} size=${buf.length}b`);
};
