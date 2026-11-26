import { useEffect, useState } from "react";
import { getMqttClient, reconnectMqtt } from "@/features/iot/services/mqttService";

export type MqttConnectionStatus =
  | "starting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "offline"
  | "error";

export interface MqttConnectionState {
  status: MqttConnectionStatus;
  retry: () => void;
}

export function useMqttConnectionStatus(): MqttConnectionState {
  const [status, setStatus] = useState<MqttConnectionStatus>("starting");

  useEffect(() => {
    let activeClient: ReturnType<typeof getMqttClient> = null;
    let removeListeners: (() => void) | null = null;

    function syncClient(): void {
      const nextClient = getMqttClient();

      if (nextClient === activeClient) return;

      removeListeners?.();
      removeListeners = null;
      activeClient = nextClient;

      if (!nextClient) {
        setStatus("starting");
        return;
      }

      const client = nextClient;
      const isActiveClient = () => getMqttClient() === client;
      const onConnect = () => {
        if (isActiveClient()) setStatus("connected");
      };
      const onReconnect = () => {
        if (isActiveClient()) setStatus("reconnecting");
      };
      const onClose = () => {
        if (isActiveClient()) setStatus("disconnected");
      };
      const onOffline = () => {
        if (isActiveClient()) setStatus("offline");
      };
      const onError = () => {
        if (isActiveClient()) setStatus("error");
      };

      client.on("connect", onConnect);
      client.on("reconnect", onReconnect);
      client.on("close", onClose);
      client.on("offline", onOffline);
      client.on("error", onError);
      client.on("end", onClose);

      removeListeners = () => {
        client.removeListener("connect", onConnect);
        client.removeListener("reconnect", onReconnect);
        client.removeListener("close", onClose);
        client.removeListener("offline", onOffline);
        client.removeListener("error", onError);
        client.removeListener("end", onClose);
      };

      if (client.connected) {
        setStatus("connected");
      } else if (client.reconnecting) {
        setStatus("reconnecting");
      } else {
        setStatus("connecting");
      }
    }

    syncClient();

    // The MQTT client can be replaced during reconnect; poll only for that reference change.
    const intervalId = window.setInterval(syncClient, 1500);

    return () => {
      window.clearInterval(intervalId);
      removeListeners?.();
    };
  }, []);

  function retry(): void {
    setStatus("reconnecting");
    reconnectMqtt();
  }

  return { status, retry };
}
