import type { StateCreator } from "zustand";
import type { IoTStoreState, SegmentsSlice } from "../types";

export const createSegmentsSlice: StateCreator<IoTStoreState, [], [], SegmentsSlice> = (set) => ({
  segments: [],
  pinsState: {},

  setSegments: (segments) => {
    set((state) => {
      const next = segments instanceof Function ? segments(state.segments) : segments;

      return { segments: next };
    });
  },

  setPinsState: (pins) => {
    set((state) => {
      const nextPins = pins instanceof Function ? pins(state.pinsState) : pins;

      return { pinsState: nextPins };
    });
  },

  updateSegmentMode: (id, mode) => {
    set((state) => {
      const updated = state.segments.map((seg) => (seg.id === id ? { ...seg, mode } : seg));

      return { segments: updated };
    });
  },

  updateSegmentRule: (id, rule) => {
    set((state) => {
      const updated = state.segments.map((seg) => (seg.id === id ? { ...seg, rule } : seg));

      return { segments: updated };
    });
  },
});
