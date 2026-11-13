"use client";

import { useEffect } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { dispatchLocalState, setLocalWs } from "@/features/iot/services/localWs/client";

function connectLocalWebSocket(
  localIp: string,
  setIsLocal: (val: boolean) => void,
  setPinsState: (
    updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void,
): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isMounted = true;

  const connect = () => {
    if (!isMounted) return;

    // فقط در محیط Capacitor (موبایل) اجازه اتصال WebSocket محلی می‌دهیم
    // در مرورگر وب به دلیل خطای Mixed Content فقط از MQTT استفاده می‌شود
    // @ts-expect-error Capacitor global is injected only in native mobile builds
    const isNative = typeof window !== "undefined" && window.Capacitor?.isNative;

    if (!isNative) {
      console.log("[LocalWS] Skipped: Not running in Native Capacitor App.");

      return;
    }

    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

    console.log(`[LocalWS] Attempting connection to ws://${localIp}:81`);
    ws = new WebSocket(`ws://${localIp}:81`);
    setLocalWs(ws);

    ws.onopen = () => {
      if (!isMounted) return;

      console.log("[LocalWS] Connected successfully to ESP32.");
      setIsLocal(true);
      ws?.send(JSON.stringify({ command: "get_state" }));
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;

      try {
        const data = JSON.parse(event.data);

        if (data.type === "state_sync" && data.states) {
          setPinsState(data.states);
          console.log("[LocalWS] Received full state sync:", data.states);
        } else if (data.pin !== undefined && data.state !== undefined) {
          dispatchLocalState(data.pin.toString(), data.state === 1 || data.state === true);
        }
      } catch (e) {
        console.error("[LocalWS] Message parsing error:", e);
      }
    };

    ws.onclose = () => {
      if (!isMounted) return;

      console.warn("[LocalWS] Disconnected. Falling back to Global (MQTT).");
      setIsLocal(false);
      setLocalWs(null);

      if (reconnectTimer !== null) clearTimeout(reconnectTimer);

      reconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = (_err) => {
      // Will trigger onclose automatically
    };
  };

  connect();

  return () => {
    isMounted = false;

    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
      ws = null;
    }

    setLocalWs(null);
    setIsLocal(false);
  };
}

export function useConnectionStrategy() {
  const localIp = useIoTStore((state) => state.localIp);
  const setIsLocal = useIoTStore((state) => state.setIsLocal);
  const setPinsState = useIoTStore((state) => state.setPinsState);

  useEffect(() => {
    if (!localIp) return;

    return connectLocalWebSocket(localIp, setIsLocal, setPinsState);
  }, [localIp, setIsLocal, setPinsState]);
}
