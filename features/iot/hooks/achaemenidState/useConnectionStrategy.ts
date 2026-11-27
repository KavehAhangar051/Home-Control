"use client";

import { useEffect } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  dispatchLocalState,
  type MinimalLocalSocket,
  setLocalWs,
} from "@/features/iot/services/localWs/client";
import { notifyPinCommandAck } from "@/features/iot/services/pinAckBus";
import { computeFullJitterDelayMs } from "@/lib/resilience";

const LOCAL_WS_RECONNECT_BASE_MS = 1000;
const LOCAL_WS_RECONNECT_MAX_MS = 30_000;
const LOCAL_WS_HANDSHAKE_TIMEOUT_MS = 5_000;
const LOCAL_WS_DISCOVERY_RETRY_MS = 400;
export const LOCAL_WS_HOST_STORAGE_KEY = "home-control:local-ws-host";
const DEFAULT_LOCAL_WS_HOSTS = ["achaemenid.local", "192.168.4.1"] as const;

type LocalWsHostStorage = Pick<Storage, "getItem" | "setItem">;

function normalizeLocalWsHost(value: string | null | undefined): string | null {
  if (!value) return null;
  let host = value.trim();
  if (host.toLowerCase().startsWith("ws://")) host = host.slice(5);
  else if (host.toLowerCase().startsWith("wss://")) host = host.slice(6);
  host = host.split("/")[0].replace(/:81$/, "");
  return /^[a-z0-9.-]+$/i.test(host) ? host : null;
}

export function resolveLocalWebSocketCandidates(
  localIp?: string | null,
  storage?: Pick<Storage, "getItem"> | null,
): string[] {
  let rememberedHost: string | null = null;
  try {
    const activeStorage =
      storage !== undefined ? storage : typeof window !== "undefined" ? window.localStorage : null;
    rememberedHost = activeStorage?.getItem(LOCAL_WS_HOST_STORAGE_KEY) ?? null;
  } catch {}
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const rawHost of [localIp, rememberedHost, ...DEFAULT_LOCAL_WS_HOSTS]) {
    const host = normalizeLocalWsHost(rawHost);
    if (host && !seen.has(host)) {
      seen.add(host);
      candidates.push(host);
    }
  }
  return candidates;
}

function isCapacitorNativeRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (
    window as Window & {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        isNative?: boolean;
        getPlatform?: () => string;
      };
    }
  ).Capacitor;
  if (typeof capacitor?.isNativePlatform === "function") return capacitor.isNativePlatform();
  if (typeof capacitor?.isNative === "boolean") return capacitor.isNative;
  return typeof capacitor?.getPlatform === "function" && capacitor.getPlatform() !== "web";
}

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
  localIp?: string | null;
  setIsLocal: (val: boolean) => void;
  setPinsState: (
    updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  setAutoOffRemaining?: (timers: Record<string, number>) => void;
  setPinsAnalogValue?: (
    updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
  setPinsLastNonZeroValue?: (
    updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
  setPinsPwmResolution?: (
    updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
  updateAuxNodesOnlineStatus?: (nodes: Array<{ id: number; online: boolean }>) => void;
  showToast?: (message: string, type: "error" | "success") => void;
  isNativeRuntime?: () => boolean;
  createWebSocket?: (url: string) => LocalWebSocketLike;
  setLocalWs?: (ws: MinimalLocalSocket | null) => void;
  dispatchLocalState?: (pin: string, state: boolean) => void;
  onCommandAck?: (pinId: string) => void;
  scheduleTimeout?: (fn: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
  randomFn?: () => number;
  setIsLocalWebSocketConnected?: (connected: boolean) => void;
  getIsMqttDeviceOnline?: () => boolean;
  storage?: LocalWsHostStorage | null;
  handshakeTimeoutMs?: number;
  discoveryRetryMs?: number;
}

/**
 * Dependency-injected Local WebSocket transport controller for Capacitor native builds.
 * Handles handshake (`get_state`), incoming `state_sync` / pin updates, fallback to MQTT,
 * and bounded exponential backoff + full jitter reconnects.
 */
export function createLocalWebSocketController(deps: LocalWebSocketControllerDeps): () => void {
  const isNativeRuntime = deps.isNativeRuntime ?? isCapacitorNativeRuntime;

  // SAFETY: Native browser WebSocket implements LocalWebSocketLike handler slots and send/close
  const createWebSocket =
    deps.createWebSocket ?? ((url: string) => new WebSocket(url) as LocalWebSocketLike);

  const setLocalWsFn = deps.setLocalWs ?? setLocalWs;
  const dispatchLocalStateFn = deps.dispatchLocalState ?? dispatchLocalState;
  const scheduleTimeout = deps.scheduleTimeout ?? ((fn, delayMs) => setTimeout(fn, delayMs));
  const clearTimeoutFn = deps.clearTimeoutFn ?? ((id) => clearTimeout(id));
  const randomFn = deps.randomFn ?? Math.random;

  const candidates = resolveLocalWebSocketCandidates(deps.localIp, deps.storage);
  let ws: LocalWebSocketLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let candidateIndex = 0;
  let candidateFailures = 0;
  let synchronizedTimers: Record<string, number> = {};
  let isConnected = false;
  let isMounted = true;
  const WS_CONNECTING = 0;
  const WS_OPEN = 1;

  const clearHandshakeTimer = () => {
    if (handshakeTimer !== null) {
      clearTimeoutFn(handshakeTimer);
      handshakeTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (!isMounted) return;
    if (reconnectTimer !== null) clearTimeoutFn(reconnectTimer);
    candidateFailures += 1;
    const delayMs =
      candidateFailures < candidates.length
        ? (deps.discoveryRetryMs ?? LOCAL_WS_DISCOVERY_RETRY_MS)
        : computeFullJitterDelayMs(
            reconnectAttempt++,
            LOCAL_WS_RECONNECT_BASE_MS,
            LOCAL_WS_RECONNECT_MAX_MS,
            randomFn,
          );
    if (candidateFailures >= candidates.length) candidateFailures = 0;
    reconnectTimer = scheduleTimeout(connect, delayMs);
  };

  const connect = () => {
    if (!isMounted) return;
    if (!isNativeRuntime()) {
      console.log("[LocalWS] Skipped: not running inside a native Capacitor app.");
      deps.setIsLocalWebSocketConnected?.(false);
      return;
    }
    if (ws?.readyState === WS_OPEN || ws?.readyState === WS_CONNECTING) return;

    const hostIndex = candidateIndex % candidates.length;
    const host = candidates[hostIndex];
    candidateIndex = (hostIndex + 1) % candidates.length;
    console.log(`[LocalWS] Probing ESP32 at ws://${host}:81`);

    let socket: LocalWebSocketLike;
    try {
      socket = createWebSocket(`ws://${host}:81`);
    } catch (error) {
      console.warn(`[LocalWS] Could not create socket for ${host}:`, error);
      scheduleReconnect();
      return;
    }

    ws = socket;
    isConnected = false;
    setLocalWsFn(socket);
    handshakeTimer = scheduleTimeout(() => {
      if (!isMounted || ws !== socket || isConnected) return;
      console.warn(`[LocalWS] No valid ESP32 state handshake from ${host}; trying another host.`);
      socket.close();
    }, deps.handshakeTimeoutMs ?? LOCAL_WS_HANDSHAKE_TIMEOUT_MS);

    socket.onopen = () => {
      if (!isMounted || ws !== socket) return;
      try {
        socket.send(JSON.stringify({ command: "client_hello", client: "capacitor-dashboard" }));
        socket.send(JSON.stringify({ command: "get_state" }));
      } catch (error) {
        console.warn("[LocalWS] Failed to start the local handshake:", error);
        socket.close();
      }
    };

    socket.onmessage = (event) => {
      if (!isMounted) return;

      try {
        const data = JSON.parse(event.data);
        if (
          data.type === "state_sync" &&
          data.states &&
          typeof data.states === "object" &&
          !Array.isArray(data.states) &&
          !isConnected
        ) {
          isConnected = true;
          reconnectAttempt = 0;
          candidateFailures = 0;
          candidateIndex = hostIndex;
          if (handshakeTimer !== null) {
            clearTimeoutFn(handshakeTimer);
            handshakeTimer = null;
          }
          deps.setIsLocalWebSocketConnected?.(true);
          deps.setIsLocal(true);
          try {
            const activeStorage =
              deps.storage !== undefined
                ? deps.storage
                : typeof window !== "undefined"
                  ? window.localStorage
                  : null;
            activeStorage?.setItem(LOCAL_WS_HOST_STORAGE_KEY, host);
          } catch {}
          console.info("[LocalWS] ESP32 state handshake confirmed; local transport is active.");
        }

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
              const isPinOn =
                pinState === true || pinState === 1 || pinState === "1" || pinState === "true";
              synchronizedTimers[pin] =
                isPinOn && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
            }
          }
          deps.setAutoOffRemaining?.(synchronizedTimers);

          if (data.values && typeof data.values === "object" && !Array.isArray(data.values)) {
            const syncedValues: Record<string, number> = {};
            for (const [pin, val] of Object.entries(data.values)) {
              const num = Number(val);
              if (Number.isFinite(num)) {
                syncedValues[pin] = Math.min(4095, Math.max(0, Math.round(num)));
              }
            }
            deps.setPinsAnalogValue?.(syncedValues);
            deps.setPinsLastNonZeroValue?.((prev) => {
              const next = { ...prev };
              let changed = false;
              for (const [pin, val] of Object.entries(syncedValues)) {
                if (val > 0 && next[pin] !== val) {
                  next[pin] = val;
                  changed = true;
                }
              }
              return changed ? next : prev;
            });
          }

          if (
            data.resolutions &&
            typeof data.resolutions === "object" &&
            !Array.isArray(data.resolutions)
          ) {
            const syncedResolutions: Record<string, number> = {};
            for (const [pin, res] of Object.entries(data.resolutions)) {
              const num = Number(res);
              if (Number.isFinite(num) && num >= 8 && num <= 12) {
                syncedResolutions[pin] = Math.round(num);
              }
            }
            deps.setPinsPwmResolution?.(syncedResolutions);
          }

          if (Array.isArray(data.nodes)) {
            const parsedNodes: Array<{ id: number; online: boolean }> = [];
            for (const entry of data.nodes) {
              if (!entry || typeof entry !== "object") continue;
              const id = Number(entry.id);
              if (!Number.isInteger(id) || id < 1 || id > 16) continue;
              parsedNodes.push({ id, online: Boolean(entry.online) });
            }
            if (parsedNodes.length > 0) {
              deps.updateAuxNodesOnlineStatus?.(parsedNodes);
            }
          }

          console.log("[LocalWS] Received full state sync:", data.states, synchronizedTimers);
        } else if (data.type === "aux_node_ack") {
          const actionText =
            data.action === "delete"
              ? `برد کمکی #${data.id ?? ""} از ESP32 مرکزی حذف شد.`
              : `برد کمکی #${data.id ?? ""} در حافظه ESP32 مرکزی ذخیره شد.`;
          deps.showToast?.(actionText, "success");
        } else if (data.type === "command_ack" && data.pin !== undefined) {
          // Command receipt confirmations NEVER mutate pin state, analog value, or timers.
          (deps.onCommandAck ?? notifyPinCommandAck)(data.pin.toString());
        } else if (
          data.pin !== undefined &&
          (data.state !== undefined || data.value !== undefined)
        ) {
          const pinKey = data.pin.toString();
          const hasAnalogVal = typeof data.value === "number" && Number.isFinite(data.value);
          const analogVal = hasAnalogVal
            ? Math.min(4095, Math.max(0, Math.round(data.value)))
            : undefined;
          const pinBool =
            data.state !== undefined
              ? data.state === 1 || data.state === true
              : analogVal !== undefined
                ? analogVal > 0
                : false;

          deps.setPinsState((prev) => ({ ...prev, [pinKey]: pinBool }));

          if (analogVal !== undefined) {
            deps.setPinsAnalogValue?.((prev) => ({ ...prev, [pinKey]: analogVal }));
            if (analogVal > 0) {
              deps.setPinsLastNonZeroValue?.((prev) => ({ ...prev, [pinKey]: analogVal }));
            }
          } else if (!pinBool) {
            deps.setPinsAnalogValue?.((prev) =>
              Object.hasOwn(prev, pinKey) ? { ...prev, [pinKey]: 0 } : prev,
            );
          }

          if (
            typeof data.resolution === "number" &&
            Number.isFinite(data.resolution) &&
            data.resolution >= 8 &&
            data.resolution <= 12
          ) {
            const res = Math.round(data.resolution);
            deps.setPinsPwmResolution?.((prev) => ({ ...prev, [pinKey]: res }));
          }

          synchronizedTimers = { ...synchronizedTimers, [pinKey]: 0 };
          deps.setAutoOffRemaining?.(synchronizedTimers);
          dispatchLocalStateFn(pinKey, pinBool);
        }
      } catch (e) {
        console.error("[LocalWS] Message parsing error:", e);
      }
    };

    socket.onclose = () => {
      if (!isMounted || ws !== socket) return;
      const wasConnected = isConnected;
      clearHandshakeTimer();
      ws = null;
      isConnected = false;
      if (wasConnected) candidateIndex = (hostIndex + 1) % candidates.length;
      deps.setIsLocalWebSocketConnected?.(false);
      deps.setIsLocal(deps.getIsMqttDeviceOnline?.() ?? false);
      setLocalWsFn(null);
      console.warn("[LocalWS] Local connection closed; trying the next discovery target.");
      scheduleReconnect();
    };
    socket.onerror = () => {
      if (ws === socket) socket.close();
    };
  };
  connect();

  return () => {
    isMounted = false;

    if (reconnectTimer !== null) {
      clearTimeoutFn(reconnectTimer);
      reconnectTimer = null;
    }
    clearHandshakeTimer();
    if (ws) {
      const activeSocket = ws;
      ws = null;
      activeSocket.onopen = null;
      activeSocket.onmessage = null;
      activeSocket.onclose = null;
      activeSocket.onerror = null;
      activeSocket.close();
      setLocalWsFn(null);
    }
    isConnected = false;
    deps.setIsLocalWebSocketConnected?.(false);
    deps.setIsLocal(deps.getIsMqttDeviceOnline?.() ?? false);
  };
}

export function useConnectionStrategy() {
  const localIp = useIoTStore((state) => state.localIp);
  const setIsLocal = useIoTStore((state) => state.setIsLocal);
  const setIsLocalWebSocketConnected = useIoTStore((state) => state.setIsLocalWebSocketConnected);
  const setPinsState = useIoTStore((state) => state.setPinsState);
  const setAutoOffRemaining = useIoTStore((state) => state.setAutoOffRemaining);
  const setPinsAnalogValue = useIoTStore((state) => state.setPinsAnalogValue);
  const setPinsLastNonZeroValue = useIoTStore((state) => state.setPinsLastNonZeroValue);
  const setPinsPwmResolution = useIoTStore((state) => state.setPinsPwmResolution);
  const updateAuxNodesOnlineStatus = useIoTStore((state) => state.updateAuxNodesOnlineStatus);
  const showToast = useIoTStore((state) => state.showToast);

  useEffect(() => {
    return createLocalWebSocketController({
      localIp,
      setIsLocal,
      setIsLocalWebSocketConnected,
      getIsMqttDeviceOnline: () => useIoTStore.getState().isMqttDeviceOnline,
      setPinsState,
      setAutoOffRemaining,
      setPinsAnalogValue,
      setPinsLastNonZeroValue,
      setPinsPwmResolution,
      updateAuxNodesOnlineStatus,
      showToast,
    });
  }, [
    localIp,
    setIsLocal,
    setIsLocalWebSocketConnected,
    setPinsState,
    setAutoOffRemaining,
    setPinsAnalogValue,
    setPinsLastNonZeroValue,
    setPinsPwmResolution,
    updateAuxNodesOnlineStatus,
    showToast,
  ]);
}
