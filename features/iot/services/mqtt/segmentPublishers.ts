import { publishMqttCommand } from "./client";
import { MQTT_OPCODES, PIN_STATE_HIGH, PIN_STATE_LOW, RULE_ACTION_SIZE } from "./protocol";

const textEncoder = new TextEncoder();

export const publishAddSegmentCommand = (id: string, type: string, pin: number, value: boolean) => {
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

  publishMqttCommand(buf, `Published add_segment: pin=${pin} id=${id}`);
};

export const publishDeleteSegmentCommand = (id: string) => {
  const idBytes = textEncoder.encode(id);
  const buf = new Uint8Array(1 + idBytes.length + 1);
  buf[0] = MQTT_OPCODES.DELETE_SEGMENT;
  buf.set(idBytes, 1);
  buf[1 + idBytes.length] = 0;

  publishMqttCommand(buf, `Published delete_segment: id=${id}`);
};

export const publishUpdateRuleCommand = (
  id: string,
  highActions: Array<{
    reqHold: number;
    targetPin: string;
    actionOn: boolean;
    actionType?: number;
    delay?: number;
  }> = [],
  lowActions: Array<{
    reqHold: number;
    targetPin: string;
    actionOn: boolean;
    actionType?: number;
    delay?: number;
  }> = [],
) => {
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

  buf[offset++] = highLen;

  for (let i = 0; i < highLen; i++) {
    const a = highActions[i];
    buf[offset++] = (Number(a.targetPin || -1) | 0) & 0xff;
    view.setInt32(offset, a.reqHold || 0, true);
    offset += 4;
    buf[offset++] = a.actionOn ? 1 : 0;
    buf[offset++] = a.actionType || 0;
    view.setInt32(offset, a.delay || 0, true);
    offset += 4;
  }

  buf[offset++] = lowLen;

  for (let i = 0; i < lowLen; i++) {
    const a = lowActions[i];
    buf[offset++] = (Number(a.targetPin || -1) | 0) & 0xff;
    view.setInt32(offset, a.reqHold || 0, true);
    offset += 4;
    buf[offset++] = a.actionOn ? 1 : 0;
    buf[offset++] = a.actionType || 0;
    view.setInt32(offset, a.delay || 0, true);
    offset += 4;
  }

  publishMqttCommand(buf, `Published update_rule: id=${id} size=${bufSize}b`);
};
