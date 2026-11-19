"use client";

import type { LayoutDocument } from "@danfessler/trellis-react";
import { create } from "zustand";
import { createJSONStorage, devtools, persist, subscribeWithSelector } from "zustand/middleware";
import type { TrellisLayoutPreset } from "@/features/iot/components/trellis/trellisLayout";
import {
  DEFAULT_SLIDER_STYLE,
  resolveSliderStyle,
  type SliderStylePreference,
} from "@/lib/sliderStyles";

export interface SavedTrellisLayout {
  id: string;
  name: string;
  preset: TrellisLayoutPreset;
  document: LayoutDocument;
  updatedAt: number;
}

export interface PreferencesStoreState {
  /** Browser-local toggle for mobile/touch Vibration API haptic feedback. */
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  /** User-selected beUI motion slider design (`"auto"` picks the best variant per UI context). */
  sliderStyle: SliderStylePreference;
  setSliderStyle: (style: SliderStylePreference) => void;
  resetSliderStyle: () => void;
  /** User-saved custom Trellis workspace arrangements stored locally in the browser. */
  savedTrellisLayouts: SavedTrellisLayout[];
  saveTrellisLayout: (input: {
    name: string;
    preset: TrellisLayoutPreset;
    document: LayoutDocument;
  }) => SavedTrellisLayout;
  deleteTrellisLayout: (id: string) => void;
}

const PREFERENCES_STORAGE_KEY = "home-control-preferences-v1";
const MAX_SAVED_TRELLIS_LAYOUTS = 12;

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * Dedicated Zustand 5 persisted store for strictly browser-local UX preferences
 * (haptics toggle, slider style, & custom Trellis workspace snapshots).
 * Kept separate from `useIoTStore` so ESP32 / Cloudflare KV payloads remain 100% pure.
 */
export const usePreferencesStore = create<PreferencesStoreState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set) => ({
          hapticsEnabled: true,
          setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),

          sliderStyle: DEFAULT_SLIDER_STYLE,
          setSliderStyle: (style) => set({ sliderStyle: resolveSliderStyle(style) }),
          resetSliderStyle: () => set({ sliderStyle: DEFAULT_SLIDER_STYLE }),

          savedTrellisLayouts: [],
          saveTrellisLayout: ({ name, preset, document }) => {
            const trimmed = name.trim() || "چیدمان سفارشی";
            const entry: SavedTrellisLayout = {
              id: `trellis-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: trimmed,
              preset,
              document,
              updatedAt: Date.now(),
            };

            set((state) => {
              const filtered = state.savedTrellisLayouts.filter(
                (item) => item.name.trim() !== trimmed,
              );

              return {
                savedTrellisLayouts: [entry, ...filtered].slice(0, MAX_SAVED_TRELLIS_LAYOUTS),
              };
            });

            return entry;
          },

          deleteTrellisLayout: (id) =>
            set((state) => ({
              savedTrellisLayouts: state.savedTrellisLayouts.filter((item) => item.id !== id),
            })),
        }),
        {
          name: PREFERENCES_STORAGE_KEY,
          version: 1,
          storage: createJSONStorage(() =>
            typeof window !== "undefined" ? window.localStorage : noopStorage,
          ),
          partialize: (state) => ({
            hapticsEnabled: state.hapticsEnabled,
            sliderStyle: state.sliderStyle,
            savedTrellisLayouts: state.savedTrellisLayouts,
          }),
        },
      ),
    ),
    {
      name: "HomeControlPreferences",
      enabled: process.env.NODE_ENV === "development",
    },
  ),
);
