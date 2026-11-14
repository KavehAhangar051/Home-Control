import type { StateCreator } from "zustand";
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

    set((state) => ({
      segments: config.segments || [],
      groupsOrder: config.layout?.groups_order || [],
      groupConfigs: config.layout?.group_configs || {},
      groupsCols: config.layout?.groups_cols || 1,
      automations: config.automations || [],
      macros: config.macros || [],
      voiceCommands: config.voiceCommands || [],
      wifiNetworks: config.wifi?.networks ?? state.wifiNetworks,
      wifiNetworksConfigured: Array.isArray(config.wifi?.networks) ? true : state.wifiNetworksConfigured,
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
    }));

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

    const importedPins: Record<string, boolean> = {};
    config.segments.forEach((s) => {
      if (s.pin && s.state !== undefined) {
        importedPins[s.pin] = s.state;
      }

      // Backward compatibility for old rule schema
      if (s.rule && "targetPin" in s.rule) {
        const oldRule = s.rule as {
          targetPin?: string;
          triggerState?: boolean;
          actionState?: boolean;
        };
        const triggerState = oldRule.triggerState ?? true;

        s.rule = {
          highActions:
            triggerState && oldRule.targetPin
              ? [
                  {
                    reqHold: 0,
                    targetPin: oldRule.targetPin,
                    actionOn: oldRule.actionState ?? true,
                    actionType: 0,
                    delay: 0,
                  },
                ]
              : [],
          lowActions:
            !triggerState && oldRule.targetPin
              ? [
                  {
                    reqHold: 0,
                    targetPin: oldRule.targetPin,
                    actionOn: oldRule.actionState ?? false,
                    actionType: 0,
                    delay: 0,
                  },
                ]
              : [],
        };
      } else if (s.rule && "targetPinHigh" in s.rule) {
        const oldRule = s.rule as {
          targetPinHigh?: string;
          reqHoldHigh?: number;
          actionOnHigh?: boolean;
          actionTypeHigh?: number;
          delayHigh?: number;
          targetPinLow?: string;
          reqHoldLow?: number;
          actionOnLow?: boolean;
          actionTypeLow?: number;
          delayLow?: number;
        };
        s.rule = {
          highActions: oldRule.targetPinHigh
            ? [
                {
                  reqHold: oldRule.reqHoldHigh || 0,
                  targetPin: oldRule.targetPinHigh,
                  actionOn: oldRule.actionOnHigh ?? true,
                  actionType: oldRule.actionTypeHigh || 0,
                  delay: oldRule.delayHigh || 0,
                },
              ]
            : [],
          lowActions: oldRule.targetPinLow
            ? [
                {
                  reqHold: oldRule.reqHoldLow || 0,
                  targetPin: oldRule.targetPinLow,
                  actionOn: oldRule.actionOnLow ?? false,
                  actionType: oldRule.actionTypeLow || 0,
                  delay: oldRule.delayLow || 0,
                },
              ]
            : [],
        };
      } else if (s.rule) {
        // Ensure arrays exist
        if (!s.rule.highActions) s.rule.highActions = [];

        if (!s.rule.lowActions) s.rule.lowActions = [];
      }
    });

    if (Object.keys(importedPins).length > 0) {
      set((state) => {
        const next = { ...state.pinsState, ...importedPins };

        return { pinsState: next };
      });
    }
  },
});
