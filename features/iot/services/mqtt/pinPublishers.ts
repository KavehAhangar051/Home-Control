import { MAX_ANALOG_OUTPUT_VALUE } from "@/features/iot/utils/analogOutput";
import { getIoTStoreSnapshot } from "../storeBridge";
import { publishMqttCommand } from "./client";
import {
  ANALOG_COMMAND_BUFFER_SIZE,
  BATCH_ACTION_SIZE,
  BATCH_HEADER_SIZE,
  DEFAULT_TIMER_DISABLED,
  MAX_BATCH_ACTIONS,
  MQTT_OPCODES,
  PIN_COMMAND_BUFFER_SIZE,
  PIN_STATE_HIGH,
  PIN_STATE_LOW,
} from "./protocol";

const clearSynchronizedTimer = (pinId: string) => {
  const snapshot = getIoTStoreSnapshot();
  if (!snapshot.autoOffRemaining[pinId]) return;
  const next = { ...snapshot.autoOffRemaining, [pinId]: 0 };

  snapshot.setAutoOffRemaining(next);
};

export const buildPinCommandFrame = (pinId: string, value: boolean, timer?: number): Uint8Array => {
  const buf = new Uint8Array(PIN_COMMAND_BUFFER_SIZE);
  const view = new DataView(buf.buffer);
  buf[0] = MQTT_OPCODES.TOGGLE_PIN;
  buf[1] = (Number(pinId) | 0) & 0xff;
  buf[2] = value ? PIN_STATE_HIGH : PIN_STATE_LOW;
  view.setInt32(3, timer !== undefined ? timer : DEFAULT_TIMER_DISABLED, true);

  return buf;
};

export const publishPinCommand = (pinId: string, value: boolean, timer?: number): boolean => {
  const buf = buildPinCommandFrame(pinId, value, timer);
  const published = publishMqttCommand(
    buf,
    `Published toggle command: pin=${buf[1]} state=${value} timer=${timer}`,
  );

  if (published) clearSynchronizedTimer(pinId);
  return published;
};

/**
 * Builds the 8-byte Little-Endian Opcode `0x0A` (`SET_ANALOG_OUTPUT`) binary frame:
 * `[0x0A][pin:u8][value:u16LE (0..4095)][timerSeconds:i32LE (-1 = disabled)]`.
 */
export const buildAnalogOutputCommandFrame = (
  pinId: string,
  value: number,
  timer?: number,
): Uint8Array => {
  const buf = new Uint8Array(ANALOG_COMMAND_BUFFER_SIZE);
  const view = new DataView(buf.buffer);
  const clampedValue = Number.isFinite(value)
    ? Math.min(MAX_ANALOG_OUTPUT_VALUE, Math.max(0, Math.round(value)))
    : 0;

  buf[0] = MQTT_OPCODES.SET_ANALOG_OUTPUT;
  buf[1] = (Number(pinId) | 0) & 0xff;
  view.setUint16(2, clampedValue, true);
  view.setInt32(4, timer !== undefined ? timer : DEFAULT_TIMER_DISABLED, true);

  return buf;
};

export const publishAnalogOutputCommand = (
  pinId: string,
  value: number,
  timer?: number,
): boolean => {
  const buf = buildAnalogOutputCommandFrame(pinId, value, timer);
  const published = publishMqttCommand(
    buf,
    `Published analog_output command: pin=${buf[1]} value=${value} timer=${timer}`,
  );

  if (published) clearSynchronizedTimer(pinId);
  return published;
};

export const buildBatchPinCommandFrame = (
  actions: Array<{ pin: string; state: boolean; timer?: number }>,
): Uint8Array | null => {
  const actionsLen = actions.length;

  if (actionsLen === 0) return null;

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

  return buf;
};

export const publishBatchPinCommand = (
  actions: Array<{ pin: string; state: boolean; timer?: number }>,
): boolean => {
  const buf = buildBatchPinCommandFrame(actions);

  if (!buf) return false;

  const count = buf[1];
  const published = publishMqttCommand(buf, `Published batch toggle command with ${count} actions`);

  if (published) {
    for (const action of actions.slice(0, count)) clearSynchronizedTimer(action.pin);
  }

  return published;
};
