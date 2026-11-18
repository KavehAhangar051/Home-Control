export type RawPinStateValue = boolean | number | string | null | undefined;

export interface MqttStateSyncPayload {
  type?: string;
  command?: string;
  id?: string | number;
  value?: RawPinStateValue;
  states?: Record<string, RawPinStateValue>;
  timers?: Record<string, RawPinStateValue>;
  pin?: string | number;
  state?: RawPinStateValue;
}

export type ParsedMqttStatusMessage =
  | { kind: "online"; ip?: string }
  | { kind: "offline" }
  | { kind: "ignored" }
  | { kind: "error"; error: unknown };

export type ParsedMqttStateMessage =
  | { kind: "pin_update"; pinId: string; state: boolean; source: "binary" | "json" }
  | { kind: "state_sync"; states: Record<string, boolean>; timers: Record<string, number> }
  | { kind: "ping" }
  | { kind: "ignored" }
  | { kind: "error"; error: unknown };

const textDecoder = new TextDecoder();

// Pre-computed pin string table for 0..255 to avoid per-packet .toString() allocations on binary 0x06 frames
const PIN_ID_STRINGS: readonly string[] = (() => {
  const table: string[] = [];

  for (let i = 0; i < 256; i++) {
    table.push(String(i));
  }

  return table;
})();

export function toBooleanPinState(value: RawPinStateValue): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function decodePayloadText(payload: Uint8Array): string {
  return textDecoder.decode(payload);
}

/**
 * Pure parser for ESP32 MQTT LWT/Status topic payloads (`offline`, `OFFLINE`, or JSON status).
 */
export function parseMqttStatusMessage(payload: Uint8Array): ParsedMqttStatusMessage {
  if (payload.length === 0) {
    return { kind: "ignored" };
  }

  const strPayload = decodePayloadText(payload).trim();

  if (strPayload === "offline" || strPayload === "OFFLINE") {
    return { kind: "offline" };
  }

  if (strPayload.charCodeAt(0) === 123) {
    try {
      // SAFETY: strPayload starts with '{' and every accessed property is validated below
      const data = JSON.parse(strPayload) as { status?: unknown; ip?: unknown };

      if (data.status === "online") {
        const ipText =
          Object.prototype.toString.call(data.ip) === "[object String]" ? String(data.ip) : "";

        return {
          kind: "online",
          ip: ipText.length > 0 ? ipText : undefined,
        };
      }

      if (data.status === "offline") {
        return { kind: "offline" };
      }
    } catch (error) {
      return { kind: "error", error };
    }
  }

  return { kind: "ignored" };
}

/**
 * Pure parser for ESP32 MQTT State topic payloads (binary `0x06` pin frame or JSON events).
 */
export function parseMqttStateMessage(payload: Uint8Array): ParsedMqttStateMessage {
  if (payload.length === 0) {
    return { kind: "ignored" };
  }

  try {
    const cmdType = payload[0];

    // Legacy binary 0x06 frames have no origin metadata and may be delayed
    // acknowledgements. Ignore them to prevent stale output states overwriting UI.
    if (cmdType === 123) {
      // SAFETY: cmdType === 123 ('{') guarantees JSON object text parsed with field guards below
      const data = JSON.parse(decodePayloadText(payload)) as MqttStateSyncPayload;

      if (data.type === "pin_update" && data.pin !== undefined && data.state !== undefined) {
        const rawPin = data.pin;

        const pinId =
          Number.isInteger(rawPin) && Number(rawPin) >= 0 && Number(rawPin) < 256
            ? PIN_ID_STRINGS[Number(rawPin)]
            : String(rawPin);

        return {
          kind: "pin_update",
          pinId,
          state: toBooleanPinState(data.state),
          source: "json",
        };
      }

      if (data.type === "state_sync" && data.states && !Array.isArray(data.states)) {
        const normalizedStates: Record<string, boolean> = {};
        const rawStates = data.states;

        for (const key in rawStates) {
          if (Object.hasOwn(rawStates, key)) {
            normalizedStates[key] = toBooleanPinState(rawStates[key]);
          }
        }

        // A state snapshot is authoritative: missing timer metadata means
        // that the pin has no restorable Dashboard auto-off countdown.
        const normalizedTimers: Record<string, number> = {};
        for (const key in normalizedStates) {
          if (Object.hasOwn(normalizedStates, key)) normalizedTimers[key] = 0;
        }
        const rawTimers = data.timers ?? {};

        for (const key in rawTimers) {
          if (Object.hasOwn(rawTimers, key)) {
            const seconds = Number(rawTimers[key]);
            const isPinOn = normalizedStates[key] === true;
            normalizedTimers[key] =
              isPinOn && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
          }
        }

        return { kind: "state_sync", states: normalizedStates, timers: normalizedTimers };
      }

      if (data.command === "ping") {
        return { kind: "ping" };
      }

      if (data.id !== undefined && data.value !== undefined) {
        const rawId = data.id;

        const pinId =
          Number.isInteger(rawId) && Number(rawId) >= 0 && Number(rawId) < 256
            ? PIN_ID_STRINGS[Number(rawId)]
            : String(rawId);

        return {
          kind: "pin_update",
          pinId,
          state: toBooleanPinState(data.value),
          source: "json",
        };
      }
    }

    return { kind: "ignored" };
  } catch (error) {
    return { kind: "error", error };
  }
}
