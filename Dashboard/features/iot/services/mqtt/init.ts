import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { getMqttClient, getMqttSettings, setMqttClient, stateCallbacks } from "./client";
import { PRESENCE_OFFLINE_FRAME, PRESENCE_ONLINE_FRAME, SYNC_REQUEST_FRAME } from "./protocol";

let initPromise: Promise<void> | null = null;

// Queue for batched state updates with double-buffered map to avoid per-frame allocations
let pendingStateUpdates = new Map<string, boolean>();
let processingStateUpdates = new Map<string, boolean>();
let updateRafId: number | null = null;

// ESP32 online/offline detection از طریق LWT
const markEspStatus = (isOnline: boolean) => {
  useIoTStore.getState().setIsLocal(isOnline);

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

  // Batch update zustand store (short-circuit if all incoming states match existing state)
  useIoTStore.getState().setPinsState((prev) => {
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

  initPromise = (async () => {
    const { default: mqtt } = await import("mqtt");
    let client = getMqttClient();

    if (!client) {
      const settings = getMqttSettings();
      const commandTopic = `${settings.baseTopic}/Command`;
      const stateTopic = `${settings.baseTopic}/State`;
      const statusTopic = `${settings.baseTopic}/Status`;
      const qos = settings.qos;

      client = mqtt.connect(settings.brokerUrl, {
        clientId: "dashboard_" + Math.random().toString(16).substring(2, 10),
        reconnectPeriod: 5000,
      });
      setMqttClient(client);

      client.on("connect", () => {
        console.log(`[MQTT] Connected to ${settings.brokerUrl}!`);
        client?.subscribe(stateTopic);
        client?.subscribe(statusTopic);

        queueMicrotask(() => {
          const isPageVisible = useIoTStore.getState().isPageVisible;
          const presenceBuf = isPageVisible ? PRESENCE_ONLINE_FRAME : PRESENCE_OFFLINE_FRAME;
          // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
          client?.publish(commandTopic, presenceBuf as Buffer, { qos });

          // Request full state from ESP32 RAM (Global SSOT)
          // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
          client?.publish(commandTopic, SYNC_REQUEST_FRAME as Buffer, { qos });
        });
      });

      client.on("message", (topic, payload) => {
        if (topic === statusTopic) {
          if (payload.length === 0) return;
          const strPayload = payload.toString().trim();

          if (strPayload === "offline" || strPayload === "OFFLINE") {
            markEspStatus(false);

            return;
          }

          if (strPayload.charCodeAt(0) === 123) {
            try {
              const data = JSON.parse(strPayload);

              if (data.status === "online") {
                markEspStatus(true);

                if (data.ip && useIoTStore.getState().localIp !== data.ip) {
                  useIoTStore.getState().setLocalIp(data.ip);
                }
              } else if (data.status === "offline") {
                markEspStatus(false);
              }
            } catch (e) {
              console.error("[MQTT] Failed to parse status JSON", e);
            }
          }
        } else if (topic === stateTopic) {
          try {
            if (payload.length > 0) {
              const cmdType = payload[0];

              if (cmdType === 0x06 && payload.length >= 3) {
                const pinNum = payload[1];
                const state = payload[2] === 0x01;
                console.log(
                  `[MQTT] Received state update from ESP32: pin=${pinNum} state=${state}`,
                );
                queueStateUpdate(pinNum.toString(), state);
              } else if (payload[0] === 123) {
                const data = JSON.parse(payload.toString());

                if (data.type === "state_sync" && data.states) {
                  // Full state sync from ESP32
                  console.log(`[MQTT] Received full state sync from ESP32:`, data.states);
                  useIoTStore.getState().setPinsState(data.states);
                } else if (data.command === "ping") {
                  queueMicrotask(() => {
                    const isPageVisible = useIoTStore.getState().isPageVisible;
                    const presenceBuf = isPageVisible
                      ? PRESENCE_ONLINE_FRAME
                      : PRESENCE_OFFLINE_FRAME;
                    // SAFETY: mqtt.js publish accepts Uint8Array or Buffer as binary payload
                    client?.publish(commandTopic, presenceBuf as Buffer, { qos });
                  });
                } else if (data.id !== undefined && data.value !== undefined) {
                  console.log(
                    `[MQTT] Received JSON state update from ESP32: pin=${data.id} state=${data.value}`,
                  );
                  queueStateUpdate(data.id.toString(), data.value);
                }
              }
            }
          } catch (e) {
            console.error("Failed to parse MQTT state message", e);
          }
        }
      });

      client.on("error", (err) => {
        console.error("[MQTT] Connection error:", err);
      });
    }
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
};

export const reconnectMqtt = () => {
  const client = getMqttClient();

  if (client) {
    client.end(true);
    setMqttClient(null);
  }

  void initMqtt();
};
