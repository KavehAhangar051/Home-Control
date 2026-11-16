/**
 * Interface Adapters Layer (Clean Architecture)
 * Concrete adapter implementing the IDeviceCommandPort and IConfigStoragePort.
 * Translates application requests into concrete external services (MQTT / Cloudflare).
 */

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
  publishBatchPinCommand as mqttPublishBatch,
  publishPinCommand as mqttPublishPin,
} from "./mqtt/pinPublishers";
import {
  publishAddSegmentCommand as mqttAddSegment,
  publishDeleteSegmentCommand as mqttDeleteSegment,
} from "./mqtt/segmentPublishers";
import { publishPresence as mqttPublishPresence } from "./mqtt/systemPublishers";
import type {
  AckResponse,
  BatchPinSyncOptions,
  IConfigStoragePort,
  IDeviceCommandPort,
  IDeviceSyncPort,
  PinAction,
  SinglePinSyncOptions,
} from "./ports";
import { getIoTStoreSnapshot } from "./storeBridge";

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

export interface LocalWsSocketLike {
  readyState: number;
  send(data: string): void;
}

export interface LiveDeviceSyncDependencies {
  getIsLocal?: () => boolean;
  getSegments?: () => Array<{ pin: string; auto_off?: number; mode?: string }>;
  getShowToast?: () => ((message: string, type: "success" | "error") => void) | undefined;
  getLocalWs?: () => LocalWsSocketLike | null;
  publishPinCommand?: (pinId: string, value: boolean, timer?: number) => boolean;
  publishBatchPinCommand?: (actions: PinAction[]) => boolean;
  isCloudflareEnabled?: () => boolean;
  updatePinOnCloudflare?: (pin: string, value: boolean) => Promise<AckResponse>;
  updateBatchPinsOnCloudflare?: (
    actions: Array<{ pin: string; state: boolean }>,
  ) => Promise<AckResponse>;
}

const WS_OPEN_READY_STATE = 1;

/**
 * Deep multi-transport production adapter:
 * Coordinates local WebSocket, MQTT binary transmission, and Cloudflare Durable Object persistence.
 */
export class LiveDeviceSyncAdapter implements IDeviceSyncPort {
  private readonly deps: Required<LiveDeviceSyncDependencies>;

  constructor(dependencies: LiveDeviceSyncDependencies = {}) {
    this.deps = {
      getIsLocal: dependencies.getIsLocal ?? (() => getIoTStoreSnapshot().isLocal),
      getSegments: dependencies.getSegments ?? (() => getIoTStoreSnapshot().segments),
      getShowToast: dependencies.getShowToast ?? (() => getIoTStoreSnapshot().showToast),
      getLocalWs: dependencies.getLocalWs ?? (() => getLocalWs()),
      publishPinCommand: dependencies.publishPinCommand ?? mqttPublishPin,
      publishBatchPinCommand: dependencies.publishBatchPinCommand ?? mqttPublishBatch,
      isCloudflareEnabled: dependencies.isCloudflareEnabled ?? isCloudflareEnabled,
      updatePinOnCloudflare: dependencies.updatePinOnCloudflare ?? updatePinOnCloudflare,
      updateBatchPinsOnCloudflare:
        dependencies.updateBatchPinsOnCloudflare ?? updateBatchPinsOnCloudflare,
    };
  }

  private dispatchHardwareCommand(wsPayload: unknown, mqttSend: () => boolean): boolean {
    const isLocal = this.deps.getIsLocal();
    const ws = this.deps.getLocalWs();

    if (isLocal && ws?.readyState === WS_OPEN_READY_STATE) {
      ws.send(JSON.stringify(wsPayload));

      return true;
    }

    return mqttSend();
  }

  private async persistToCloudflareWithToast(
    toast: ((message: string, type: "success" | "error") => void) | undefined,
    persistFn: () => Promise<AckResponse>,
    logErrorLabel: string,
  ): Promise<{ succeeded: boolean; showedToast: boolean }> {
    try {
      const result = await persistFn();

      if (toast && result.message) {
        toast(result.message, result.success ? "success" : "error");

        return { succeeded: result.success, showedToast: true };
      }

      return { succeeded: result.success, showedToast: false };
    } catch (e) {
      console.error(logErrorLabel, e);

      return { succeeded: false, showedToast: false };
    }
  }

  private notifyIfOffline(
    delivered: boolean,
    cfShowedToast: boolean,
    toast: ((message: string, type: "success" | "error") => void) | undefined,
    offlineMessage: string,
  ): void {
    if (!delivered && toast && !cfShowedToast) {
      toast(offlineMessage, "error");
    }
  }

  private resolveIsPushMode(pin: string, options?: SinglePinSyncOptions): boolean {
    if (options?.isPushMode !== undefined) {
      return options.isPushMode;
    }

    return this.deps.getSegments().find((s) => s.pin === pin)?.mode === "push";
  }

  private partitionBatchActions(
    actions: Array<{ targetPin: string; actionOn: boolean }>,
    availableSegments: Array<{ pin: string; auto_off?: number; mode?: string }>,
    cfEnabled: boolean,
  ): {
    mqttActions: PinAction[];
    cfActions: Array<{ pin: string; state: boolean }>;
  } {
    const segmentMap = new Map<string, { auto_off?: number; mode?: string }>();

    for (let i = 0; i < availableSegments.length; i++) {
      segmentMap.set(availableSegments[i].pin, availableSegments[i]);
    }

    const mqttActions: PinAction[] = [];
    const cfActions: Array<{ pin: string; state: boolean }> = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const segment = segmentMap.get(action.targetPin);
      mqttActions.push({ pin: action.targetPin, state: action.actionOn, timer: segment?.auto_off });

      if (cfEnabled && segment?.mode !== "push") {
        cfActions.push({ pin: action.targetPin, state: action.actionOn });
      }
    }

    return { mqttActions, cfActions };
  }

  async syncSinglePin(
    pin: string,
    state: boolean,
    options?: SinglePinSyncOptions,
  ): Promise<boolean> {
    const wsPayload = {
      command: "set_state",
      pin: Number(pin) | 0,
      state: state ? 1 : 0,
      timer: options?.autoOff,
    };

    const hardwareSent = this.dispatchHardwareCommand(
      wsPayload,
      () => !options?.preventMqtt && this.deps.publishPinCommand(pin, state, options?.autoOff),
    );

    const isPushMode = this.resolveIsPushMode(pin, options);
    const toast = options?.showToast || this.deps.getShowToast();
    let cfSucceeded = false;
    let cfAttempted = false;
    let cfShowedToast = false;

    if (this.deps.isCloudflareEnabled() && !isPushMode) {
      cfAttempted = true;
      const cfOutcome = await this.persistToCloudflareWithToast(
        toast,
        () => this.deps.updatePinOnCloudflare(pin, state),
        `Failed to sync pin ${pin} value to Cloudflare:`,
      );
      cfSucceeded = cfOutcome.succeeded;
      cfShowedToast = cfOutcome.showedToast;
    }

    if (options?.preventMqtt) {
      return !cfAttempted || cfSucceeded;
    }

    const delivered = hardwareSent || cfSucceeded;
    this.notifyIfOffline(
      delivered,
      cfShowedToast,
      toast,
      "ارتباط با دستگاه (MQTT/سرور) برقرار نیست؛ دستور ارسال نشد.",
    );

    return delivered;
  }

  async syncBatchPins(
    actions: Array<{ targetPin: string; actionOn: boolean }>,
    options?: BatchPinSyncOptions,
  ): Promise<boolean> {
    if (actions.length === 0) return false;

    const availableSegments = options?.segments ?? this.deps.getSegments();
    const cfEnabled = options?.isCfEnabled ?? this.deps.isCloudflareEnabled();
    const { mqttActions, cfActions } = this.partitionBatchActions(
      actions,
      availableSegments,
      cfEnabled,
    );

    const hardwareSent = this.dispatchHardwareCommand(
      { command: "batch_state", actions: mqttActions },
      () => this.deps.publishBatchPinCommand(mqttActions),
    );

    const toast = options?.showToast || this.deps.getShowToast();
    let cfSucceeded = false;
    let cfShowedToast = false;

    if (cfActions.length > 0) {
      const cfOutcome = await this.persistToCloudflareWithToast(
        toast,
        () => this.deps.updateBatchPinsOnCloudflare(cfActions),
        "Failed to batch sync pins to Cloudflare:",
      );
      cfSucceeded = cfOutcome.succeeded;
      cfShowedToast = cfOutcome.showedToast;
    }

    const delivered = hardwareSent || cfSucceeded;
    this.notifyIfOffline(
      delivered,
      cfShowedToast,
      toast,
      "ارتباط با دستگاه (MQTT/سرور) برقرار نیست؛ دستور گروهی ارسال نشد.",
    );

    return delivered;
  }
}

const MAX_DISPATCH_LOG_ENTRIES = 500;

/**
 * In-memory test & simulation adapter:
 * Tracks bounded dispatches in-memory with zero network I/O for deterministic testing.
 */
export class InMemoryDeviceSyncAdapter implements IDeviceSyncPort {
  public pinsState = new Map<string, boolean>();
  public dispatchLog: Array<{ type: "single" | "batch"; payload: unknown; timestamp: number }> = [];

  private appendDispatchLog(entry: {
    type: "single" | "batch";
    payload: unknown;
    timestamp: number;
  }): void {
    this.dispatchLog.push(entry);

    if (this.dispatchLog.length > MAX_DISPATCH_LOG_ENTRIES) {
      this.dispatchLog.splice(0, this.dispatchLog.length - MAX_DISPATCH_LOG_ENTRIES);
    }
  }

  async syncSinglePin(
    pin: string,
    state: boolean,
    options?: SinglePinSyncOptions,
  ): Promise<boolean> {
    this.pinsState.set(pin, state);
    this.appendDispatchLog({
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

    this.appendDispatchLog({
      type: "batch",
      payload: { actions, options },
      timestamp: Date.now(),
    });

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
