/**
 * Clean Architecture: Ports and Boundaries
 * These interfaces decouple core application use cases from concrete
 * external delivery, hardware protocols (MQTT / WebSocket), and cloud APIs.
 */

import { EspConfig } from "@/features/iot/services/config/types";

export interface PinAction {
  pin: string;
  state: boolean;
  timer?: number;
}

export interface AckResponse {
  success: boolean;
  message: string;
}

/**
 * Output Port: Device hardware command messaging
 */
export interface IDeviceCommandPort {
  publishPinCommand(pinId: string, value: boolean, timer?: number): void;
  publishBatchPinCommand(actions: PinAction[]): void;
  publishAddSegment(id: string, type: string, pin: number, value: boolean): void;
  publishDeleteSegment(id: string): void;
  publishPresence(isVisible: boolean): void;
}

/**
 * Output Port: Remote configuration persistence gateway
 */
export interface IConfigStoragePort {
  isAvailable(): boolean;
  fetchConfig(): Promise<EspConfig | null>;
  saveConfig(config: EspConfig): Promise<AckResponse>;
  updatePin(pin: string, value: boolean): Promise<AckResponse>;
  updateBatchPins(actions: Array<{ pin: string; state: boolean }>): Promise<AckResponse>;
}

export interface SinglePinSyncOptions {
  preventMqtt?: boolean;
  autoOff?: number;
  isPushMode?: boolean;
  showToast?: (message: string, type: "success" | "error") => void;
}

export interface BatchPinSyncOptions {
  segments?: Array<{ pin: string; auto_off?: number; mode?: string }>;
  isCfEnabled?: boolean;
  showToast?: (message: string, type: "success" | "error") => void;
}

/**
 * Output Port: Deep multi-transport device synchronization engine.
 * Decouples callers from transport selection (Local WS vs MQTT) and
 * Cloudflare persistence orchestration.
 */
export interface IDeviceSyncPort {
  syncSinglePin(pin: string, state: boolean, options?: SinglePinSyncOptions): Promise<void>;
  syncBatchPins(
    actions: Array<{ targetPin: string; actionOn: boolean }>,
    options?: BatchPinSyncOptions,
  ): Promise<void>;
}
