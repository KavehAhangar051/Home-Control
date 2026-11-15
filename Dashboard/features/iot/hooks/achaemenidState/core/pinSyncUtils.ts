import { defaultDeviceSyncGateway } from "@/features/iot/services/deviceGatewayAdapter";
import type { BatchPinSyncOptions, SinglePinSyncOptions } from "@/features/iot/services/ports";

export type { BatchPinSyncOptions, SinglePinSyncOptions };

/**
 * Deep sync function for a single pin across available transports:
 * Local WebSocket -> MQTT Wire -> Cloudflare Durable Objects.
 * Delegates to the IDeviceSyncPort implementation.
 */
export async function syncSinglePin(
  pin: string,
  state: boolean,
  options?: SinglePinSyncOptions,
): Promise<boolean> {
  return defaultDeviceSyncGateway.syncSinglePin(pin, state, options);
}

/**
 * Deep batch sync function for multiple pins across transports.
 * Encapsulates segment lookup, CF status checking, and toast reporting.
 * Delegates to the IDeviceSyncPort implementation.
 */
export async function syncBatchPins(
  actions: Array<{ targetPin: string; actionOn: boolean }>,
  options?: BatchPinSyncOptions,
): Promise<boolean> {
  return defaultDeviceSyncGateway.syncBatchPins(actions, options);
}
