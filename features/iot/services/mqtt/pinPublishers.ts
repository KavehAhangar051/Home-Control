import { publishMqttCommand } from "./client";
import {
  BATCH_ACTION_SIZE,
  BATCH_HEADER_SIZE,
  DEFAULT_TIMER_DISABLED,
  MAX_BATCH_ACTIONS,
  MQTT_OPCODES,
  PIN_COMMAND_BUFFER_SIZE,
  PIN_STATE_HIGH,
  PIN_STATE_LOW,
} from "./protocol";

export const publishPinCommand = (pinId: string, value: boolean, timer?: number) => {
  const buf = new Uint8Array(PIN_COMMAND_BUFFER_SIZE);
  const view = new DataView(buf.buffer);
  buf[0] = MQTT_OPCODES.TOGGLE_PIN;
  buf[1] = (Number(pinId) | 0) & 0xff;
  buf[2] = value ? PIN_STATE_HIGH : PIN_STATE_LOW;
  view.setInt32(3, timer !== undefined ? timer : DEFAULT_TIMER_DISABLED, true);

  publishMqttCommand(buf, `Published toggle command: pin=${buf[1]} state=${value} timer=${timer}`);
};

export const publishBatchPinCommand = (
  actions: Array<{ pin: string; state: boolean; timer?: number }>,
) => {
  const actionsLen = actions.length;

  if (actionsLen === 0) return;

  const count = Math.min(actionsLen, MAX_BATCH_ACTIONS);
  const buf = new Uint8Array(BATCH_HEADER_SIZE + count * BATCH_ACTION_SIZE);
  const view = new DataView(buf.buffer);
  buf[0] = MQTT_OPCODES.BATCH_PINS;
  buf[1] = count;

  let offset = BATCH_HEADER_SIZE;

  for (let i = 0; i < count; i++) {
    const action = actions[i];
    buf[offset] = (Number(action.pin) | 0) & 0xff;
    buf[offset + 1] = action.state ? PIN_STATE_HIGH : PIN_STATE_LOW;
    view.setInt32(
      offset + 2,
      action.timer !== undefined ? action.timer : DEFAULT_TIMER_DISABLED,
      true,
    );
    offset += BATCH_ACTION_SIZE;
  }

  publishMqttCommand(buf, `Published batch toggle command with ${count} actions`);
};
