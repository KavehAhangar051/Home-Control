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
  /** Update automation rule for a segment */
  UPDATE_RULE: 0x05,
  /** Batch update multiple pins in a single frame */
  BATCH_PINS: 0x08,
} as const;

/** Binary byte sizes for protocol framing */
export const PIN_COMMAND_BUFFER_SIZE = 7;
export const DEFAULT_TIMER_DISABLED = -1;
export const MAX_BATCH_ACTIONS = 255;
export const BATCH_HEADER_SIZE = 2;
export const BATCH_ACTION_SIZE = 6;
export const RULE_ACTION_SIZE = 11;

/** Binary state encodings */
export const PIN_STATE_HIGH = 0x01;
export const PIN_STATE_LOW = 0x00;
