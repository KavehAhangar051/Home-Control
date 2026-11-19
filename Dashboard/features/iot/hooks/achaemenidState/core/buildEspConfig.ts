import { scheduleIdleStorageWrite } from "@/lib/asyncScheduler";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import type { IoTStoreState } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  type AckResult,
  getCloudflareWorkerUrl,
  isCloudflareEnabled,
  saveConfigToCloudflare,
} from "@/features/iot/services/cloudflareService";
import {
  CANONICAL_CONFIG_VERSION,
  createDefaultDeviceInfo,
} from "@/features/iot/services/config/defaults";
import type { EspConfig } from "@/features/iot/services/esp32Config";

export type EspConfigBuildSource = Pick<
  IoTStoreState,
  | "isDark"
  | "accent3"
  | "accent4"
  | "selectedFont"
  | "animationsEnabled"
  | "animationsFps"
  | "headerTitle"
  | "manualSaveMode"
  | "groupsOrder"
  | "groupsCols"
  | "groupConfigs"
  | "segments"
  | "automations"
  | "macros"
  | "voiceCommands"
  | "wifiNetworks"
  | "wifiNetworksConfigured"
  | "wifiApConfig"
  | "mqttConfig"
> & {
  headerAnimationType?: "fade" | "chase";
  headerPosition?: "top" | "left";
  dashboardBgColor?: string;
  dashboardBgOpacity?: number;
};

export function buildEspConfig(params: EspConfigBuildSource): EspConfig {
  const apConfig = params.wifiApConfig;
  const apIsCleared = apConfig && !apConfig.ssid.trim() && !apConfig.password;

  const apIsValid =
    apConfig &&
    apConfig.ssid.trim().length > 0 &&
    apConfig.ssid.length <= 32 &&
    apConfig.password.length >= 8 &&
    apConfig.password.length <= 63;

  const accessPoint = apIsCleared || apIsValid ? apConfig : undefined;

  return {
    version: CANONICAL_CONFIG_VERSION,
    device: createDefaultDeviceInfo(),
    preferences: {
      theme_mode: params.isDark ? "dark" : "light",
      accent_color_3: params.accent3,
      accent_color_4: params.accent4,
      font_family: params.selectedFont,
      animations_enabled: params.animationsEnabled,
      animations_fps: params.animationsFps,
      header_animation: params.headerAnimationType || "fade",
      header_title: params.headerTitle,
      header_position: params.headerPosition || "top",
      dashboard_bg_color: params.dashboardBgColor,
      dashboard_bg_opacity: params.dashboardBgOpacity,
      manual_save_mode: params.manualSaveMode,
    },
    layout: {
      groups_order: params.groupsOrder,
      groups_cols: params.groupsCols,
      group_configs: params.groupConfigs,
    },
    segments: params.segments,
    automations: params.automations,
    macros: params.macros,
    voiceCommands: params.voiceCommands,
    wifi:
      params.wifiNetworksConfigured || accessPoint
        ? {
            networks: params.wifiNetworksConfigured ? params.wifiNetworks : undefined,
            access_point: accessPoint || undefined,
          }
        : undefined,
    mqtt: params.mqttConfig || undefined,
    worker_url: getCloudflareWorkerUrl(),
  };
}

export interface PersistStoreConfigOptions {
  overrides?: Partial<EspConfigBuildSource>;
  successToast?: string;
  errorToast?: string;
  saveFn?: (config: EspConfig) => Promise<AckResult>;
  isEnabledFn?: () => boolean;
}

let persistGeneration = 0;
let configSaveQueue: Promise<void> = Promise.resolve();

/**
 * Serialized, monotonic configuration persistence operation (DDIA lost-update guard):
 * Builds the canonical EspConfig from the freshest store snapshot at execution time,
 * serializes overlapping HTTP writes so out-of-order responses never overwrite newer KV state,
 * and only clears `unsavedChangesCount` when no newer save request superseded the write.
 */
export async function persistStoreConfigToCloudflare(
  options?: PersistStoreConfigOptions,
): Promise<{ result: AckResult; signature: string }> {
  const myGeneration = ++persistGeneration;
  const checkEnabled = options?.isEnabledFn ?? isCloudflareEnabled;
  const executeSave = options?.saveFn ?? saveConfigToCloudflare;

  const runPersist = async (): Promise<{ result: AckResult; signature: string }> => {
    const latestState = useIoTStore.getState();

    const snapshotToSave = buildEspConfig({
      ...latestState,
      ...options?.overrides,
    });

    const signature = JSON.stringify(snapshotToSave);

    if (!checkEnabled()) {
      return {
        result: { success: false, message: "اتصال کلودفلر غیرفعال است." },
        signature,
      };
    }

    const result = await executeSave(snapshotToSave);

    if (result.success) {
      if (myGeneration === persistGeneration) {
        useIoTStore.getState().resetUnsavedChanges();

        if (FEATURE_FLAGS.configLocalCache && globalThis.window !== undefined) {
          scheduleIdleStorageWrite("cached_esp_config", () => signature);
        }
      }

      useIoTStore.getState().showToast(options?.successToast || result.message, "success");
    } else if (myGeneration === persistGeneration) {
      useIoTStore.getState().showToast(options?.errorToast || result.message, "error");
    }

    return { result, signature };
  };

  const queuedPromise = configSaveQueue.then(runPersist, runPersist);
  configSaveQueue = queuedPromise.then(
    () => undefined,
    () => undefined,
  );

  return queuedPromise;
}
