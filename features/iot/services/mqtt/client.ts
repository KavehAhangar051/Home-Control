import type { MqttClient } from "mqtt";

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

import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export const getMqttSettings = () => {
  const mqttConfig = useIoTStore.getState().mqttConfig;

  let storedBrokerUrl: string | null = null;
  let storedBaseTopic: string | null = null;
  let storedQos: number | null = null;

  if (typeof window !== "undefined") {
    try {
      storedBrokerUrl = localStorage.getItem("mqtt_broker_url");
      storedBaseTopic = localStorage.getItem("mqtt_base_topic");
      const rawQos = localStorage.getItem("mqtt_qos");
      if (rawQos !== null) {
        const parsed = Number.parseInt(rawQos, 10);
        if (parsed === 0 || parsed === 1 || parsed === 2) {
          storedQos = parsed;
        }
      }
    } catch {
      // Ignore storage read failures
    }
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

/**
 * Deep module command publisher:
 * Encapsulates client readiness check, lazy initialization, topic resolution,
 * binary buffer transmission, and diagnostic logging in one place.
 */
export const publishMqttCommand = (buf: Uint8Array, logLabel?: string): boolean => {
  const activeClient = getMqttClient();

  if (!activeClient) {
    // Lazy initialization on first command if not already started
    void import("./init").then(({ initMqtt }) => {
      void initMqtt();
    });

    console.warn(
      `[MQTT] Client initializing. Cannot publish yet${logLabel ? ` (${logLabel})` : ""}.`,
    );

    return false;
  }

  if (activeClient?.connected) {
    const settings = getMqttSettings();
    const commandTopic = `${settings.baseTopic}/Command`;

    // SAFETY: mqtt.js publish method accepts Uint8Array or Buffer as payload
    activeClient.publish(commandTopic, buf as Buffer, { qos: settings.qos });

    if (logLabel) {
      console.log(`[MQTT Binary] ${logLabel}`);
    }

    return true;
  }

  console.warn(`[MQTT] Client not connected. Cannot publish${logLabel ? ` (${logLabel})` : ""}.`);

  return false;
};
