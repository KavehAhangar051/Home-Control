"use client";

import { useEffect } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  dispatchLocalState,
  type MinimalLocalSocket,
  setLocalWs,
} from "@/features/iot/services/localWs/client";
import { computeFullJitterDelayMs } from "@/lib/resilience";

const LOCAL_WS_RECONNECT_BASE_MS = 1000;
const LOCAL_WS_RECONNECT_MAX_MS = 30_000;

export interface LocalWebSocketLike {
  readyState: number;
  onopen: ((ev: Event) => void) | (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((ev: CloseEvent) => void) | (() => void) | null;
  onerror: ((err: Event) => void) | null;
  send: (data: string) => void;
  close: () => void;
}

export interface LocalWebSocketControllerDeps {
  localIp: string;
  setIsLocal: (val: boolean) => void;
  setPinsState: (
    updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  setAutoOffRemaining?: (timers: Record<string, number>) => void;
  isNativeRuntime?: () => boolean;
  createWebSocket?: (url: string) => LocalWebSocketLike;
  setLocalWs?: (ws: MinimalLocalSocket | null) => void;
  dispatchLocalState?: (pin: string, state: boolean) => void;
  scheduleTimeout?: (fn: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
  randomFn?: () => number;
}

/**
 * Dependency-injected Local WebSocket transport controller for Capacitor native builds.
 * Handles handshake (`get_state`), incoming `state_sync` / pin updates, fallback to MQTT,
 * and bounded exponential backoff + full jitter reconnects.
 */
export function createLocalWebSocketController(deps: LocalWebSocketControllerDeps): () => void {
  const isNativeRuntime =
    deps.isNativeRuntime ??
    (() =>
      // @ts-expect-error Capacitor global is injected only in native mobile builds
      typeof window !== "undefined" && Boolean(window.Capacitor?.isNative));

  // SAFETY: Native browser WebSocket implements LocalWebSocketLike handler slots and send/close
  const createWebSocket =
    deps.createWebSocket ?? ((url: string) => new WebSocket(url) as LocalWebSocketLike);

  const setLocalWsFn = deps.setLocalWs ?? setLocalWs;
  const dispatchLocalStateFn = deps.dispatchLocalState ?? dispatchLocalState;
  const scheduleTimeout = deps.scheduleTimeout ?? ((fn, delayMs) => setTimeout(fn, delayMs));
  const clearTimeoutFn = deps.clearTimeoutFn ?? ((id) => clearTimeout(id));
  const randomFn = deps.randomFn ?? Math.random;

  let ws: LocalWebSocketLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let synchronizedTimers: Record<string, number> = {};
  let isMounted = true;

  const WS_CONNECTING = 0;
  const WS_OPEN = 1;

  const connect = () => {
    if (!isMounted) return;

    // فقط در محیط Capacitor (موبایل) اجازه اتصال WebSocket محلی می‌دهیم
    // در مرورگر وب به دلیل خطای Mixed Content فقط از MQTT استفاده می‌شود
    if (!isNativeRuntime()) {
      console.log("[LocalWS] Skipped: Not running in Native Capacitor App.");
      return;
    }

    if (ws?.readyState === WS_OPEN || ws?.readyState === WS_CONNECTING) return;

    console.log(`[LocalWS] Attempting connection to ws://${deps.localIp}:81`);
    ws = createWebSocket(`ws://${deps.localIp}:81`);
    setLocalWsFn(ws);

    ws.onopen = () => {
      if (!isMounted) return;

      reconnectAttempt = 0;
      console.log("[LocalWS] Connected successfully to ESP32.");
      deps.setIsLocal(true);
      ws?.send(JSON.stringify({ command: "get_state" }));
    };

    ws.onmessage = (event) => {
      if (!isMounted) return;

      try {
        const data = JSON.parse(event.data);

        if (data.type === "state_sync" && data.states) {
          deps.setPinsState(data.states);
          // Missing timer metadata in a full snapshot must clear any previous
          // countdown instead of falling back to the configured full duration.
          synchronizedTimers = {};
          for (const pin of Object.keys(data.states)) {
            synchronizedTimers[pin] = 0;
          }
          if (data.timers && typeof data.timers === "object") {
            for (const [pin, value] of Object.entries(data.timers)) {
              const seconds = Number(value);
              const pinState = data.states[pin];
              const isPinOn = pinState === true || pinState === 1 || pinState === "1" || pinState === "true";
              synchronizedTimers[pin] =
                isPinOn && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
            }
          }
          deps.setAutoOffRemaining?.(synchronizedTimers);
          console.log("[LocalWS] Received full state sync:", data.states, synchronizedTimers);
        } else if (data.pin !== undefined && data.state !== undefined) {
          const pinKey = data.pin.toString();
          const pinBool = data.state === 1 || data.state === true;
          deps.setPinsState((prev) => ({ ...prev, [pinKey]: pinBool }));
          synchronizedTimers = { ...synchronizedTimers, [pinKey]: 0 };
          deps.setAutoOffRemaining?.(synchronizedTimers);
          dispatchLocalStateFn(pinKey, pinBool);
        }
      } catch (e) {
        console.error("[LocalWS] Message parsing error:", e);
      }
    };

    ws.onclose = () => {
      if (!isMounted) return;

      ws = null;
      console.warn("[LocalWS] Disconnected. Falling back to Global (MQTT).");
      deps.setIsLocal(false);
      setLocalWsFn(null);

      if (reconnectTimer !== null) clearTimeoutFn(reconnectTimer);

      const delayMs = computeFullJitterDelayMs(
        reconnectAttempt,
        LOCAL_WS_RECONNECT_BASE_MS,
        LOCAL_WS_RECONNECT_MAX_MS,
        randomFn,
      );

      reconnectAttempt += 1;
      reconnectTimer = scheduleTimeout(connect, delayMs);
    };

    ws.onerror = (_err) => {
      // Will trigger onclose automatically
    };
  };

  connect();

  return () => {
    isMounted = false;

    if (reconnectTimer !== null) {
      clearTimeoutFn(reconnectTimer);
      reconnectTimer = null;
    }

    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
      ws = null;
      setLocalWsFn(null);
      deps.setIsLocal(false);
    }
  };
}

export function useConnectionStrategy() {
  const localIp = useIoTStore((state) => state.localIp);
  const setIsLocal = useIoTStore((state) => state.setIsLocal);
  const setPinsState = useIoTStore((state) => state.setPinsState);
  const setAutoOffRemaining = useIoTStore((state) => state.setAutoOffRemaining);

  useEffect(() => {
    if (!localIp) return;

    return createLocalWebSocketController({
      localIp,
      setIsLocal,
      setPinsState,
      setAutoOffRemaining,
    });
  }, [localIp, setIsLocal, setPinsState, setAutoOffRemaining]);
}
