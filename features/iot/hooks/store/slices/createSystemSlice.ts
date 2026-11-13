import type { StateCreator } from "zustand";
import type { IoTStoreState, SystemSlice } from "../types";

export const createSystemSlice: StateCreator<IoTStoreState, [], [], SystemSlice> = (set) => ({
  automations: [],
  macros: [],
  voiceCommands: [],
  wifiNetworks: [],
  mqttConfig: null,

  setAutomations: (automations) => {
    set((state) => {
      const next = automations instanceof Function ? automations(state.automations) : automations;

      return { automations: next };
    });
  },

  setMacros: (macros) => {
    set((state) => {
      const next = macros instanceof Function ? macros(state.macros) : macros;

      return { macros: next };
    });
  },

  setVoiceCommands: (voiceCommands) => {
    set((state) => {
      const next =
        voiceCommands instanceof Function ? voiceCommands(state.voiceCommands) : voiceCommands;

      return { voiceCommands: next };
    });
  },

  setWifiNetworks: (networks) => {
    set((state) => {
      const next = networks instanceof Function ? networks(state.wifiNetworks) : networks;

      return { wifiNetworks: next };
    });
  },

  setMqttConfig: (config) => set({ mqttConfig: config }),
});
