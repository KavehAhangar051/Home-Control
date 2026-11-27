"use client";

import type { MqttClient } from "mqtt";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMqttClient, reconnectMqtt } from "@/features/iot/services/mqttService";

export type MqttBrokerConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

function deriveInitialStatus(client: MqttClient | null): MqttBrokerConnectionStatus {
  if (!client) return "connecting";
  if (client.connected) return "connected";
  if (client.reconnecting) return "reconnecting";
  return "disconnected";
}

/**
 * Observes the singleton MQTT client connection lifecycle without initiating extra connections
 * except when the user explicitly clicks Retry. Ignores events emitted by replaced clients.
 */
export function useMqttConnectionStatus() {
  const [status, setStatus] = useState<MqttBrokerConnectionStatus>(() =>
    deriveInitialStatus(getMqttClient()),
  );
  const attachedClientRef = useRef<MqttClient | null>(null);
  const startWatchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let pollTimer: number | null = null;
    let cleanupCurrent: (() => void) | null = null;

    const attachToClient = (client: MqttClient) => {
      if (cleanupCurrent) {
        cleanupCurrent();
        cleanupCurrent = null;
      }

      attachedClientRef.current = client;
      const isCurrent = () => !disposed && getMqttClient() === client;

      const handleConnect = () => {
        if (!isCurrent()) return;
        setStatus("connected");
      };
      const handleReconnect = () => {
        if (!isCurrent()) return;
        setStatus("reconnecting");
      };
      const handleDisconnect = () => {
        if (!isCurrent()) return;
        setStatus("disconnected");
      };
      const handleError = () => {
        if (!isCurrent()) return;
        setStatus("error");
      };

      client.on("connect", handleConnect);
      client.on("reconnect", handleReconnect);
      client.on("close", handleDisconnect);
      client.on("offline", handleDisconnect);
      client.on("end", handleDisconnect);
      client.on("error", handleError);

      setStatus(deriveInitialStatus(client));

      cleanupCurrent = () => {
        client.off("connect", handleConnect);
        client.off("reconnect", handleReconnect);
        client.off("close", handleDisconnect);
        client.off("offline", handleDisconnect);
        client.off("end", handleDisconnect);
        client.off("error", handleError);
      };
    };

    const syncClientAttachment = () => {
      if (disposed) return;
      const liveClient = getMqttClient();
      if (liveClient && liveClient !== attachedClientRef.current) {
        attachToClient(liveClient);
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    };

    const startWatching = () => {
      syncClientAttachment();
      if (!attachedClientRef.current && pollTimer === null) {
        pollTimer = window.setInterval(syncClientAttachment, 400);
      } else if (attachedClientRef.current !== getMqttClient() && pollTimer === null) {
        pollTimer = window.setInterval(syncClientAttachment, 400);
      }
    };

    startWatchRef.current = startWatching;
    startWatching();

    return () => {
      disposed = true;
      startWatchRef.current = null;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      if (cleanupCurrent) {
        cleanupCurrent();
      }
      attachedClientRef.current = null;
    };
  }, []);

  const retry = useCallback(() => {
    setStatus("connecting");
    attachedClientRef.current = null;
    reconnectMqtt();
    startWatchRef.current?.();
  }, []);

  return { status, retry };
}
