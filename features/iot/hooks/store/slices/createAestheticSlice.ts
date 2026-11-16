import type { StateCreator } from "zustand";
import {
  applyDashboardFontToDocument,
  DEFAULT_DASHBOARD_FONT,
  persistDashboardFont,
  resolveDashboardFontId,
} from "@/lib/fonts";
import type { AestheticSlice, IoTStoreState } from "../types";

const DEFAULT_ACCENT3 = "#E5E7EB";
const DEFAULT_ACCENT4 = "#3B82F6";
const DEFAULT_DARK_BLACKNESS = 70;
const DEFAULT_LIGHT_WHITENESS = 70;

export const createAestheticSlice: StateCreator<IoTStoreState, [], [], AestheticSlice> = (set) => ({
  isDark: true,
  accent3: DEFAULT_ACCENT3,
  accent4: DEFAULT_ACCENT4,
  darkBlackness: DEFAULT_DARK_BLACKNESS,
  lightWhiteness: DEFAULT_LIGHT_WHITENESS,
  animationsEnabled: true,
  animationsFps: 60,
  headerTitle: "سامانه کنترل هوشمند IoT",
  selectedFont: DEFAULT_DASHBOARD_FONT,
  isSidebarCollapsed: false,

  setIsDark: (isDark) => set({ isDark }),
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  setAccent3: (accent3) => set({ accent3 }),
  setAccent4: (accent4) => set({ accent4 }),
  setDarkBlackness: (darkBlackness) => set({ darkBlackness }),
  setLightWhiteness: (lightWhiteness) => set({ lightWhiteness }),
  resetColors: () =>
    set({
      accent3: DEFAULT_ACCENT3,
      accent4: DEFAULT_ACCENT4,
      darkBlackness: DEFAULT_DARK_BLACKNESS,
      lightWhiteness: DEFAULT_LIGHT_WHITENESS,
    }),
  setAnimationsEnabled: (e) => set({ animationsEnabled: e }),
  setAnimationsFps: (f) => set({ animationsFps: f }),
  setHeaderTitle: (t) => set({ headerTitle: t }),
  setSelectedFont: (font) => {
    const resolved = resolveDashboardFontId(font);
    persistDashboardFont(resolved);
    applyDashboardFontToDocument(resolved);
    set({ selectedFont: resolved });
  },
  resetFont: () => {
    persistDashboardFont(DEFAULT_DASHBOARD_FONT);
    applyDashboardFontToDocument(DEFAULT_DASHBOARD_FONT);
    set({ selectedFont: DEFAULT_DASHBOARD_FONT });
  },
  setIsSidebarCollapsed: (c) => set({ isSidebarCollapsed: c }),
});
