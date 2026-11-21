/**
 * Pure TypeScript replica of the Achaemenid ESP32 IoT Firmware data structures,
 * binary MQTT command protocol (0x01-0x09), RuleEngine hold-time & action evaluator,
 * and NVS stack telemetry.
 */

export const MAX_SEGMENTS = 16;

export enum RuleActionType {
  ACTION_IMMEDIATE = 0,
  ACTION_AFTER_DELAY = 1,
  ACTION_FOR_DURATION = 2,
}

export interface RuleAction {
  requiredHoldTime: 0 | 3 | 5 | 10; // in seconds
  targetPin: number; // 0..39
  delay: number; // 0..60 seconds
  actionType: RuleActionType;
  actionState: boolean; // true = HIGH/ON, false = LOW/OFF
}

export interface RuleConfig {
  highActions: RuleAction[];
  lowActions: RuleAction[];
  active: boolean;
}

export interface SegmentConfig {
  id: string;
  type: 'output' | 'input';
  pin: number;
  value: boolean; // false = OFF/LOW, true = ON/HIGH
  autoOffDelay: number; // in seconds, 0 = disabled
  remainingTimerSec?: number; // countdown if active
  holdDurationSec?: number; // for input pins
  rule: RuleConfig;
}

export interface MqttConfig {
  host: string;
  port: number;
  baseTopic: string;
  qos: 0 | 1 | 2;
  valid: boolean;
}

export interface WifiNetworkConfig {
  ssid: string;
  password: string;
  valid: boolean;
}

export interface SerialLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SYS';
  source: string;
  message: string;
}

export interface DecodedMqttCommand {
  valid: boolean;
  opcodeHex: string;
  commandName: string;
  summary: string;
  error?: string;
  eventType?:
    | 'TOGGLE_PIN'
    | 'ADD_SEGMENT'
    | 'DELETE_SEGMENT'
    | 'DASHBOARD_PRESENCE'
    | 'UPDATE_RULE'
    | 'AUTOMATION_TOGGLE'
    | 'BATCH_TOGGLE'
    | 'SYNC_STATE';
  payloadData?: {
    pin?: number;
    state?: boolean;
    timer?: number;
    id?: string;
    segmentType?: 'output' | 'input';
    isOnline?: boolean;
    rule?: RuleConfig;
    batch?: Array<{ pin: number; state: boolean; timer: number }>;
  };
}

export const INITIAL_SEGMENTS: SegmentConfig[] = [
  {
    id: 'iszmn6e',
    type: 'output',
    pin: 2,
    value: false,
    autoOffDelay: 0,
    rule: { highActions: [], lowActions: [], active: false },
  },
  {
    id: 'ocpa1hl',
    type: 'output',
    pin: 14,
    value: false,
    autoOffDelay: 0,
    rule: { highActions: [], lowActions: [], active: false },
  },
  {
    id: '7xhkvz2',
    type: 'output',
    pin: 4,
    value: false,
    autoOffDelay: 0,
    rule: { highActions: [], lowActions: [], active: false },
  },
  {
    id: '48ef3dw',
    type: 'input',
    pin: 5,
    value: true,
    autoOffDelay: 0,
    holdDurationSec: 0,
    rule: {
      active: true,
      highActions: [
        {
          requiredHoldTime: 0,
          targetPin: 2,
          actionState: true,
          actionType: RuleActionType.ACTION_IMMEDIATE,
          delay: 0,
        },
        {
          requiredHoldTime: 3,
          targetPin: 14,
          actionState: true,
          actionType: RuleActionType.ACTION_FOR_DURATION,
          delay: 10,
        },
      ],
      lowActions: [
        {
          requiredHoldTime: 0,
          targetPin: 2,
          actionState: false,
          actionType: RuleActionType.ACTION_IMMEDIATE,
          delay: 0,
        },
      ],
    },
  },
  {
    id: 'y0stih7',
    type: 'input',
    pin: 19,
    value: true,
    autoOffDelay: 0,
    holdDurationSec: 0,
    rule: {
      active: true,
      highActions: [
        {
          requiredHoldTime: 5,
          targetPin: 4,
          actionState: true,
          actionType: RuleActionType.ACTION_AFTER_DELAY,
          delay: 5,
        },
      ],
      lowActions: [
        {
          requiredHoldTime: 0,
          targetPin: 4,
          actionState: false,
          actionType: RuleActionType.ACTION_IMMEDIATE,
          delay: 0,
        },
      ],
    },
  },
];

export const INITIAL_SERIAL_LOGS: SerialLogEntry[] = [
  {
    id: 'log-1',
    timestamp: '00:00.012',
    level: 'SYS',
    source: 'Hardware/src/main.cpp:21',
    message: 'getArduinoLoopTaskStackSize() override active: 16384 bytes (16KB headroom)',
  },
  {
    id: 'log-2',
    timestamp: '00:00.033',
    level: 'INFO',
    source: 'Hardware/src/main.cpp:39',
    message: '[System] Hardware timer started at 1ms resolution.',
  },
  {
    id: 'log-3',
    timestamp: '00:00.116',
    level: 'INFO',
    source: 'Hardware/src/setup/NetworkStorage.cpp:132',
    message: "[NetworkStorage] Stored MQTT Config - Host: 'broker.emqx.io', Port: 1883, Topic: 'KamyarIoT/Achaemenid', QOS: 1",
  },
  {
    id: 'log-4',
    timestamp: '00:00.221',
    level: 'INFO',
    source: 'Hardware/lib/AchaemenidBootManager/src/BootManager.cpp:221',
    message: '[Boot] Booting up... Loading config from NVS in isolated __attribute__((noinline)) stack frame.',
  },
  {
    id: 'log-5',
    timestamp: '00:00.245',
    level: 'INFO',
    source: 'Hardware/lib/ConfigApplier/ConfigApplier.cpp:36',
    message: '[ConfigApplier] Applied 5 GPIO segments from NVS (iszmn6e, ocpa1hl, 7xhkvz2, 48ef3dw, y0stih7).',
  },
  {
    id: 'log-6',
    timestamp: '00:00.290',
    level: 'INFO',
    source: 'Hardware/src/events/EventHandlers.cpp:148',
    message: '[Event] Config loaded with 5 pins. Stack frame reclaimed (4,512B freed before esp_wifi_init).',
  },
  {
    id: 'log-7',
    timestamp: '00:00.410',
    level: 'INFO',
    source: 'Hardware/lib/AchaemenidBootManager/src/BootManager.cpp:40',
    message: '[Boot] WiFi connected. Starting/restarting MQTT and WebSocket services.',
  },
];

/**
 * Helper to write little-endian int32 into byte array
 */
export function writeInt32LE(value: number): number[] {
  const v = value | 0;
  return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
}

/**
 * Helper to read little-endian int32 from Uint8Array
 */
export function readInt32LE(buf: Uint8Array, offset: number): number {
  return (
    buf[offset] |
    (buf[offset + 1] << 8) |
    (buf[offset + 2] << 16) |
    (buf[offset + 3] << 24)
  );
}

/**
 * Converts a byte array or Uint8Array to space-separated uppercase hex string
 */
export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => (b & 0xff).toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/**
 * Parses a hex string (with spaces, 0x prefixes, or continuous hex) into Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array | null {
  const cleaned = hex
    .replace(/0x/gi, '')
    .replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length === 0 || cleaned.length % 2 !== 0) {
    return null;
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    out[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }
  return out;
}

/**
 * Encodes a 0x01 Binary Toggle Pin MQTT frame:
 * [0x01, pinNum, state (0x01/0x00), timer_int32_le (4 bytes)] -> 7 bytes
 */
export function encodeTogglePinFrame(pin: number, state: boolean, timerSec: number): Uint8Array {
  const timerBytes = writeInt32LE(timerSec);
  return new Uint8Array([0x01, pin & 0xff, state ? 0x01 : 0x00, ...timerBytes]);
}

/**
 * Encodes a 0x02 Binary Add Segment MQTT frame:
 * [0x02, pinNum, 0x00, ...idStr\0, ...typeStr\0]
 */
export function encodeAddSegmentFrame(pin: number, id: string, type: 'output' | 'input'): Uint8Array {
  const encoder = new TextEncoder();
  const idBytes = encoder.encode(id.slice(0, 31));
  const typeBytes = encoder.encode(type);
  return new Uint8Array([
    0x02,
    pin & 0xff,
    0x00,
    ...idBytes,
    0x00,
    ...typeBytes,
    0x00,
  ]);
}

/**
 * Encodes a 0x03 Binary Delete Segment MQTT frame:
 * Legacy:      [0x03, ...idStr\0]
 * Extended v2: [0x03, ...idStr\0, pinNum] (optional trailing GPIO 0..39 fallback)
 */
export function encodeDeleteSegmentFrame(id: string, pin?: number): Uint8Array {
  const encoder = new TextEncoder();
  const idBytes = encoder.encode(id.slice(0, 31));
  const hasValidPin =
    typeof pin === 'number' && Number.isInteger(pin) && pin >= 0 && pin <= 39;
  if (hasValidPin) {
    return new Uint8Array([0x03, ...idBytes, 0x00, pin & 0xff]);
  }
  return new Uint8Array([0x03, ...idBytes, 0x00]);
}

/**
 * Mirrors PinManager::extractPinFromCanonicalId(id) for deterministic pin-based IDs
 * ("gpio_<N>", "pin_<N>", or pure numeric "<N>" with 0 <= N <= 39).
 */
export function extractPinFromCanonicalId(id: string): number | null {
  const match = /^(?:(?:gpio|pin)_)?(\d{1,2})$/i.exec(id);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 39 ? parsed : null;
}

/**
 * Mirrors PinManager::upsertSegment: replaces an existing segment on the same GPIO pin
 * (or moves an existing segment with the same ID) instead of silently failing.
 */
export function upsertSimulatorSegment(
  segments: SegmentConfig[],
  pin: number,
  id: string,
  type: 'output' | 'input'
): { segments: SegmentConfig[]; replacedId?: string } {
  if (!id || !Number.isInteger(pin) || pin < 0 || pin > 39) {
    return { segments };
  }
  const existingOnPin = segments.find((s) => s.pin === pin);
  const filtered = segments.filter((s) => s.pin !== pin && s.id !== id);
  if (filtered.length >= MAX_SEGMENTS) {
    return { segments };
  }
  const newSeg: SegmentConfig = {
    id,
    type,
    pin,
    value: false,
    autoOffDelay: 0,
    rule: { highActions: [], lowActions: [], active: false },
  };
  return {
    segments: [...filtered, newSeg],
    replacedId: existingOnPin?.id,
  };
}

/**
 * Mirrors PinManager::removeSegmentByIdOrPin: tries exact ID first, then explicit
 * fallbackPin (0..39), then canonical pin-based ID fallback.
 */
export function deleteSimulatorSegment(
  segments: SegmentConfig[],
  id: string,
  fallbackPin?: number
): {
  segments: SegmentConfig[];
  removed?: SegmentConfig;
  resolvedBy: 'id' | 'fallback_pin' | 'canonical_id' | 'none';
} {
  if (id) {
    const byId = segments.find((s) => s.id === id);
    if (byId) {
      return {
        segments: segments.filter((s) => s !== byId),
        removed: byId,
        resolvedBy: 'id',
      };
    }
  }

  if (
    typeof fallbackPin === 'number' &&
    Number.isInteger(fallbackPin) &&
    fallbackPin >= 0 &&
    fallbackPin <= 39
  ) {
    const byPin = segments.find((s) => s.pin === fallbackPin);
    if (byPin) {
      return {
        segments: segments.filter((s) => s !== byPin),
        removed: byPin,
        resolvedBy: 'fallback_pin',
      };
    }
  } else if (id) {
    const canonicalPin = extractPinFromCanonicalId(id);
    if (canonicalPin !== null) {
      const byCanonicalPin = segments.find((s) => s.pin === canonicalPin);
      if (byCanonicalPin) {
        return {
          segments: segments.filter((s) => s !== byCanonicalPin),
          removed: byCanonicalPin,
          resolvedBy: 'canonical_id',
        };
      }
    }
  }

  return { segments, resolvedBy: 'none' };
}

/**
 * Encodes a 0x04 Dashboard Presence MQTT frame:
 * [0x04, isOnline ? 0x01 : 0x00]
 */
export function encodePresenceFrame(isOnline: boolean): Uint8Array {
  return new Uint8Array([0x04, isOnline ? 0x01 : 0x00]);
}

/**
 * Encodes a 0x05 Update Rule MQTT frame matching RuleParsers.cpp:
 * [0x05, inputPin, highCount, ...highActions(11B each), lowCount, ...lowActions(11B each)]
 * Each 11-byte action:
 *   offset+0: targetPin (int8)
 *   offset+1..4: holdTime (int32 LE)
 *   offset+5: actionState (0x01 or 0x00)
 *   offset+6: actionType (0..2)
 *   offset+7..10: delay (int32 LE)
 */
export function encodeUpdateRuleFrame(inputPin: number, rule: RuleConfig): Uint8Array {
  const bytes: number[] = [0x05, inputPin & 0xff];
  const highList = rule.highActions.slice(0, 4);
  bytes.push(highList.length);
  for (const act of highList) {
    bytes.push(act.targetPin & 0xff);
    bytes.push(...writeInt32LE(act.requiredHoldTime));
    bytes.push(act.actionState ? 0x01 : 0x00);
    bytes.push(act.actionType & 0xff);
    bytes.push(...writeInt32LE(act.delay));
  }
  const lowList = rule.lowActions.slice(0, 4);
  bytes.push(lowList.length);
  for (const act of lowList) {
    bytes.push(act.targetPin & 0xff);
    bytes.push(...writeInt32LE(act.requiredHoldTime));
    bytes.push(act.actionState ? 0x01 : 0x00);
    bytes.push(act.actionType & 0xff);
    bytes.push(...writeInt32LE(act.delay));
  }
  return new Uint8Array(bytes);
}

/**
 * Encodes a 0x09 State Sync Request MQTT frame
 */
export function encodeSyncStateFrame(): Uint8Array {
  return new Uint8Array([0x09]);
}

function readNullTerminatedString(
  payload: Uint8Array,
  startOffset: number,
  maxCapacity = 32
): { value: string; nextOffset: number } {
  let offset = startOffset;
  const chars: number[] = [];
  while (offset < payload.length && payload[offset] !== 0x00 && chars.length < maxCapacity) {
    chars.push(payload[offset++]);
  }
  while (offset < payload.length && payload[offset] !== 0x00) {
    offset++;
  }
  if (offset < payload.length) {
    offset++; // skip null terminator
  }
  return {
    value: String.fromCharCode(...chars),
    nextOffset: offset,
  };
}

function isValidHoldTime(value: number): value is 0 | 3 | 5 | 10 {
  return value === 0 || value === 3 || value === 5 || value === 10;
}

/**
 * Decodes any binary MQTT payload according to MqttCommandDispatcher.cpp,
 * StateParsers.cpp, SegmentParsers.cpp, and RuleParsers.cpp.
 */
export function decodeMqttBinaryFrame(payload: Uint8Array): DecodedMqttCommand {
  if (!payload || payload.length === 0) {
    return {
      valid: false,
      opcodeHex: 'NONE',
      commandName: 'EMPTY_PAYLOAD',
      summary: 'Empty MQTT frame ignored',
      error: 'Payload is empty (0 bytes)',
    };
  }

  const cmdType = payload[0];
  const opcodeHex = '0x' + cmdType.toString(16).padStart(2, '0').toUpperCase();

  if (cmdType === 0x7b) {
    // '{'
    return {
      valid: false,
      opcodeHex,
      commandName: 'LEGACY_JSON_REJECTED',
      summary: '[MQTT Handler] Legacy JSON is no longer supported to save memory. Ignoring.',
      error: 'Legacy JSON payload starts with "{". Use binary protocol.',
    };
  }

  switch (cmdType) {
    case 0x01: {
      if (payload.length < 7) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'TOGGLE_PIN (0x01)',
          summary: 'Malformed 0x01 frame (requires 7 bytes)',
          error: `Expected at least 7 bytes, got ${payload.length}`,
        };
      }
      const pin = payload[1];
      const state = payload[2] === 0x01;
      const timer = readInt32LE(payload, 3);
      return {
        valid: true,
        opcodeHex,
        commandName: 'TOGGLE_PIN (0x01)',
        summary: `[MQTT Handler] Binary Toggle: pin=${pin} state=${state ? 'ON' : 'OFF'} timer=${timer}s`,
        eventType: 'TOGGLE_PIN',
        payloadData: { pin, state, timer },
      };
    }

    case 0x02: {
      if (payload.length < 6) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'ADD_SEGMENT (0x02)',
          summary: 'Malformed 0x02 frame (requires >= 6 bytes)',
          error: `Expected at least 6 bytes, got ${payload.length}`,
        };
      }
      const pin = payload[1];
      const idRes = readNullTerminatedString(payload, 3, 32);
      const typeRes = readNullTerminatedString(payload, idRes.nextOffset, 16);
      const segType: 'output' | 'input' = typeRes.value === 'input' ? 'input' : 'output';
      if (!idRes.value) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'ADD_SEGMENT (0x02)',
          summary: 'Rejected ADD_SEGMENT: empty segment ID',
          error: 'Segment ID cannot be empty',
        };
      }
      return {
        valid: true,
        opcodeHex,
        commandName: 'ADD_SEGMENT (0x02)',
        summary: `[MQTT Handler] Binary Add: id=${idRes.value} pin=${pin} type=${segType}`,
        eventType: 'ADD_SEGMENT',
        payloadData: { pin, id: idRes.value, segmentType: segType },
      };
    }

    case 0x03: {
      if (payload.length < 2) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'DELETE_SEGMENT (0x03)',
          summary: 'Malformed 0x03 frame',
          error: 'Expected at least 2 bytes',
        };
      }
      const idRes = readNullTerminatedString(payload, 1, 32);
      let fallbackPin: number | undefined;
      if (idRes.nextOffset < payload.length) {
        const rawPin = payload[idRes.nextOffset];
        if (rawPin <= 39) {
          fallbackPin = rawPin;
        }
      }
      if (!idRes.value && fallbackPin === undefined) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'DELETE_SEGMENT (0x03)',
          summary: '[MQTT Handler] Rejected DELETE_SEGMENT (0x03): empty ID and no valid fallback pin',
          error: 'Empty ID and no valid fallback pin (0..39)',
        };
      }
      return {
        valid: true,
        opcodeHex,
        commandName: 'DELETE_SEGMENT (0x03)',
        summary:
          fallbackPin !== undefined
            ? `[MQTT Handler] Binary Delete: id=${idRes.value} pin=${fallbackPin}`
            : `[MQTT Handler] Binary Delete: id=${idRes.value}`,
        eventType: 'DELETE_SEGMENT',
        payloadData:
          fallbackPin !== undefined
            ? { id: idRes.value, pin: fallbackPin }
            : { id: idRes.value },
      };
    }

    case 0x04: {
      if (payload.length < 2) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'DASHBOARD_PRESENCE (0x04)',
          summary: 'Malformed 0x04 frame',
          error: 'Expected at least 2 bytes',
        };
      }
      const isOnline = payload[1] === 0x01;
      return {
        valid: true,
        opcodeHex,
        commandName: 'DASHBOARD_PRESENCE (0x04)',
        summary: `[MQTT Handler] Binary Presence: ${isOnline ? 'online' : 'offline'}`,
        eventType: 'DASHBOARD_PRESENCE',
        payloadData: { isOnline },
      };
    }

    case 0x05: {
      if (payload.length < 4) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'UPDATE_RULE (0x05)',
          summary: 'Malformed 0x05 frame',
          error: 'Frame shorter than 4 bytes minimum',
        };
      }
      let offset = 1;
      const inputPin = payload[offset++];
      if (inputPin > 39) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'UPDATE_RULE (0x05)',
          summary: `[MQTT Handler] Rejected UPDATE_RULE: invalid input GPIO ${inputPin}`,
          error: `Invalid input GPIO ${inputPin} (must be 0..39)`,
        };
      }
      const highCount = payload[offset++];
      if (highCount > 4) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'UPDATE_RULE (0x05)',
          summary: '[MQTT Handler] Rejected UPDATE_RULE: too many HIGH actions',
          error: `highCount=${highCount} exceeds max 4`,
        };
      }
      const highActions: RuleAction[] = [];
      for (let i = 0; i < highCount; i++) {
        if (offset + 11 > payload.length) {
          return {
            valid: false,
            opcodeHex,
            commandName: 'UPDATE_RULE (0x05)',
            summary: '[MQTT Handler] Rejected UPDATE_RULE: truncated HIGH action',
            error: 'Truncated HIGH action (11 bytes required per action)',
          };
        }
        const targetPin = payload[offset];
        const holdTime = readInt32LE(payload, offset + 1);
        const actionState = payload[offset + 5] === 0x01;
        const actionType = payload[offset + 6];
        const delay = readInt32LE(payload, offset + 7);
        offset += 11;

        if (
          targetPin < 0 ||
          targetPin > 39 ||
          !isValidHoldTime(holdTime) ||
          actionType > RuleActionType.ACTION_FOR_DURATION ||
          delay < 0 ||
          delay > 60
        ) {
          return {
            valid: false,
            opcodeHex,
            commandName: 'UPDATE_RULE (0x05)',
            summary: '[MQTT Handler] Rejected UPDATE_RULE: invalid HIGH action parameters',
            error: 'Invalid targetPin, holdTime (0/3/5/10), actionType (0..2), or delay (0..60)',
          };
        }
        highActions.push({
          targetPin,
          requiredHoldTime: holdTime,
          actionState,
          actionType: actionType as RuleActionType,
          delay,
        });
      }

      if (offset >= payload.length) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'UPDATE_RULE (0x05)',
          summary: '[MQTT Handler] Rejected UPDATE_RULE: missing LOW action count',
          error: 'Missing LOW action count byte',
        };
      }
      const lowCount = payload[offset++];
      if (lowCount > 4) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'UPDATE_RULE (0x05)',
          summary: '[MQTT Handler] Rejected UPDATE_RULE: too many LOW actions',
          error: `lowCount=${lowCount} exceeds max 4`,
        };
      }
      const lowActions: RuleAction[] = [];
      for (let i = 0; i < lowCount; i++) {
        if (offset + 11 > payload.length) {
          return {
            valid: false,
            opcodeHex,
            commandName: 'UPDATE_RULE (0x05)',
            summary: '[MQTT Handler] Rejected UPDATE_RULE: truncated LOW action',
            error: 'Truncated LOW action (11 bytes required per action)',
          };
        }
        const targetPin = payload[offset];
        const holdTime = readInt32LE(payload, offset + 1);
        const actionState = payload[offset + 5] === 0x01;
        const actionType = payload[offset + 6];
        const delay = readInt32LE(payload, offset + 7);
        offset += 11;

        if (
          targetPin < 0 ||
          targetPin > 39 ||
          !isValidHoldTime(holdTime) ||
          actionType > RuleActionType.ACTION_FOR_DURATION ||
          delay < 0 ||
          delay > 60
        ) {
          return {
            valid: false,
            opcodeHex,
            commandName: 'UPDATE_RULE (0x05)',
            summary: '[MQTT Handler] Rejected UPDATE_RULE: invalid LOW action parameters',
            error: 'Invalid targetPin, holdTime (0/3/5/10), actionType (0..2), or delay (0..60)',
          };
        }
        lowActions.push({
          targetPin,
          requiredHoldTime: holdTime,
          actionState,
          actionType: actionType as RuleActionType,
          delay,
        });
      }

      if (offset !== payload.length) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'UPDATE_RULE (0x05)',
          summary: '[MQTT Handler] Rejected UPDATE_RULE: unexpected trailing bytes',
          error: `Unexpected trailing bytes (${payload.length - offset} extra)`,
        };
      }

      const active = highActions.length > 0 || lowActions.length > 0;
      return {
        valid: true,
        opcodeHex,
        commandName: 'UPDATE_RULE (0x05)',
        summary: `[MQTT Handler] Binary Update Rule: input_gpio=${inputPin} high=${highActions.length} low=${lowActions.length} active=${active ? 1 : 0}`,
        eventType: 'UPDATE_RULE',
        payloadData: {
          pin: inputPin,
          rule: { highActions, lowActions, active },
        },
      };
    }

    case 0x06: {
      if (payload.length < 3) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'AUTOMATION_TOGGLE (0x06)',
          summary: 'Malformed 0x06 frame',
          error: 'Expected at least 3 bytes',
        };
      }
      const pin = payload[1];
      const state = payload[2] === 0x01;
      return {
        valid: true,
        opcodeHex,
        commandName: 'AUTOMATION_TOGGLE (0x06)',
        summary: `[MQTT Handler] Automation Triggered! Binary Toggle: pin=${pin} state=${state ? 'ON' : 'OFF'}`,
        eventType: 'AUTOMATION_TOGGLE',
        payloadData: { pin, state, timer: 0 },
      };
    }

    case 0x08: {
      if (payload.length < 2) {
        return {
          valid: false,
          opcodeHex,
          commandName: 'BATCH_TOGGLE (0x08)',
          summary: 'Malformed 0x08 frame',
          error: 'Expected at least 2 bytes',
        };
      }
      const count = payload[1];
      let offset = 2;
      const batch: Array<{ pin: number; state: boolean; timer: number }> = [];
      for (let i = 0; i < count && offset + 6 <= payload.length; i++) {
        const pin = payload[offset];
        const state = payload[offset + 1] === 0x01;
        const timer = readInt32LE(payload, offset + 2);
        batch.push({ pin, state, timer });
        offset += 6;
      }
      return {
        valid: true,
        opcodeHex,
        commandName: 'BATCH_TOGGLE (0x08)',
        summary: `[MQTT Handler] Batch Toggle: ${batch.length} pin operations dispatched`,
        eventType: 'BATCH_TOGGLE',
        payloadData: { batch },
      };
    }

    case 0x09: {
      return {
        valid: true,
        opcodeHex,
        commandName: 'SYNC_STATE (0x09)',
        summary: '[MQTT Handler] Received State Sync Request (0x09)',
        eventType: 'SYNC_STATE',
      };
    }

    default:
      return {
        valid: false,
        opcodeHex,
        commandName: `UNKNOWN_OPCODE (${opcodeHex})`,
        summary: `[MQTT Handler] Unknown binary command type or no handler found: ${opcodeHex}`,
        error: `No registered IMqttPayloadHandler for opcode ${opcodeHex}`,
      };
  }
}

/**
 * Evaluates RuleEngine input transition & hold time matching HoldTimeEvaluator and RuleEngine.cpp
 */
export interface TriggeredRuleEffect {
  targetPin: number;
  newState: boolean;
  actionType: RuleActionType;
  delaySec: number;
  requiredHoldTime: number;
  reason: string;
}

export function evaluateInputRuleTransition(
  sourcePin: number,
  newState: boolean,
  heldDurationSec: number,
  rule: RuleConfig
): TriggeredRuleEffect[] {
  if (!rule.active) return [];

  const effects: TriggeredRuleEffect[] = [];

  // Actions for the new state (e.g., HIGH actions when transitioning to HIGH)
  const activeGroup = newState ? rule.highActions : rule.lowActions;
  const stateLabel = newState ? 'HIGH' : 'LOW';

  for (const act of activeGroup) {
    if (act.requiredHoldTime <= heldDurationSec) {
      const modeLabel =
        act.actionType === RuleActionType.ACTION_IMMEDIATE
          ? 'Immediate'
          : act.actionType === RuleActionType.ACTION_AFTER_DELAY
            ? `After ${act.delay}s Delay`
            : `For ${act.delay}s Duration`;

      effects.push({
        targetPin: act.targetPin,
        newState: act.actionState,
        actionType: act.actionType,
        delaySec: act.delay,
        requiredHoldTime: act.requiredHoldTime,
        reason: `[RuleEngine] Input GPIO ${sourcePin} (${stateLabel}, held ${heldDurationSec}s >= ${act.requiredHoldTime}s) -> GPIO ${act.targetPin} ${act.actionState ? 'ON' : 'OFF'} (${modeLabel})`,
      });
    }
  }

  return effects;
}

/**
 * Calculates ESP32 loopTask stack usage with vs without the Achaemenid architecture refactor
 * (16KB loopTask override + __attribute__((noinline)) loadOfflineConfigFromNvs).
 */
export interface StackTelemetry {
  totalStackBytes: number;
  nvsParseResultBytes: number;
  wifiInitPeakBytes: number;
  fastFunctionSboBytes: number;
  peakConcurrentBytes: number;
  freeHeadroomBytes: number;
  canaryTriggered: boolean;
}

export function calculateStackTelemetry(options: {
  stackSize16KB: boolean;
  isolatedNvsFrame: boolean;
  activeSegmentCount: number;
}): StackTelemetry {
  const totalStackBytes = options.stackSize16KB ? 16384 : 8192;
  const nvsParseResultBytes = 4512; // ParseResult struct with 16 SegmentConfig + MqttConfig + 5 WifiNetworkConfig
  const wifiInitPeakBytes = 4280; // esp_wifi_init() + lwIP / FreeRTOS task stack pressure
  const fastFunctionSboBytes = 512 + options.activeSegmentCount * 48;

  // When isolatedNvsFrame is true (__attribute__((noinline))), nvsParseResultBytes is popped before wifiInitPeakBytes
  const peakConcurrentBytes = options.isolatedNvsFrame
    ? Math.max(nvsParseResultBytes, wifiInitPeakBytes) + fastFunctionSboBytes + 1024
    : nvsParseResultBytes + wifiInitPeakBytes + fastFunctionSboBytes + 1024;

  const freeHeadroomBytes = totalStackBytes - peakConcurrentBytes;
  const canaryTriggered = freeHeadroomBytes < 256;

  return {
    totalStackBytes,
    nvsParseResultBytes,
    wifiInitPeakBytes,
    fastFunctionSboBytes,
    peakConcurrentBytes,
    freeHeadroomBytes,
    canaryTriggered,
  };
}
