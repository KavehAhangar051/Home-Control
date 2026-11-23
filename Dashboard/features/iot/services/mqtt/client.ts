import type { MqttClient } from "mqtt";
import type { MqttConfig } from "@/features/iot/hooks/store/types";
import { getIoTStoreSnapshot } from "../storeBridge";

export let client: MqttClient | null = null;

export type StateChangeCallback = (pinId: string, state: boolean) => void;

export const stateCallbacks: StateChangeCallback[] = [];

export const onMqttStateChange = (cb: StateChangeCallback) => {
  stateCallbacks.push(cb);

  return () => {
    const idx = stateCallbacks.indexOf(cb);

    if (idx > -1) stateCallbacks.splice(idx, 1);
  };
};

export interface MqttResolvedSettings {
  brokerUrl: string;
  baseTopic: string;
  qos: 0 | 1 | 2;
}

export interface MqttSettingsDeps {
  storeConfig?: MqttConfig | null;
  storage?: Pick<Storage, "getItem"> | null;
}

export const getMqttSettings = (deps: MqttSettingsDeps = {}): MqttResolvedSettings => {
  const mqttConfig =
    deps.storeConfig !== undefined ? deps.storeConfig : getIoTStoreSnapshot().mqttConfig;

  let storedBrokerUrl: string | null = null;
  let storedBaseTopic: string | null = null;
  let storedQos: number | null = null;

  try {
    const storage =
      deps.storage !== undefined
        ? deps.storage
        : typeof window !== "undefined"
          ? window.localStorage
          : null;

    if (storage) {
      storedBrokerUrl = storage.getItem("mqtt_broker_url");
      storedBaseTopic = storage.getItem("mqtt_base_topic");
      const rawQos = storage.getItem("mqtt_qos");

      if (rawQos !== null) {
        const parsed = Number.parseInt(rawQos, 10);

        if (parsed === 0 || parsed === 1 || parsed === 2) {
          storedQos = parsed;
        }
      }
    }
  } catch {
    // Ignore storage read failures
  }

  const qosVal = mqttConfig?.qos ?? storedQos;
  const qos: 0 | 1 | 2 = qosVal === 0 || qosVal === 1 || qosVal === 2 ? qosVal : 1;

  return {
    brokerUrl: mqttConfig?.broker_ws_url || storedBrokerUrl || "wss://broker.emqx.io:8084/mqtt",
    baseTopic: mqttConfig?.base_topic || storedBaseTopic || "KamyarIoT/Achaemenid",
    qos,
  };
};

export const getMqttClient = () => client;

export const setMqttClient = (newClient: MqttClient | null) => {
  client = newClient;
};

export interface PublishMqttCommandDeps {
  getClient?: () => Pick<MqttClient, "connected" | "publish"> | null;
  getSettings?: () => MqttResolvedSettings;
  initClient?: () => void;
  warn?: (message: string) => void;
  log?: (message: string) => void;
  /** Optional per-command QoS override (e.g. QoS 0 for transient PWM ramp frames). */
  qosOverride?: 0 | 1 | 2;
}

/**
 * Deep module command publisher:
 * Encapsulates client readiness check, lazy initialization, topic resolution,
 * binary buffer transmission, and diagnostic logging in one place.
 */
export const publishMqttCommand = (
  buf: Uint8Array,
  logLabel?: string,
  deps: PublishMqttCommandDeps = {},
): boolean => {
  const activeClient = deps.getClient ? deps.getClient() : getMqttClient();
  const warn = deps.warn ?? ((msg: string) => console.warn(msg));

  const log =
    deps.log ??
    ((msg: string) => {
      if (process.env.NODE_ENV !== "production") console.log(msg);
    });

  if (!activeClient) {
    // Lazy initialization on first command if not already started
    if (deps.initClient) {
      deps.initClient();
    } else {
      void import("./init").then(({ initMqtt }) => {
        void initMqtt();
      });
    }

    warn(`[MQTT] Client initializing. Cannot publish yet${logLabel ? ` (${logLabel})` : ""}.`);

    return false;
  }

  if (activeClient?.connected) {
    const settings = deps.getSettings ? deps.getSettings() : getMqttSettings();
    const commandTopic = `${settings.baseTopic}/Command`;
    const publishQos = deps.qosOverride ?? settings.qos;

    // SAFETY: mqtt.js publish method accepts Uint8Array or Buffer as payload
    activeClient.publish(commandTopic, buf as Buffer, { qos: publishQos });

    if (logLabel) {
      log(`[MQTT Binary] ${logLabel}`);
    }

    return true;
  }

  warn(`[MQTT] Client not connected. Cannot publish${logLabel ? ` (${logLabel})` : ""}.`);

  return false;
};
