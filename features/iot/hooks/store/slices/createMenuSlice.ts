import type { StateCreator } from "zustand";
import type { IoTStoreState, MenuSlice } from "../types";

export const createMenuSlice: StateCreator<IoTStoreState, [], [], MenuSlice> = (set) => ({
  activeWorkspaceView: "home",
  setActiveWorkspaceView: (view) =>
    set({
      activeWorkspaceView: view,
      isAutomationsMenuOpen: false,
      isMenuOpen: false,
      openSegmentMenuId: null,
    }),
  isMenuOpen: false,
  isEspDrawerOpen: false,
  isAutomationsMenuOpen: false,
  activeSettingsTab: "layout",
  activeModulesTab: "add",
  activeAutomationsTab: "create",
  openSegmentMenuId: null,

  setIsMenuOpen: (o) => set({ isMenuOpen: o }),
  setIsEspDrawerOpen: (o) => set({ isEspDrawerOpen: o }),
  setIsAutomationsMenuOpen: (o) => set({ isAutomationsMenuOpen: o }),
  setActiveSettingsTab: (t) => set({ activeSettingsTab: t === "voice-commands" ? "voice" : t }),
  setActiveModulesTab: (activeModulesTab) => set({ activeModulesTab }),
  setActiveAutomationsTab: (activeAutomationsTab) => set({ activeAutomationsTab }),
  setOpenSegmentMenuId: (id) => set({ openSegmentMenuId: id }),
});
