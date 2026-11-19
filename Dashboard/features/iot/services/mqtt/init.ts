import { type IoTStoreBridge, getIoTStoreSnapshot } from "../storeBridge";
import {
  type StateChangeCallback,
  getMqttClient,
  getMqttSettings,
  setMqttClient,
  stateCallbacks,
} from "./client";
import { parseMqttStateMessage, parseMqttStatusMessage } from "./messageParser";
import { PRESENCE_OFFLINE_FRAME, PRESENCE_ONLINE_FRAME, SYNC_REQUEST_FRAME } from "./protocol";

let initPromise: Promise<void> | null = null;
let connectionGeneration = 0;

export const MAX_PENDING_PIN_UPDATES = 256;

const logMqttDebug = (...args: Parameters<typeof console.log>) => {
  if (process.env.NODE_ENV !== "production") console.log(...args);
};

export interface StateUpdateQueueDeps {
  maxPending?: number;
  scheduleFrame?: (cb: () => void) => number;
  cancelFrame?: (id: number) => void;
  applyPinsState?: IoTStoreBridge["setPinsState"];
  getCallbacks?: () => readonly StateChangeCallback[];
}

export interface StateUpdateQueue {
  queueStateUpdate: (pinId: string, state: boolean) => void;
  flushStateUpdates: () => void;
  clear: () => void;
  getPendingCount: () => number;
}

/**
 * Bounded double-buffered pin state update queue.
 * Coalesces bursts into a single frame flush while capping memory under pathological broker traffic.
 */
export function createStateUpdateQueue(deps: StateUpdateQueueDeps = {}): StateUpdateQueue {
  const maxPending = Math.max(1, deps.maxPending ?? MAX_PENDING_PIN_UPDATES);

  const scheduleFrame =
    deps.scheduleFrame ??
    ((cb: () => void) => (typeof window !== "undefined" ? window.requestAnimationFrame(cb) : 0));

  const cancelFrame =
    deps.cancelFrame ??
    ((id: number) => {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(id);
      }
    });

  const applyPinsState =
    deps.applyPinsState ?? ((updater) => getIoTStoreSnapshot().setPinsState(updater));

  const getCallbacks = deps.getCallbacks ?? (() => stateCallbacks);

  let pendingStateUpdates = new Map<string, boolean>();
  let processingStateUpdates = new Map<string, boolean>();
  let updateRafId: number | null = null;

  const flushStateUpdates = () => {
    if (updateRafId !== null) {
      cancelFrame(updateRafId);
      updateRafId = null;
    }

    if (pendingStateUpdates.size === 0) return;

    // Swap buffers: zero allocation per frame
    const temp = pendingStateUpdates;
    pendingStateUpdates = processingStateUpdates;
    processingStateUpdates = temp;
    pendingStateUpdates.clear();

    // Batch update store (short-circuit if all incoming states match existing state)
    applyPinsState((prev) => {
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

    const callbacks = getCallbacks();
    const cbLen = callbacks.length;

    if (cbLen > 0) {
      for (const [pinId, state] of processingStateUpdates) {
        for (let i = 0; i < cbLen; i++) {
          callbacks[i](pinId, state);
        }
      }
    }

    processingStateUpdates.clear();
  };

  const queueStateUpdate = (pinId: string, state: boolean) => {
    if (pendingStateUpdates.size >= maxPending && !pendingStateUpdates.has(pinId)) {
      const oldestKey = pendingStateUpdates.keys().next().value;

      if (oldestKey !== undefined) {
        pendingStateUpdates.delete(oldestKey);
      }
    }

    pendingStateUpdates.set(pinId, state);

    if (updateRafId === null && (deps.scheduleFrame || typeof window !== "undefined")) {
      updateRafId = scheduleFrame(flushStateUpdates);
    }
  };

  const clear = () => {
    if (updateRafId !== null) {
      cancelFrame(updateRafId);
      updateRafId = null;
    }

    pendingStateUpdates.clear();
    processingStateUpdates.clear();
  };

  return {
    queueStateUpdate,
    flushStateUpdates,
    clear,
    getPendingCount: () => pendingStateUpdates.size,
  };
}

const defaultStateQueue = createStateUpdateQueue();

export interface MqttHandlerClient {
  subscribe: (topic: string) => void;
  publish: (topic: string, payload: Buffer, options: { qos: 0 | 1 | 2 }) => void;
}

export interface MqttMessageHandlerDeps {
  commandTopic: string;
  stateTopic: string;
  statusTopic: string;
  qos: 0 | 1 | 2;
  isCurrentGeneration: () => boolean;
  getSnapshot: () => IoTStoreBridge;
  queueStateUpdate: (pinId: string, state: boolean) => void;
  flushStateUpdates?: () => void;
  publishFrame: (topic: string, buf: Uint8Array, qos: 0 | 1 | 2) => void;
  scheduleMicrotask?: (fn: () => void) => void;
}

export function createMqttConnectHandler(deps: {
  brokerUrl: string;
  commandTopic: string;
  stateTopic: string;
  statusTopic: string;
  qos: 0 | 1 | 2;
  isCurrentGeneration: () => boolean;
  getSnapshot: () => IoTStoreBridge;
  subscribeTopic: (topic: string) => void;
  publishFrame: (topic: string, buf: Uint8Array, qos: 0 | 1 | 2) => void;
  scheduleMicrotask?: (fn: () => void) => void;
}): () => void {
  const schedule = deps.scheduleMicrotask ?? queueMicrotask;

  return () => {
    if (!deps.isCurrentGeneration()) return;

    logMqttDebug(`[MQTT] Connected to ${deps.brokerUrl}!`);
    deps.subscribeTopic(deps.stateTopic);
    deps.subscribeTopic(deps.statusTopic);

    schedule(() => {
      if (!deps.isCurrentGeneration()) return;

      const isPageVisible = deps.getSnapshot().isPageVisible;
      const presenceBuf = isPageVisible ? PRESENCE_ONLINE_FRAME : PRESENCE_OFFLINE_FRAME;
      deps.publishFrame(deps.commandTopic, presenceBuf, deps.qos);
      deps.publishFrame(deps.commandTopic, SYNC_REQUEST_FRAME, deps.qos);
    });
  };
}

export function createMqttMessageHandler(
  deps: MqttMessageHandlerDeps,
): (topic: string, payload: Uint8Array) => void {
  const schedule = deps.scheduleMicrotask ?? queueMicrotask;

  const markEspStatus = (isOnline: boolean) => {
    deps.getSnapshot().setIsLocal(isOnline);

    if (isOnline) {
      logMqttDebug("[MQTT] ESP32 is ONLINE.");
    } else {
      console.warn("[MQTT] ESP32 is OFFLINE (LWT triggered).");
    }
  };

  return (topic: string, payload: Uint8Array) => {
    if (!deps.isCurrentGeneration()) return;

    if (topic === deps.statusTopic) {
      const parsedStatus = parseMqttStatusMessage(payload);

      if (parsedStatus.kind === "online") {
        markEspStatus(true);

        const snapshot = deps.getSnapshot();

        if (parsedStatus.ip && snapshot.localIp !== parsedStatus.ip) {
          snapshot.setLocalIp(parsedStatus.ip);
        }
      } else if (parsedStatus.kind === "offline") {
        markEspStatus(false);
      } else if (parsedStatus.kind === "error") {
        console.error("[MQTT] Failed to parse status JSON", parsedStatus.error);
      }
    } else if (topic === deps.stateTopic) {
      const parsedState = parseMqttStateMessage(payload);

      if (parsedState.kind === "pin_update") {
        const snapshot = deps.getSnapshot();
        const label = parsedState.isAck
          ? "command_ack"
          : parsedState.source === "binary"
            ? "state update"
            : "JSON state update";
        logMqttDebug(
          `[MQTT] Received ${label} from ESP32: pin=${parsedState.pinId} state=${parsedState.state}${parsedState.value !== undefined ? ` value=${parsedState.value}` : ""}`,
        );

        if (!parsedState.isAck || !parsedState.state) {
          snapshot.setAutoOffRemaining({
            ...snapshot.autoOffRemaining,
            [parsedState.pinId]: 0,
          });
        }

        if (parsedState.value !== undefined) {
          const confirmedVal = parsedState.value;
          snapshot.setPinsAnalogValue((prev) =>
            prev[parsedState.pinId] === confirmedVal
              ? prev
              : { ...prev, [parsedState.pinId]: confirmedVal },
          );

          if (confirmedVal > 0) {
            snapshot.setPinsLastNonZeroValue((prev) =>
              prev[parsedState.pinId] === confirmedVal
                ? prev
                : { ...prev, [parsedState.pinId]: confirmedVal },
            );
          }
        } else if (
          !parsedState.state &&
          Object.hasOwn(snapshot.pinsAnalogValue, parsedState.pinId)
        ) {
          snapshot.setPinsAnalogValue((prev) =>
            prev[parsedState.pinId] === 0 ? prev : { ...prev, [parsedState.pinId]: 0 },
          );
        }

        if (parsedState.resolution !== undefined) {
          const confirmedRes = parsedState.resolution;
          snapshot.setPinsPwmResolution((prev) =>
            prev[parsedState.pinId] === confirmedRes
              ? prev
              : { ...prev, [parsedState.pinId]: confirmedRes },
          );
        }

        deps.queueStateUpdate(parsedState.pinId, parsedState.state);
      } else if (parsedState.kind === "state_sync") {
        const snapshot = deps.getSnapshot();
        logMqttDebug(`[MQTT] Received full state sync from ESP32:`, parsedState.states);
        deps.flushStateUpdates?.();
        snapshot.setPinsState(parsedState.states);
        snapshot.setAutoOffRemaining(parsedState.timers);

        if (parsedState.values) {
          const syncedValues = parsedState.values;
          snapshot.setPinsAnalogValue(syncedValues);
          snapshot.setPinsLastNonZeroValue((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const [pin, val] of Object.entries(syncedValues)) {
              if (val > 0 && next[pin] !== val) {
                next[pin] = val;
                changed = true;
              }
            }

            return changed ? next : prev;
          });
        }

        if (parsedState.resolutions) {
          snapshot.setPinsPwmResolution(parsedState.resolutions);
        }
      } else if (parsedState.kind === "ping") {
        schedule(() => {
          if (!deps.isCurrentGeneration()) return;

          const isPageVisible = deps.getSnapshot().isPageVisible;
          const presenceBuf = isPageVisible ? PRESENCE_ONLINE_FRAME : PRESENCE_OFFLINE_FRAME;
          deps.publishFrame(deps.commandTopic, presenceBuf, deps.qos);
        });
      } else if (parsedState.kind === "error") {
        console.error("Failed to parse MQTT state message", parsedState.error);
      }
    }
  };
}

export function buildMqttClientId(randomFn: () => number = Math.random): string {
  return `dashboard_${randomFn().toString(16).substring(2, 10)}`;
}

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
        clientId: buildMqttClientId(),
        reconnectPeriod: 5000,
      });
      setMqttClient(client);

      const isCurrentGeneration = () => generation === connectionGeneration;

      const publishFrame = (topic: string, buf: Uint8Array, targetQos: 0 | 1 | 2) => {
        // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
        client?.publish(topic, buf as Buffer, { qos: targetQos });
      };

      const onConnect = createMqttConnectHandler({
        brokerUrl: settings.brokerUrl,
        commandTopic,
        stateTopic,
        statusTopic,
        qos,
        isCurrentGeneration,
        getSnapshot: getIoTStoreSnapshot,
        subscribeTopic: (topic) => {
          client?.subscribe(topic);
        },
        publishFrame,
      });

      const onMessage = createMqttMessageHandler({
        commandTopic,
        stateTopic,
        statusTopic,
        qos,
        isCurrentGeneration,
        getSnapshot: getIoTStoreSnapshot,
        queueStateUpdate: defaultStateQueue.queueStateUpdate,
        flushStateUpdates: defaultStateQueue.flushStateUpdates,
        publishFrame,
      });

      client.on("connect", onConnect);
      client.on("message", onMessage);

      client.on("error", (err) => {
        if (!isCurrentGeneration()) return;

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
  defaultStateQueue.clear();

  const client = getMqttClient();

  if (client) {
    client.end(true);
    setMqttClient(null);
  }

  void initMqtt();
};

export const MIN_RESUME_SYNC_INTERVAL_MS = 3000;

export type MqttResumeOutcome = "noop" | "throttled" | "synced" | "reconnected";

export interface MqttResumeClientLike {
  connected: boolean;
  publish: (topic: string, payload: Buffer, options: { qos: 0 | 1 | 2 }) => void;
  reconnect?: () => void;
}

export interface MqttResumeControllerDeps {
  getClient: () => MqttResumeClientLike | null;
  getSettings: () => { baseTopic: string; qos: 0 | 1 | 2 };
  now?: () => number;
  minSyncIntervalMs?: number;
  onReconnect?: () => void;
}

/**
 * Coordinates instant MQTT state resynchronization or immediate reconnect
 * when the browser tab wakes up or regains network connectivity.
 */
export function createMqttResumeController(
  deps: MqttResumeControllerDeps,
): () => MqttResumeOutcome {
  const now = deps.now ?? (() => Date.now());
  const minSyncIntervalMs = deps.minSyncIntervalMs ?? MIN_RESUME_SYNC_INTERVAL_MS;
  let lastSyncAt = Number.NEGATIVE_INFINITY;

  return () => {
    const activeClient = deps.getClient();

    if (!activeClient) {
      return "noop";
    }

    if (!activeClient.connected) {
      if (activeClient.reconnect instanceof Function) {
        activeClient.reconnect();
      } else {
        deps.onReconnect?.();
      }

      return "reconnected";
    }

    const currentNow = now();

    if (currentNow - lastSyncAt < minSyncIntervalMs) {
      return "throttled";
    }

    lastSyncAt = currentNow;
    const settings = deps.getSettings();
    const commandTopic = `${settings.baseTopic}/Command`;

    // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
    activeClient.publish(commandTopic, PRESENCE_ONLINE_FRAME as Buffer, { qos: settings.qos });

    // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
    activeClient.publish(commandTopic, SYNC_REQUEST_FRAME as Buffer, { qos: settings.qos });

    return "synced";
  };
}

const defaultMqttResume = createMqttResumeController({
  // SAFETY: MqttClient structurally implements connected, publish, and optional reconnect
  getClient: () => getMqttClient() as MqttResumeClientLike | null,
  getSettings: getMqttSettings,
  onReconnect: reconnectMqtt,
});

export const notifyMqttResume = (): MqttResumeOutcome => defaultMqttResume();
