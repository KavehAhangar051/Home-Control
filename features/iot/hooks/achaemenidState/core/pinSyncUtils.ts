import { defaultDeviceSyncGateway } from "@/features/iot/services/deviceGatewayAdapter";
import type { SinglePinSyncOptions, BatchPinSyncOptions } from "@/features/iot/services/ports";

export type { SinglePinSyncOptions, BatchPinSyncOptions };

/**
 * Deep sync function for a single pin across available transports:
 * Local WebSocket -> MQTT Wire -> Cloudflare Durable Objects.
 * Delegates to the IDeviceSyncPort implementation.
 */
export async function syncSinglePin(
  pin: string,
  state: boolean,
  optionsOrPreventMqtt?: boolean | SinglePinSyncOptions,
  autoOff?: number,
  isPushMode?: boolean,
  showToast?: (message: string, type: "success" | "error") => void,
): Promise<void> {
  const options: SinglePinSyncOptions =
    typeof optionsOrPreventMqtt === "object" && optionsOrPreventMqtt !== null
      ? optionsOrPreventMqtt
      : {
          preventMqtt: Boolean(optionsOrPreventMqtt),
          autoOff,
          isPushMode,
          showToast,
        };

  return defaultDeviceSyncGateway.syncSinglePin(pin, state, options);
}

/**
 * Deep batch sync function for multiple pins across transports.
 * Encapsulates segment lookup, CF status checking, and toast reporting.
 * Delegates to the IDeviceSyncPort implementation.
 */
export async function syncBatchPins(
  actions: Array<{ targetPin: string; actionOn: boolean }>,
  segments?: Array<{ pin: string; auto_off?: number; mode?: string }>,
  isCfEnabled?: boolean,
  showToast?: (message: string, type: "success" | "error") => void,
): Promise<void> {
  return defaultDeviceSyncGateway.syncBatchPins(actions, {
    segments,
    isCfEnabled,
    showToast,
  });
}
