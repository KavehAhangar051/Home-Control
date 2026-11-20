/**
 * Binary protocol opcodes and constants for ESP32 MQTT communication.
 * These define the binary wire format expected by the hardware firmware.
 */

export const MQTT_OPCODES = {
  /** Single pin toggle/set command */
  TOGGLE_PIN: 0x01,
  /** Add a new segment configuration */
  ADD_SEGMENT: 0x02,
  /** Delete an existing segment */
  DELETE_SEGMENT: 0x03,
  /** Client presence ping */
  PRESENCE: 0x04,
  /** Update automation rule for a segment (11-byte boolean actions) */
  UPDATE_RULE: 0x05,
  /** Batch update multiple pins in a single frame */
  BATCH_PINS: 0x08,
  /** Set PWM duty cycle for an analog_output pin */
  SET_ANALOG_OUTPUT: 0x0a,
  /** Update automation rule with 13-byte analog targetValue actions */
  UPDATE_RULE_ANALOG: 0x0b,
  /** Live update ADC1 sampling, delta, Schmitt-Trigger thresholds, and optional resolution */
  UPDATE_ANALOG_INPUT_CONFIG: 0x0c,
  /** Force immediate ADC1 sensor readout bypassing sampleIntervalMs/deltaThreshold */
  READ_ANALOG_INPUT: 0x0d,
} as const;

/** Binary byte sizes for protocol framing */
export const PIN_COMMAND_BUFFER_SIZE = 7;
export const ANALOG_COMMAND_BUFFER_SIZE = 8;
export const ANALOG_SEGMENT_EXT_SIZE = 5;
export const ANALOG_INPUT_SEGMENT_EXT_SIZE = 9;
export const ANALOG_INPUT_CONFIG_BASE_SIZE = 10;
export const ANALOG_INPUT_CONFIG_WITH_RES_SIZE = 11;
export const READ_ANALOG_INPUT_BUFFER_SIZE = 2;
export const DEFAULT_TIMER_DISABLED = -1;
export const MAX_BATCH_ACTIONS = 255;
export const BATCH_HEADER_SIZE = 2;
export const BATCH_ACTION_SIZE = 6;
export const RULE_ACTION_SIZE = 11;
export const RULE_ANALOG_ACTION_SIZE = 13;
export const RULE_TARGET_VALUE_BOOLEAN = -1;
export const MAX_RULE_ACTIONS_PER_SIDE = 4;

/** Binary state encodings */
export const PIN_STATE_HIGH = 0x01;
export const PIN_STATE_LOW = 0x00;

/** Pre-allocated immutable binary frames to avoid per-ping TypedArray allocations */
export const PRESENCE_ONLINE_FRAME = new Uint8Array([MQTT_OPCODES.PRESENCE, PIN_STATE_HIGH]);
export const PRESENCE_OFFLINE_FRAME = new Uint8Array([MQTT_OPCODES.PRESENCE, PIN_STATE_LOW]);
export const SYNC_REQUEST_FRAME = new Uint8Array([0x09]);
