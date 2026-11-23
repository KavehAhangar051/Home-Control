import type { StateCreator } from "zustand";
import { normalizeSegmentRecord } from "@/features/iot/services/cloudflare/mappers";
import {
  clampAdcResolution,
  clampAdcValue,
  isAnalogInputSegment,
} from "@/features/iot/utils/analogInput";
import {
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  isAnalogOutputSegment,
} from "@/features/iot/utils/analogOutput";
import {
  applyDashboardFontToDocument,
  persistDashboardFont,
  resolveDashboardFontId,
} from "@/lib/fonts";
import type { ConfigSlice, IoTStoreState } from "../types";

export const createConfigSlice: StateCreator<IoTStoreState, [], [], ConfigSlice> = (set, get) => ({
  auxNodes: [],

  setAuxNodes: (nodes) =>
    set((state) => ({
      auxNodes: typeof nodes === "function" ? nodes(state.auxNodes) : nodes,
    })),

  upsertAuxNode: (node) =>
    set((state) => {
      const exists = state.auxNodes.some((n) => n.nodeId === node.nodeId);
      return {
        auxNodes: exists
          ? state.auxNodes.map((n) => (n.nodeId === node.nodeId ? node : n))
          : [...state.auxNodes, node],
      };
    }),

  removeAuxNode: (nodeId) =>
    set((state) => ({
      auxNodes: state.auxNodes.filter((n) => n.nodeId !== nodeId),
    })),

  updateAuxNodesOnlineStatus: (nodes) =>
    set((state) => {
      if (state.auxNodes.length === 0 || nodes.length === 0) return state;

      const statusById = new Map<number, boolean>();
      for (let i = 0; i < nodes.length; i++) {
        const entry = nodes[i];
        if (typeof entry.online === "boolean") {
          statusById.set(entry.id, entry.online);
        }
      }

      if (statusById.size === 0) return state;

      let changed = false;
      const next = state.auxNodes.map((node) => {
        const nextOnline = statusById.get(node.nodeId);
        if (nextOnline !== undefined && node.online !== nextOnline) {
          changed = true;
          return { ...node, online: nextOnline };
        }
        return node;
      });

      return changed ? { auxNodes: next } : state;
    }),

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
    const importedAnalogValues: Record<string, number> = {};
    const importedLastNonZero: Record<string, number> = {};
    const importedResolutions: Record<string, number> = {};

    for (let i = 0; i < normalizedSegments.length; i++) {
      const seg = normalizedSegments[i];

      if (!seg.pin) continue;

      if (isAnalogOutputSegment(seg)) {
        const res = clampPwmResolution(seg.pwmResolution);
        const maxDuty = getAnalogMaxDuty(res);
        importedResolutions[seg.pin] = res;

        if (seg.analogValue !== undefined) {
          const duty = clampAnalogValue(seg.analogValue, res);
          importedAnalogValues[seg.pin] = duty;
          importedPins[seg.pin] = seg.state !== undefined ? seg.state : duty > 0;

          if (duty > 0) {
            importedLastNonZero[seg.pin] = duty;
          }
        } else if (seg.state !== undefined) {
          importedPins[seg.pin] = seg.state;
        }

        if (seg.lastNonZeroValue !== undefined && seg.lastNonZeroValue > 0) {
          importedLastNonZero[seg.pin] = Math.max(1, clampAnalogValue(seg.lastNonZeroValue, res));
        } else if (importedLastNonZero[seg.pin] === undefined) {
          importedLastNonZero[seg.pin] = maxDuty;
        }
      } else if (isAnalogInputSegment(seg)) {
        const res = clampAdcResolution(seg.adcResolution);
        importedResolutions[seg.pin] = res;

        if (seg.analogValue !== undefined) {
          importedAnalogValues[seg.pin] = clampAdcValue(seg.analogValue, res);
        }

        if (seg.state !== undefined) {
          importedPins[seg.pin] = seg.state;
        }
      } else if (seg.state !== undefined) {
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

      const mergedAnalog = { ...state.pinsAnalogValue };
      let hasSeededAnalog = false;

      for (const [pin, kvAnalog] of Object.entries(importedAnalogValues)) {
        if (mergedAnalog[pin] === undefined) {
          mergedAnalog[pin] = kvAnalog;
          hasSeededAnalog = true;
        }
      }

      const mergedLastNonZero = { ...state.pinsLastNonZeroValue };
      let hasSeededLastNonZero = false;

      for (const [pin, kvLast] of Object.entries(importedLastNonZero)) {
        if (mergedLastNonZero[pin] === undefined) {
          mergedLastNonZero[pin] = kvLast;
          hasSeededLastNonZero = true;
        }
      }

      const mergedResolutions = { ...state.pinsPwmResolution };
      let hasSeededResolutions = false;

      for (const [pin, kvRes] of Object.entries(importedResolutions)) {
        if (mergedResolutions[pin] === undefined) {
          mergedResolutions[pin] = kvRes;
          hasSeededResolutions = true;
        }
      }

      return {
        segments: normalizedSegments,
        auxNodes: Array.isArray(config.auxNodes) ? config.auxNodes : [],
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
        pinsAnalogValue: hasSeededAnalog ? mergedAnalog : state.pinsAnalogValue,
        pinsLastNonZeroValue: hasSeededLastNonZero ? mergedLastNonZero : state.pinsLastNonZeroValue,
        pinsPwmResolution: hasSeededResolutions ? mergedResolutions : state.pinsPwmResolution,
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
