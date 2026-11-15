/**
 * Interface Adapters Layer (Clean Architecture)
 * Concrete adapter implementing the IDeviceCommandPort and IConfigStoragePort.
 * Translates application requests into concrete external services (MQTT / Cloudflare).
 */

import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  fetchConfigFromCloudflare,
  isCloudflareEnabled,
  saveConfigToCloudflare,
  updateBatchPinsOnCloudflare,
  updatePinOnCloudflare,
} from "./cloudflareService";
import type { EspConfig } from "./config/types";
import { getLocalWs } from "./localWs/client";
import {
  publishAddSegmentCommand as mqttAddSegment,
  publishDeleteSegmentCommand as mqttDeleteSegment,
  publishBatchPinCommand as mqttPublishBatch,
  publishPinCommand as mqttPublishPin,
  publishPresence as mqttPublishPresence,
} from "./mqttService";
import type {
  AckResponse,
  BatchPinSyncOptions,
  IConfigStoragePort,
  IDeviceCommandPort,
  IDeviceSyncPort,
  PinAction,
  SinglePinSyncOptions,
} from "./ports";

export class DeviceCommandAdapter implements IDeviceCommandPort {
  publishPinCommand(pinId: string, value: boolean, timer?: number): boolean {
    return mqttPublishPin(pinId, value, timer);
  }

  publishBatchPinCommand(actions: PinAction[]): boolean {
    return mqttPublishBatch(actions);
  }

  publishAddSegment(id: string, type: string, pin: number, value: boolean): void {
    mqttAddSegment(id, type, pin, value);
  }

  publishDeleteSegment(id: string): void {
    mqttDeleteSegment(id);
  }

  publishPresence(isVisible: boolean): void {
    mqttPublishPresence(isVisible);
  }
}

export class CloudflareStorageAdapter implements IConfigStoragePort {
  isAvailable(): boolean {
    return isCloudflareEnabled();
  }

  fetchConfig(): Promise<EspConfig | null> {
    return fetchConfigFromCloudflare();
  }

  saveConfig(config: EspConfig): Promise<AckResponse> {
    return saveConfigToCloudflare(config);
  }

  updatePin(pin: string, value: boolean): Promise<AckResponse> {
    return updatePinOnCloudflare(pin, value);
  }

  updateBatchPins(actions: Array<{ pin: string; state: boolean }>): Promise<AckResponse> {
    return updateBatchPinsOnCloudflare(actions);
  }
}

/**
 * Deep multi-transport production adapter:
 * Coordinates local WebSocket, MQTT binary transmission, and Cloudflare Durable Object persistence.
 */
export class LiveDeviceSyncAdapter implements IDeviceSyncPort {
  async syncSinglePin(
    pin: string,
    state: boolean,
    options?: SinglePinSyncOptions,
  ): Promise<boolean> {
    const isLocal = useIoTStore.getState().isLocal;
    const ws = getLocalWs();
    let wsSent = false;
    let mqttSent = false;
    let cfSucceeded = false;
    let cfAttempted = false;
    let cfShowedToast = false;

    if (isLocal && ws?.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          command: "set_state",
          pin: Number(pin) | 0,
          state: state ? 1 : 0,
          timer: options?.autoOff,
        }),
      );
      wsSent = true;
    } else if (!options?.preventMqtt) {
      mqttSent = mqttPublishPin(pin, state, options?.autoOff);
    }

    const resolvedPushMode =
      options?.isPushMode !== undefined
        ? options.isPushMode
        : useIoTStore.getState().segments.find((s) => s.pin === pin)?.mode === "push";

    const toast = options?.showToast || useIoTStore.getState().showToast;

    if (isCloudflareEnabled() && !resolvedPushMode) {
      cfAttempted = true;

      try {
        const result = await updatePinOnCloudflare(pin, state);
        cfSucceeded = result.success;

        if (toast && result.message) {
          toast(result.message, result.success ? "success" : "error");
          cfShowedToast = true;
        }
      } catch (e) {
        console.error(`Failed to sync pin ${pin} value to Cloudflare:`, e);
      }
    }

    if (options?.preventMqtt) {
      return !cfAttempted || cfSucceeded;
    }

    const delivered = wsSent || mqttSent || cfSucceeded;

    if (!delivered && toast && !cfShowedToast) {
      toast("ارتباط با دستگاه (MQTT/سرور) برقرار نیست؛ دستور ارسال نشد.", "error");
    }

    return delivered;
  }

  async syncBatchPins(
    actions: Array<{ targetPin: string; actionOn: boolean }>,
    options?: BatchPinSyncOptions,
  ): Promise<boolean> {
    const actionsLen = actions.length;

    if (actionsLen === 0) return false;

    const availableSegments = options?.segments ?? useIoTStore.getState().segments;
    const cfEnabled = options?.isCfEnabled ?? isCloudflareEnabled();

    const mqttActions: { pin: string; state: boolean; timer?: number }[] = [];
    const cfActions: { pin: string; state: boolean }[] = [];

    const segmentMap = new Map<string, { auto_off?: number; mode?: string }>();

    for (let i = 0; i < availableSegments.length; i++) {
      segmentMap.set(availableSegments[i].pin, availableSegments[i]);
    }

    for (let i = 0; i < actionsLen; i++) {
      const action = actions[i];
      const segment = segmentMap.get(action.targetPin);
      mqttActions.push({ pin: action.targetPin, state: action.actionOn, timer: segment?.auto_off });

      if (cfEnabled && segment?.mode !== "push") {
        cfActions.push({ pin: action.targetPin, state: action.actionOn });
      }
    }

    const isLocal = useIoTStore.getState().isLocal;
    const ws = getLocalWs();
    let wsSent = false;
    let mqttSent = false;
    let cfSucceeded = false;
    let cfShowedToast = false;

    if (isLocal && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ command: "batch_state", actions: mqttActions }));
      wsSent = true;
    } else {
      mqttSent = mqttPublishBatch(mqttActions);
    }

    const toast = options?.showToast || useIoTStore.getState().showToast;

    if (cfActions.length > 0) {
      try {
        const result = await updateBatchPinsOnCloudflare(cfActions);
        cfSucceeded = result.success;

        if (toast && result.message) {
          toast(result.message, result.success ? "success" : "error");
          cfShowedToast = true;
        }
      } catch (e) {
        console.error("Failed to batch sync pins to Cloudflare:", e);
      }
    }

    const delivered = wsSent || mqttSent || cfSucceeded;

    if (!delivered && toast && !cfShowedToast) {
      toast("ارتباط با دستگاه (MQTT/سرور) برقرار نیست؛ دستور گروهی ارسال نشد.", "error");
    }

    return delivered;
  }
}

/**
 * In-memory test & simulation adapter:
 * Tracks dispatches in-memory with zero network I/O for deterministic testing.
 */
export class InMemoryDeviceSyncAdapter implements IDeviceSyncPort {
  public pinsState = new Map<string, boolean>();
  public dispatchLog: Array<{ type: "single" | "batch"; payload: unknown; timestamp: number }> = [];

  async syncSinglePin(
    pin: string,
    state: boolean,
    options?: SinglePinSyncOptions,
  ): Promise<boolean> {
    this.pinsState.set(pin, state);
    this.dispatchLog.push({
      type: "single",
      payload: { pin, state, options },
      timestamp: Date.now(),
    });

    if (options?.showToast) {
      options.showToast(`[Simulation] Pin ${pin} synced to ${state}`, "success");
    }

    return true;
  }

  async syncBatchPins(
    actions: Array<{ targetPin: string; actionOn: boolean }>,
    options?: BatchPinSyncOptions,
  ): Promise<boolean> {
    for (const a of actions) {
      this.pinsState.set(a.targetPin, a.actionOn);
    }

    this.dispatchLog.push({ type: "batch", payload: { actions, options }, timestamp: Date.now() });

    if (options?.showToast) {
      options.showToast(`[Simulation] ${actions.length} pins batch synced`, "success");
    }

    return true;
  }

  reset(): void {
    this.pinsState.clear();
    this.dispatchLog = [];
  }
}

export const defaultDeviceCommandGateway = new DeviceCommandAdapter();
export const defaultStorageGateway = new CloudflareStorageAdapter();
export const defaultDeviceSyncGateway: IDeviceSyncPort = new LiveDeviceSyncAdapter();
