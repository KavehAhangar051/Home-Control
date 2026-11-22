export type RawPinStateValue = boolean | number | string | null | undefined;

export interface MqttStateSyncPayload {
  type?: string;
  command?: string;
  id?: string | number;
  value?: RawPinStateValue;
  resolution?: RawPinStateValue;
  states?: Record<string, RawPinStateValue>;
  values?: Record<string, RawPinStateValue>;
  resolutions?: Record<string, RawPinStateValue>;
  ids?: Record<string, unknown>;
  timers?: Record<string, RawPinStateValue>;
  pin?: string | number;
  state?: RawPinStateValue;
  source?: string;
}

export type ParsedMqttStatusMessage =
  | { kind: "online"; ip?: string }
  | { kind: "offline" }
  | { kind: "ignored" }
  | { kind: "error"; error: unknown };

export type ParsedMqttStateMessage =
  | {
      kind: "pin_update";
      pinId: string;
      state: boolean;
      source: "binary" | "json";
      value?: number;
      resolution?: number;
    }
  | {
      kind: "command_ack";
      pinId: string;
      state?: boolean;
      value?: number;
      resolution?: number;
    }
  | {
      kind: "state_sync";
      states: Record<string, boolean>;
      timers: Record<string, number>;
      values?: Record<string, number>;
      resolutions?: Record<string, number>;
      ids?: Record<string, string>;
    }
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

function resolveMqttPinId(rawPin: string | number): string {
  return Number.isInteger(rawPin) && Number(rawPin) >= 0 && Number(rawPin) < 256
    ? PIN_ID_STRINGS[Number(rawPin)]
    : String(rawPin);
}

function parseOptionalNumericValue(raw: RawPinStateValue): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.min(4095, Math.max(0, Math.round(raw)))
    : undefined;
}

function parseOptionalResolution(raw: RawPinStateValue): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 8 && raw <= 12
    ? Math.round(raw)
    : undefined;
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
        const ipText = typeof data.ip === "string" ? data.ip : "";

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
 * Pure parser for ESP32 MQTT State topic payloads (JSON events).
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

      // Command receipt confirmations NEVER mutate pin state or timers; keep them strictly isolated.
      if (data.type === "command_ack" && data.pin !== undefined) {
        return {
          kind: "command_ack",
          pinId: resolveMqttPinId(data.pin),
          state: data.state !== undefined ? toBooleanPinState(data.state) : undefined,
          value: parseOptionalNumericValue(data.value),
          resolution: parseOptionalResolution(data.resolution),
        };
      }

      if (
        data.type === "pin_update" &&
        data.pin !== undefined &&
        (data.state !== undefined || data.value !== undefined)
      ) {
        const pinId = resolveMqttPinId(data.pin);
        const parsedNumericValue = parseOptionalNumericValue(data.value);
        const parsedResolution = parseOptionalResolution(data.resolution);

        const resolvedState =
          data.state !== undefined
            ? toBooleanPinState(data.state)
            : parsedNumericValue !== undefined
              ? parsedNumericValue > 0
              : false;

        return {
          kind: "pin_update",
          pinId,
          state: resolvedState,
          source: "json",
          value: parsedNumericValue,
          resolution: parsedResolution,
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

        let normalizedValues: Record<string, number> | undefined;
        if (data.values && !Array.isArray(data.values)) {
          normalizedValues = {};
          for (const key in data.values) {
            if (Object.hasOwn(data.values, key)) {
              const num = Number(data.values[key]);
              if (Number.isFinite(num)) {
                normalizedValues[key] = Math.min(4095, Math.max(0, Math.round(num)));
              }
            }
          }
        }

        let normalizedResolutions: Record<string, number> | undefined;
        if (data.resolutions && !Array.isArray(data.resolutions)) {
          normalizedResolutions = {};
          for (const key in data.resolutions) {
            if (Object.hasOwn(data.resolutions, key)) {
              const res = Number(data.resolutions[key]);
              if (Number.isFinite(res) && res >= 8 && res <= 12) {
                normalizedResolutions[key] = Math.round(res);
              }
            }
          }
        }

        let normalizedIds: Record<string, string> | undefined;
        if (data.ids && typeof data.ids === "object" && !Array.isArray(data.ids)) {
          normalizedIds = {};
          for (const key in data.ids) {
            if (Object.hasOwn(data.ids, key) && typeof data.ids[key] === "string") {
              const trimmed = data.ids[key].trim();
              if (trimmed.length > 0 && trimmed.length <= 31) {
                normalizedIds[key] = trimmed;
              }
            }
          }
        }

        return {
          kind: "state_sync",
          states: normalizedStates,
          timers: normalizedTimers,
          ...(normalizedValues !== undefined ? { values: normalizedValues } : {}),
          ...(normalizedResolutions !== undefined ? { resolutions: normalizedResolutions } : {}),
          ...(normalizedIds !== undefined ? { ids: normalizedIds } : {}),
        };
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
