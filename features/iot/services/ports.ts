/**
 * Clean Architecture: Ports and Boundaries
 * These interfaces decouple core application use cases from concrete
 * external delivery, hardware protocols (MQTT / WebSocket), and cloud APIs.
 */

import type { EspConfig } from "@/features/iot/services/config/types";
import type { AnalogSegmentOptions } from "@/features/iot/utils/analogOutput";

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
  publishPinCommand(pinId: string, value: boolean, timer?: number): boolean;
  publishAnalogOutputCommand(pinId: string, value: number, timer?: number): boolean;
  publishBatchPinCommand(actions: PinAction[]): boolean;
  publishAddSegment(
    id: string,
    type: string,
    pin: number,
    value: boolean,
    analogOptions?: AnalogSegmentOptions,
  ): void;
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
  updateAnalogPin(pin: string, analogValue: number): Promise<AckResponse>;
  updateBatchPins(actions: Array<{ pin: string; state: boolean }>): Promise<AckResponse>;
}

export interface SinglePinSyncOptions {
  preventMqtt?: boolean;
  autoOff?: number;
  isPushMode?: boolean;
  showToast?: (message: string, type: "success" | "error") => void;
}

export interface AnalogPinSyncOptions {
  preventMqtt?: boolean;
  autoOff?: number;
  /** When false (e.g. during live slider drag), skips Cloudflare HTTP write until commit. */
  persistToCloud?: boolean;
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
  syncSinglePin(pin: string, state: boolean, options?: SinglePinSyncOptions): Promise<boolean>;
  syncAnalogPin(pin: string, value: number, options?: AnalogPinSyncOptions): Promise<boolean>;
  syncBatchPins(
    actions: Array<{ targetPin: string; actionOn: boolean }>,
    options?: BatchPinSyncOptions,
  ): Promise<boolean>;
}
