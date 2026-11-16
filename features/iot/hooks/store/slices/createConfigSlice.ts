import type { StateCreator } from "zustand";
import { normalizeSegmentRecord } from "@/features/iot/services/cloudflare/mappers";
import {
  applyDashboardFontToDocument,
  persistDashboardFont,
  resolveDashboardFontId,
} from "@/lib/fonts";
import type { ConfigSlice, IoTStoreState } from "../types";

export const createConfigSlice: StateCreator<IoTStoreState, [], [], ConfigSlice> = (set, get) => ({
  applyEspConfig: (config) => {
    if (!config) return;

    const resolvedFont = config.preferences?.font_family
      ? resolveDashboardFontId(config.preferences.font_family)
      : get().selectedFont;

    if (config.preferences?.font_family) {
      persistDashboardFont(resolvedFont);
      applyDashboardFontToDocument(resolvedFont);
    }

    const normalizedSegments = (config.segments || []).map(normalizeSegmentRecord);

    const importedPins: Record<string, boolean> = {};

    for (let i = 0; i < normalizedSegments.length; i++) {
      const seg = normalizedSegments[i];

      if (seg.pin && seg.state !== undefined) {
        importedPins[seg.pin] = seg.state;
      }
    }

    set((state) => {
      const mergedPinsState = { ...state.pinsState };
      let hasSeededPin = false;

      for (const [pin, kvValue] of Object.entries(importedPins)) {
        // ESP32 RAM is live SSOT; seed from KV only if live pin state is not yet populated
        if (mergedPinsState[pin] === undefined) {
          mergedPinsState[pin] = kvValue;
          hasSeededPin = true;
        }
      }

      return {
        segments: normalizedSegments,
        groupsOrder: config.layout?.groups_order || [],
        groupConfigs: config.layout?.group_configs || {},
        groupsCols: config.layout?.groups_cols || 1,
        automations: config.automations || [],
        macros: config.macros || [],
        voiceCommands: config.voiceCommands || [],
        wifiNetworks: config.wifi?.networks ?? state.wifiNetworks,
        wifiNetworksConfigured: Array.isArray(config.wifi?.networks)
          ? true
          : state.wifiNetworksConfigured,
        wifiApConfig: config.wifi?.access_point ?? state.wifiApConfig,
        isDark: config.preferences?.theme_mode
          ? config.preferences.theme_mode !== "light"
          : state.isDark,
        selectedFont: resolvedFont,
        animationsEnabled:
          config.preferences?.animations_enabled !== undefined
            ? config.preferences.animations_enabled
            : state.animationsEnabled,
        animationsFps:
          config.preferences?.animations_fps !== undefined
            ? config.preferences.animations_fps
            : state.animationsFps,
        headerTitle: config.preferences?.header_title || state.headerTitle,
        manualSaveMode:
          config.preferences?.manual_save_mode !== undefined
            ? config.preferences.manual_save_mode
            : state.manualSaveMode,
        accent3: config.preferences?.accent_color_3 || state.accent3,
        accent4: config.preferences?.accent_color_4 || state.accent4,
        unsavedChangesCount: 0,
        pinsState: hasSeededPin ? mergedPinsState : state.pinsState,
      };
    });

    if (config.mqtt && typeof window !== "undefined") {
      const currentMqtt = get().mqttConfig;
      set({ mqttConfig: config.mqtt });

      const changed =
        !currentMqtt ||
        currentMqtt.broker_ws_url !== config.mqtt.broker_ws_url ||
        currentMqtt.base_topic !== config.mqtt.base_topic ||
        currentMqtt.qos !== config.mqtt.qos;

      if (changed) {
        import("@/features/iot/services/mqttService")
          .then((m) => {
            if (m.reconnectMqtt) m.reconnectMqtt();
          })
          .catch((e) => console.error("Failed to load mqttService for reconnect:", e));
      }
    }
  },
});
