"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { useDashboardState } from "@/features/iot/hooks/useDashboardState";

export type DashboardState = ReturnType<typeof useDashboardState>;

export interface DashboardContextInterface {
  state: Pick<
    DashboardState,
    "isLoadingIoT" | "mounted" | "isFullyReady" | "targetPlaceholderId" | "workerUrl"
  >;
  actions: Pick<
    DashboardState,
    | "refetchIot"
    | "setIsFullyReady"
    | "handleApplyEspConfig"
    | "handleAddSegment"
    | "handleAddPlaceholder"
    | "handleSetupPlaceholder"
    | "handleGroupColsChange"
    | "handleRemoveSegment"
    | "handleUpdateSegmentMode"
    | "handleUpdateSegmentRule"
    | "handleUpdateSegmentAutoOff"
    | "handleRemoveGroup"
    | "handleTogglePin"
    | "handleSetPinState"
    | "handleBatchPinState"
    | "handleBypassSync"
    | "setWorkerUrl"
    | "handleRetrySync"
    | "triggerCloudflarePush"
    | "handleDragStart"
    | "handleDragOver"
    | "handleDragEnd"
  >;
  meta: Pick<DashboardState, "sensors">;
}

export type DashboardContextValue = DashboardState & DashboardContextInterface;

export const DashboardContext = createContext<DashboardContextValue | null>(null);

interface DashboardProviderProps {
  children: ReactNode;
  value?: DashboardState;
}

/**
 * Provides dashboard IoT state, actions, and drag-and-drop metadata
 * to all descendant workspace and widget components.
 */
export function DashboardProvider({ children, value }: DashboardProviderProps) {
  const internalState = useDashboardState();
  const resolved = value ?? internalState;

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      ...resolved,
      state: {
        isLoadingIoT: resolved.isLoadingIoT,
        mounted: resolved.mounted,
        isFullyReady: resolved.isFullyReady,
        targetPlaceholderId: resolved.targetPlaceholderId,
        workerUrl: resolved.workerUrl,
      },
      actions: {
        refetchIot: resolved.refetchIot,
        setIsFullyReady: resolved.setIsFullyReady,
        handleApplyEspConfig: resolved.handleApplyEspConfig,
        handleAddSegment: resolved.handleAddSegment,
        handleAddPlaceholder: resolved.handleAddPlaceholder,
        handleSetupPlaceholder: resolved.handleSetupPlaceholder,
        handleGroupColsChange: resolved.handleGroupColsChange,
        handleRemoveSegment: resolved.handleRemoveSegment,
        handleUpdateSegmentMode: resolved.handleUpdateSegmentMode,
        handleUpdateSegmentRule: resolved.handleUpdateSegmentRule,
        handleUpdateSegmentAutoOff: resolved.handleUpdateSegmentAutoOff,
        handleRemoveGroup: resolved.handleRemoveGroup,
        handleTogglePin: resolved.handleTogglePin,
        handleSetPinState: resolved.handleSetPinState,
        handleBatchPinState: resolved.handleBatchPinState,
        handleBypassSync: resolved.handleBypassSync,
        setWorkerUrl: resolved.setWorkerUrl,
        handleRetrySync: resolved.handleRetrySync,
        triggerCloudflarePush: resolved.triggerCloudflarePush,
        handleDragStart: resolved.handleDragStart,
        handleDragOver: resolved.handleDragOver,
        handleDragEnd: resolved.handleDragEnd,
      },
      meta: {
        sensors: resolved.sensors,
      },
    }),
    [resolved],
  );

  return <DashboardContext value={contextValue}>{children}</DashboardContext>;
}

export function useDashboard() {
  const context = use(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
