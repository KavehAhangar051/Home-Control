import type { StateCreator } from "zustand";
import type { GroupsSlice, IoTStoreState } from "../types";

export const createGroupsSlice: StateCreator<IoTStoreState, [], [], GroupsSlice> = (set) => ({
  groupsOrder: [],
  groupConfigs: {},
  groupsCols: 1,

  setGroupsOrder: (groupsOrder) => {
    set((state) => {
      const next = groupsOrder instanceof Function ? groupsOrder(state.groupsOrder) : groupsOrder;

      return { groupsOrder: next };
    });
  },

  setGroupConfigs: (groupConfigs) => {
    set((state) => {
      const next =
        groupConfigs instanceof Function ? groupConfigs(state.groupConfigs) : groupConfigs;

      return { groupConfigs: next };
    });
  },

  setGroupsCols: (groupsCols) => {
    set({ groupsCols });
  },
});
