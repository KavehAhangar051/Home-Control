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
    updateRafId = null;

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
        const label = parsedState.source === "binary" ? "state update" : "JSON state update";
        logMqttDebug(
          `[MQTT] Received ${label} from ESP32: pin=${parsedState.pinId} state=${parsedState.state}`,
        );
        deps.queueStateUpdate(parsedState.pinId, parsedState.state);
      } else if (parsedState.kind === "state_sync") {
        logMqttDebug(`[MQTT] Received full state sync from ESP32:`, parsedState.states);
        deps.getSnapshot().setPinsState(parsedState.states);
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
