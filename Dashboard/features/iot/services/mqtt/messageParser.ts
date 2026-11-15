export type RawPinStateValue = boolean | number | string | null | undefined;

export interface MqttStateSyncPayload {
  type?: string;
  command?: string;
  id?: string | number;
  value?: RawPinStateValue;
  states?: Record<string, RawPinStateValue>;
}

export type ParsedMqttStatusMessage =
  | { kind: "online"; ip?: string }
  | { kind: "offline" }
  | { kind: "ignored" }
  | { kind: "error"; error: unknown };

export type ParsedMqttStateMessage =
  | { kind: "pin_update"; pinId: string; state: boolean; source: "binary" | "json" }
  | { kind: "state_sync"; states: Record<string, boolean> }
  | { kind: "ping" }
  | { kind: "ignored" }
  | { kind: "error"; error: unknown };

const textDecoder = new TextDecoder();

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
      const data = JSON.parse(strPayload) as { status?: unknown; ip?: unknown };

      if (data.status === "online") {
        return {
          kind: "online",
          ip: typeof data.ip === "string" && data.ip.length > 0 ? data.ip : undefined,
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

    if (cmdType === 0x06 && payload.length >= 3) {
      const pinNum = payload[1];
      const state = payload[2] === 0x01;

      return { kind: "pin_update", pinId: pinNum.toString(), state, source: "binary" };
    }

    if (cmdType === 123) {
      const data = JSON.parse(decodePayloadText(payload)) as MqttStateSyncPayload;

      if (data.type === "state_sync" && data.states && !Array.isArray(data.states)) {
        const normalizedStates: Record<string, boolean> = {};

        for (const [key, val] of Object.entries(data.states)) {
          normalizedStates[key] = toBooleanPinState(val);
        }

        return { kind: "state_sync", states: normalizedStates };
      }

      if (data.command === "ping") {
        return { kind: "ping" };
      }

      if (data.id !== undefined && data.value !== undefined) {
        return {
          kind: "pin_update",
          pinId: data.id.toString(),
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
