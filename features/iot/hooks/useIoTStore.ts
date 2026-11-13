import { create } from "zustand";
import { createAestheticSlice } from "./store/slices/createAestheticSlice";
import { createConfigSlice } from "./store/slices/createConfigSlice";
import { createGroupsSlice } from "./store/slices/createGroupsSlice";
import { createMenuSlice } from "./store/slices/createMenuSlice";
import { createSegmentsSlice } from "./store/slices/createSegmentsSlice";
import { createSyncSlice } from "./store/slices/createSyncSlice";
import { createSystemSlice } from "./store/slices/createSystemSlice";
import { createUiSlice } from "./store/slices/createUiSlice";
import type { IoTStoreState } from "./store/types";

export const useIoTStore = create<IoTStoreState>((...a) => ({
  ...createSegmentsSlice(...a),
  ...createGroupsSlice(...a),
  ...createSyncSlice(...a),
  ...createSystemSlice(...a),
  ...createUiSlice(...a),
  ...createConfigSlice(...a),
  ...createMenuSlice(...a),
  ...createAestheticSlice(...a),
}));
