import type { Segment } from "@/features/iot/hooks/store/types";
import type { EspConfig } from "./config/types";

export type PinsStateUpdater =
  | Record<string, boolean>
  | ((prev: Record<string, boolean>) => Record<string, boolean>);

export type PinsNumberUpdater =
  | Record<string, number>
  | ((prev: Record<string, number>) => Record<string, number>);

/**
 * Clean Architecture Dependency Inversion Bridge:
 * Allows outer/service-layer adapters (MQTT, LocalWS, DeviceSync) to read and update
 * application state without importing React/Zustand UI hooks directly.
 */
export interface IoTStoreBridge {
  isLocal: boolean;
  isPageVisible: boolean;
  localIp: string | null;
  segments: Segment[];
  mqttConfig: EspConfig["mqtt"] | null;
  showToast: (message: string, type: "success" | "error") => void;
  setIsLocal: (val: boolean) => void;
  setLocalIp: (ip: string | null) => void;
  setPinsState: (updater: PinsStateUpdater) => void;
  pinsAnalogValue: Record<string, number>;
  pinsLastNonZeroValue: Record<string, number>;
  pinsPwmResolution: Record<string, number>;
  setPinsAnalogValue: (updater: PinsNumberUpdater) => void;
  setPinsLastNonZeroValue: (updater: PinsNumberUpdater) => void;
  setPinsPwmResolution: (updater: PinsNumberUpdater) => void;
  autoOffRemaining: Record<string, number>;
  setAutoOffRemaining: (timers: Record<string, number>) => void;
}

const NOOP_BRIDGE: IoTStoreBridge = {
  isLocal: false,
  isPageVisible: true,
  localIp: null,
  segments: [],
  mqttConfig: null,
  showToast: () => {},
  setIsLocal: () => {},
  setLocalIp: () => {},
  setPinsState: () => {},
  pinsAnalogValue: {},
  pinsLastNonZeroValue: {},
  pinsPwmResolution: {},
  setPinsAnalogValue: () => {},
  setPinsLastNonZeroValue: () => {},
  setPinsPwmResolution: () => {},
  autoOffRemaining: {},
  setAutoOffRemaining: () => {},
};

let storeSnapshotProvider: (() => IoTStoreBridge) | null = null;

/**
 * Registers the live store snapshot accessor at the composition root (`useIoTStore`).
 */
export function registerIoTStoreBridge(provider: () => IoTStoreBridge): void {
  storeSnapshotProvider = provider;
}

/**
 * Returns the latest registered store state snapshot, or a safe no-op fallback in isolated contexts.
 */
export function getIoTStoreSnapshot(): IoTStoreBridge {
  return storeSnapshotProvider ? storeSnapshotProvider() : NOOP_BRIDGE;
}
