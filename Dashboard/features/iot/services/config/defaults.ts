import type { EspConfig } from "./types";

/**
 * Authoritative canonical configuration schema version shared by
 * Cloudflare mappers and ESP32 snapshot builders (Single Source of Truth).
 */
export const CANONICAL_CONFIG_VERSION = "1.2.0";

/**
 * Default hardware identity metadata used when deserializing partial payloads
 * or constructing an initial ESP32 configuration snapshot.
 */
export const DEFAULT_DEVICE_INFO: Readonly<EspConfig["device"]> = {
  name: "سامانه مرکزی IoT",
  chip: "ESP32-S3-WROOM-1",
  firmware: "v3.4.1-Smart-OS",
  reboot_count: 0,
  last_boot: "1970-01-01T00:00:00.000Z",
};

export function createDefaultDeviceInfo(): EspConfig["device"] {
  return { ...DEFAULT_DEVICE_INFO };
}
