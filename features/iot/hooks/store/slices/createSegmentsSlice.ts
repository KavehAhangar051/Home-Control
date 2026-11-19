import type { StateCreator } from "zustand";
import type { IoTStoreState, SegmentsSlice } from "../types";

export const createSegmentsSlice: StateCreator<IoTStoreState, [], [], SegmentsSlice> = (set) => ({
  segments: [],
  pinsState: {},
  pinsAnalogValue: {},
  pinsLastNonZeroValue: {},
  pinsPwmResolution: {},
  autoOffRemaining: {},

  setAutoOffRemaining: (timers) =>
    set((state) => (state.autoOffRemaining === timers ? state : { autoOffRemaining: timers })),

  setSegments: (segments) => {
    set((state) => {
      const next = segments instanceof Function ? segments(state.segments) : segments;

      return next === state.segments ? state : { segments: next };
    });
  },

  setPinsState: (pins) => {
    set((state) => {
      const nextPins = pins instanceof Function ? pins(state.pinsState) : pins;

      return nextPins === state.pinsState ? state : { pinsState: nextPins };
    });
  },

  setPinsAnalogValue: (values) => {
    set((state) => {
      const nextValues = values instanceof Function ? values(state.pinsAnalogValue) : values;

      return nextValues === state.pinsAnalogValue ? state : { pinsAnalogValue: nextValues };
    });
  },

  setPinsLastNonZeroValue: (values) => {
    set((state) => {
      const nextValues = values instanceof Function ? values(state.pinsLastNonZeroValue) : values;

      return nextValues === state.pinsLastNonZeroValue
        ? state
        : { pinsLastNonZeroValue: nextValues };
    });
  },

  setPinsPwmResolution: (resolutions) => {
    set((state) => {
      const nextResolutions =
        resolutions instanceof Function ? resolutions(state.pinsPwmResolution) : resolutions;

      return nextResolutions === state.pinsPwmResolution
        ? state
        : { pinsPwmResolution: nextResolutions };
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
