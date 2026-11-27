import { notifyPinCommandAck } from "../pinAckBus";
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

export interface PinTelemetryPatch {
  state: boolean;
  analogValue?: number;
  clearAnalogOnOff?: boolean;
  resolution?: number;
  clearAutoOffTimer?: boolean;
}

export interface StateUpdateQueueDeps {
  maxPending?: number;
  scheduleFrame?: (cb: () => void) => number;
  cancelFrame?: (id: number) => void;
  applyPinsState?: IoTStoreBridge["setPinsState"];
  getSnapshot?: () => IoTStoreBridge;
  getCallbacks?: () => readonly StateChangeCallback[];
}

export interface StateUpdateQueue {
  queueStateUpdate: (
    pinId: string,
    state: boolean,
    telemetry?: Omit<PinTelemetryPatch, "state">,
  ) => void;
  flushStateUpdates: () => void;
  clear: () => void;
  getPendingCount: () => number;
}

/**
 * Bounded double-buffered pin state & telemetry update queue.
 * Coalesces high-frequency MQTT digital, analog PWM, resolution, and timer clears
 * into a single animation-frame flush while capping memory under pathological broker traffic.
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

  const getSnapshot = deps.getSnapshot ?? getIoTStoreSnapshot;

  const applyPinsState = deps.applyPinsState ?? ((updater) => getSnapshot().setPinsState(updater));

  const getCallbacks = deps.getCallbacks ?? (() => stateCallbacks);

  let pendingStateUpdates = new Map<string, PinTelemetryPatch>();
  let processingStateUpdates = new Map<string, PinTelemetryPatch>();
  let updateRafId: number | null = null;

  const flushStateUpdates = () => {
    updateRafId = null;

    if (pendingStateUpdates.size === 0) return;

    // Swap buffers: zero Map allocation per frame
    const temp = pendingStateUpdates;
    pendingStateUpdates = processingStateUpdates;
    processingStateUpdates = temp;
    pendingStateUpdates.clear();

    // 1. Batch digital pin states (short-circuit when unchanged)
    applyPinsState((prev) => {
      let hasChange = false;

      for (const [pinId, patch] of processingStateUpdates) {
        if (prev[pinId] !== patch.state) {
          hasChange = true;
          break;
        }
      }

      if (!hasChange) return prev;

      const next = { ...prev };

      for (const [pinId, patch] of processingStateUpdates) {
        next[pinId] = patch.state;
      }

      return next;
    });

    // 2. Batch analog PWM, last non-zero, resolution, and timer clears in the same frame
    let needsSnapshot = false;

    for (const [, patch] of processingStateUpdates) {
      if (
        patch.analogValue !== undefined ||
        patch.clearAnalogOnOff ||
        patch.resolution !== undefined ||
        patch.clearAutoOffTimer
      ) {
        needsSnapshot = true;
        break;
      }
    }

    if (needsSnapshot) {
      const snapshot = getSnapshot();
      let hasAnalogPatches = false;
      let hasNonZeroPatches = false;
      let hasResolutionPatches = false;
      let hasTimerClears = false;

      for (const [pinId, patch] of processingStateUpdates) {
        if (patch.analogValue !== undefined) {
          hasAnalogPatches = true;
          if (patch.analogValue > 0) hasNonZeroPatches = true;
        } else if (patch.clearAnalogOnOff && Object.hasOwn(snapshot.pinsAnalogValue, pinId)) {
          hasAnalogPatches = true;
        }

        if (patch.resolution !== undefined) {
          hasResolutionPatches = true;
        }

        if (patch.clearAutoOffTimer && (snapshot.autoOffRemaining[pinId] ?? 0) !== 0) {
          hasTimerClears = true;
        }
      }

      if (hasTimerClears) {
        const nextTimers = { ...snapshot.autoOffRemaining };

        for (const [pinId, patch] of processingStateUpdates) {
          if (patch.clearAutoOffTimer && (nextTimers[pinId] ?? 0) !== 0) {
            nextTimers[pinId] = 0;
          }
        }

        snapshot.setAutoOffRemaining(nextTimers);
      }

      if (hasAnalogPatches) {
        snapshot.setPinsAnalogValue((prev) => {
          let changed = false;
          let next = prev;

          for (const [pinId, patch] of processingStateUpdates) {
            const targetVal =
              patch.analogValue !== undefined
                ? patch.analogValue
                : patch.clearAnalogOnOff && Object.hasOwn(prev, pinId)
                  ? 0
                  : undefined;

            if (targetVal !== undefined && prev[pinId] !== targetVal) {
              if (!changed) {
                next = { ...prev };
                changed = true;
              }
              next[pinId] = targetVal;
            }
          }

          return changed ? next : prev;
        });
      }

      if (hasNonZeroPatches) {
        snapshot.setPinsLastNonZeroValue((prev) => {
          let changed = false;
          let next = prev;

          for (const [pinId, patch] of processingStateUpdates) {
            if (
              patch.analogValue !== undefined &&
              patch.analogValue > 0 &&
              prev[pinId] !== patch.analogValue
            ) {
              if (!changed) {
                next = { ...prev };
                changed = true;
              }
              next[pinId] = patch.analogValue;
            }
          }

          return changed ? next : prev;
        });
      }

      if (hasResolutionPatches) {
        snapshot.setPinsPwmResolution((prev) => {
          let changed = false;
          let next = prev;

          for (const [pinId, patch] of processingStateUpdates) {
            if (patch.resolution !== undefined && prev[pinId] !== patch.resolution) {
              if (!changed) {
                next = { ...prev };
                changed = true;
              }
              next[pinId] = patch.resolution;
            }
          }

          return changed ? next : prev;
        });
      }
    }

    const callbacks = getCallbacks();
    const cbLen = callbacks.length;

    if (cbLen > 0) {
      for (const [pinId, patch] of processingStateUpdates) {
        for (let i = 0; i < cbLen; i++) {
          callbacks[i](pinId, patch.state);
        }
      }
    }

    processingStateUpdates.clear();
  };

  const queueStateUpdate = (
    pinId: string,
    state: boolean,
    telemetry?: Omit<PinTelemetryPatch, "state">,
  ) => {
    const existing = pendingStateUpdates.get(pinId);

    if (!existing && pendingStateUpdates.size >= maxPending) {
      const oldestKey = pendingStateUpdates.keys().next().value;

      if (oldestKey !== undefined) {
        pendingStateUpdates.delete(oldestKey);
      }
    }

    pendingStateUpdates.set(pinId, {
      state,
      analogValue: telemetry?.analogValue ?? existing?.analogValue,
      clearAnalogOnOff:
        telemetry?.analogValue !== undefined
          ? false
          : (telemetry?.clearAnalogOnOff ?? existing?.clearAnalogOnOff),
      resolution: telemetry?.resolution ?? existing?.resolution,
      clearAutoOffTimer: Boolean(telemetry?.clearAutoOffTimer || existing?.clearAutoOffTimer),
    });

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
  queueStateUpdate: (
    pinId: string,
    state: boolean,
    telemetry?: Omit<PinTelemetryPatch, "state">,
  ) => void;
  onCommandAck?: (pinId: string) => void;
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
    deps.getSnapshot().setHasReceivedMqttStatus(false);
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
    const snapshot = deps.getSnapshot();
    snapshot.setIsMqttDeviceOnline?.(isOnline);
    snapshot.setIsLocal(isOnline || snapshot.isLocalWebSocketConnected === true);
    snapshot.setHasReceivedMqttStatus(true);

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
      // Local WebSocket is authoritative after its state handshake; ignore stale MQTT state frames.
      if (deps.getSnapshot().isLocalWebSocketConnected === true) return;
      const parsedState = parseMqttStateMessage(payload);

      if (parsedState.kind === "aux_node_ack") {
        logMqttDebug(
          `[MQTT] Received aux_node_ack: action=${parsedState.action} nodeId=${parsedState.nodeId}`,
        );
        const snapshot = deps.getSnapshot();
        const toastMsg =
          parsedState.action === "delete"
            ? `برد کمکی #${parsedState.nodeId} از حافظه برد مرکزی حذف شد.`
            : `برد کمکی #${parsedState.nodeId} در برد مرکزی ثبت و همگام‌سازی شد.`;
        snapshot.showToast(toastMsg, "success");
      } else if (parsedState.kind === "command_ack") {
        logMqttDebug(`[MQTT] Received command_ack from ESP32: pin=${parsedState.pinId}`);
        (deps.onCommandAck ?? notifyPinCommandAck)(parsedState.pinId);
      } else if (parsedState.kind === "pin_update") {
        const label = parsedState.source === "binary" ? "state update" : "JSON state update";
        logMqttDebug(
          `[MQTT] Received ${label} from ESP32: pin=${parsedState.pinId} state=${parsedState.state}${parsedState.value !== undefined ? ` value=${parsedState.value}` : ""}`,
        );

        deps.queueStateUpdate(parsedState.pinId, parsedState.state, {
          analogValue: parsedState.value,
          clearAnalogOnOff: parsedState.value === undefined && !parsedState.state,
          resolution: parsedState.resolution,
          clearAutoOffTimer: true,
        });
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
            let next = prev;

            for (const pin in syncedValues) {
              const val = syncedValues[pin];
              if (val > 0 && prev[pin] !== val) {
                if (!changed) {
                  next = { ...prev };
                  changed = true;
                }
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

        if (parsedState.nodes && parsedState.nodes.length > 0) {
          snapshot.updateAuxNodesOnlineStatus?.(parsedState.nodes);
        }

        if (parsedState.ids && Array.isArray(snapshot.segments)) {
          for (const segment of snapshot.segments) {
            if (segment.type === "placeholder" || !segment.pin) continue;
            const espId = parsedState.ids[String(segment.pin).trim()];
            if (espId && segment.id !== espId) {
              logMqttDebug(
                `[MQTT] Detected segment ID drift on GPIO ${segment.pin}: dashboard=${segment.id}, esp=${espId}`,
              );
            }
          }
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
