import type { IoTStoreState } from "@/features/iot/hooks/store/types";
import { getCloudflareWorkerUrl } from "@/features/iot/services/cloudflareService";
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
    version: "1.2.0",
    device: {
      name: "سامانه مرکزی IoT",
      chip: "ESP32-S3-WROOM-1",
      firmware: "v3.4.1-Smart-OS",
      reboot_count: 0,
      last_boot: "1970-01-01T00:00:00.000Z",
    },
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
