import { getIoTStoreSnapshot } from "../storeBridge";
import { getMqttClient, getMqttSettings, setMqttClient, stateCallbacks } from "./client";
import { parseMqttStateMessage, parseMqttStatusMessage } from "./messageParser";
import { PRESENCE_OFFLINE_FRAME, PRESENCE_ONLINE_FRAME, SYNC_REQUEST_FRAME } from "./protocol";

let initPromise: Promise<void> | null = null;
let connectionGeneration = 0;

// Queue for batched state updates with double-buffered map to avoid per-frame allocations
const MAX_PENDING_PIN_UPDATES = 256;
let pendingStateUpdates = new Map<string, boolean>();
let processingStateUpdates = new Map<string, boolean>();
let updateRafId: number | null = null;

function clearPendingStateQueue(): void {
  if (updateRafId !== null && typeof window !== "undefined") {
    cancelAnimationFrame(updateRafId);
    updateRafId = null;
  }

  pendingStateUpdates.clear();
  processingStateUpdates.clear();
}

// ESP32 online/offline detection از طریق LWT
const markEspStatus = (isOnline: boolean) => {
  getIoTStoreSnapshot().setIsLocal(isOnline);

  if (isOnline) {
    console.log("[MQTT] ESP32 is ONLINE.");
  } else {
    console.warn("[MQTT] ESP32 is OFFLINE (LWT triggered).");
  }
};

const flushStateUpdates = () => {
  updateRafId = null;

  if (pendingStateUpdates.size === 0) return;

  // Swap buffers: zero allocation per frame
  const temp = pendingStateUpdates;
  pendingStateUpdates = processingStateUpdates;
  processingStateUpdates = temp;
  pendingStateUpdates.clear();

  // Batch update store (short-circuit if all incoming states match existing state)
  getIoTStoreSnapshot().setPinsState((prev) => {
    let hasChange = false;

    for (const [pinId, state] of processingStateUpdates) {
      if (prev[pinId] !== state) {
        hasChange = true;
        break;
      }
    }

    if (!hasChange) return prev;

    const next = { ...prev };

    for (const [pinId, state] of processingStateUpdates) {
      next[pinId] = state;
    }

    return next;
  });

  const cbLen = stateCallbacks.length;

  if (cbLen > 0) {
    for (const [pinId, state] of processingStateUpdates) {
      for (let i = 0; i < cbLen; i++) {
        stateCallbacks[i](pinId, state);
      }
    }
  }

  processingStateUpdates.clear();
};

const queueStateUpdate = (pinId: string, state: boolean) => {
  // Phase 8 bounded queue guard: prevent unbounded memory growth under pathological MQTT bursts
  if (pendingStateUpdates.size >= MAX_PENDING_PIN_UPDATES && !pendingStateUpdates.has(pinId)) {
    const oldestKey = pendingStateUpdates.keys().next().value;

    if (oldestKey !== undefined) {
      pendingStateUpdates.delete(oldestKey);
    }
  }

  pendingStateUpdates.set(pinId, state);

  if (!updateRafId && typeof window !== "undefined") {
    updateRafId = requestAnimationFrame(flushStateUpdates);
  }
};

export const initMqtt = (): Promise<void> => {
  if (getMqttClient()) {
    return Promise.resolve();
  }

  if (initPromise) {
    return initPromise;
  }

  const generation = connectionGeneration;

  initPromise = (async () => {
    const { default: mqtt } = await import("mqtt");

    if (generation !== connectionGeneration) return;

    let client = getMqttClient();

    if (!client) {
      const settings = getMqttSettings();
      const commandTopic = `${settings.baseTopic}/Command`;
      const stateTopic = `${settings.baseTopic}/State`;
      const statusTopic = `${settings.baseTopic}/Status`;
      const qos = settings.qos;

      client = mqtt.connect(settings.brokerUrl, {
        clientId: `dashboard_${Math.random().toString(16).substring(2, 10)}`,
        reconnectPeriod: 5000,
      });
      setMqttClient(client);

      client.on("connect", () => {
        if (generation !== connectionGeneration) return;

        console.log(`[MQTT] Connected to ${settings.brokerUrl}!`);
        client?.subscribe(stateTopic);
        client?.subscribe(statusTopic);

        queueMicrotask(() => {
          if (generation !== connectionGeneration) return;

          const isPageVisible = getIoTStoreSnapshot().isPageVisible;
          const presenceBuf = isPageVisible ? PRESENCE_ONLINE_FRAME : PRESENCE_OFFLINE_FRAME;
          // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
          client?.publish(commandTopic, presenceBuf as Buffer, { qos });

          // Request full state from ESP32 RAM (Global SSOT)
          // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
          client?.publish(commandTopic, SYNC_REQUEST_FRAME as Buffer, { qos });
        });
      });

      client.on("message", (topic, payload) => {
        if (generation !== connectionGeneration) return;

        if (topic === statusTopic) {
          const parsedStatus = parseMqttStatusMessage(payload);

          if (parsedStatus.kind === "online") {
            markEspStatus(true);

            const snapshot = getIoTStoreSnapshot();

            if (parsedStatus.ip && snapshot.localIp !== parsedStatus.ip) {
              snapshot.setLocalIp(parsedStatus.ip);
            }
          } else if (parsedStatus.kind === "offline") {
            markEspStatus(false);
          } else if (parsedStatus.kind === "error") {
            console.error("[MQTT] Failed to parse status JSON", parsedStatus.error);
          }
        } else if (topic === stateTopic) {
          const parsedState = parseMqttStateMessage(payload);

          if (parsedState.kind === "pin_update") {
            const label = parsedState.source === "binary" ? "state update" : "JSON state update";
            console.log(
              `[MQTT] Received ${label} from ESP32: pin=${parsedState.pinId} state=${parsedState.state}`,
            );
            queueStateUpdate(parsedState.pinId, parsedState.state);
          } else if (parsedState.kind === "state_sync") {
            console.log(`[MQTT] Received full state sync from ESP32:`, parsedState.states);
            getIoTStoreSnapshot().setPinsState(parsedState.states);
          } else if (parsedState.kind === "ping") {
            queueMicrotask(() => {
              if (generation !== connectionGeneration) return;

              const isPageVisible = getIoTStoreSnapshot().isPageVisible;
              const presenceBuf = isPageVisible ? PRESENCE_ONLINE_FRAME : PRESENCE_OFFLINE_FRAME;

              // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
              client?.publish(commandTopic, presenceBuf as Buffer, { qos });
            });
          } else if (parsedState.kind === "error") {
            console.error("Failed to parse MQTT state message", parsedState.error);
          }
        }
      });

      client.on("error", (err) => {
        if (generation !== connectionGeneration) return;

        console.error("[MQTT] Connection error:", err);
      });
    }
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
};

export const reconnectMqtt = () => {
  connectionGeneration += 1;
  initPromise = null;
  clearPendingStateQueue();

  const client = getMqttClient();

  if (client) {
    client.end(true);
    setMqttClient(null);
  }

  void initMqtt();
};
