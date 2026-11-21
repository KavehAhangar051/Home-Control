import type { StateCreator } from "zustand";
import { scheduleIdleStorageWrite } from "@/lib/asyncScheduler";
import type { IoTStoreState, UiSlice, WorkspaceDisplayMode } from "../types";

export const DISPLAY_MODE_STORAGE_KEY = "workspace_display_mode";

export function readSavedDisplayMode(): WorkspaceDisplayMode {
  if (typeof window === "undefined") return "grid";

  try {
    const saved = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);

    if (saved === "trellis" || saved === "grid" || saved === "canvas") {
      return saved;
    }
  } catch {
    // Ignore storage read failures in restricted contexts
  }

  return "grid";
}

export const createUiSlice: StateCreator<IoTStoreState, [], [], UiSlice> = (set) => ({
  workspaceDisplayMode: "grid",
  lowDataMode: false,
  toast: null,
  selectedGroupFilter: null,
  isPageVisible: true,
  isListening: false,
  voiceTranscript: "",
  activeSegmentId: null,
  activeGroupId: null,
  isLocal: false,
  localIp: null,

  setWorkspaceDisplayMode: (mode) => {
    set({ workspaceDisplayMode: mode });
    scheduleIdleStorageWrite(DISPLAY_MODE_STORAGE_KEY, () => mode);
  },

  setLowDataMode: (enabled) => {
    set({ lowDataMode: enabled });
  },

  showToast: (message, type) => {
    set({ toast: { message, type } });
  },

  clearToast: () => {
    set({ toast: null });
  },

  setSelectedGroupFilter: (group) => {
    set({ selectedGroupFilter: group });
  },

  setIsPageVisible: (visible) => {
    set({ isPageVisible: visible });
  },

  setIsListening: (b) => set({ isListening: b }),

  setVoiceTranscript: (t) => set({ voiceTranscript: t }),

  setActiveSegmentId: (id) => set({ activeSegmentId: id }),
  setActiveGroupId: (id) => set({ activeGroupId: id }),
  setIsLocal: (local) => set({ isLocal: local }),
  setLocalIp: (ip) => set({ localIp: ip }),
});
