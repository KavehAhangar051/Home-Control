"use client";

import { createContext, type ReactNode, use, useMemo } from "react";
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
    | "clearTargetPlaceholder"
    | "handleApplyEspConfig"
    | "handleAddSegment"
    | "handleCreateAuxNode"
    | "handleUpdateAuxNode"
    | "handleAddPlaceholder"
    | "handleSetupPlaceholder"
    | "handleGroupColsChange"
    | "handleRemoveSegment"
    | "handleUpdateSegmentMode"
    | "handleUpdateSegmentRule"
    | "handleUpdateSegmentAutoOff"
    | "handleUpdateAnalogInputConfig"
    | "handleRemoveGroup"
    | "handleTogglePin"
    | "handleSetPinState"
    | "handleSetPinAnalogValue"
    | "handleBatchPinState"
    | "handleExecuteMacro"
    | "handleReadAnalogInput"
    | "handleBypassSync"
    | "setWorkerUrl"
    | "handleRetrySync"
    | "triggerCloudflarePush"
  >;
  meta: Record<string, never>;
}

export type DashboardActions = DashboardContextInterface["actions"];
export type DashboardContextValue = DashboardState & DashboardContextInterface;

const DashboardContext = createContext<DashboardContextValue | null>(null);
const DashboardActionsContext = createContext<DashboardActions | null>(null);

interface DashboardProviderProps {
  children: ReactNode;
  value?: DashboardState;
}

/**
 * Provides dashboard IoT state and actions to workspace and widget components.
 * Action handlers are exposed on a separate `DashboardActionsContext` so action-only
 * subtrees stay isolated from transient sync/readiness state updates.
 */
export function DashboardProvider({ children, value }: DashboardProviderProps) {
  const internalState = useDashboardState();
  const resolved = value ?? internalState;

  const state = useMemo(
    () => ({
      isLoadingIoT: resolved.isLoadingIoT,
      mounted: resolved.mounted,
      isFullyReady: resolved.isFullyReady,
      targetPlaceholderId: resolved.targetPlaceholderId,
      workerUrl: resolved.workerUrl,
    }),
    [
      resolved.isLoadingIoT,
      resolved.mounted,
      resolved.isFullyReady,
      resolved.targetPlaceholderId,
      resolved.workerUrl,
    ],
  );

  const actions = useMemo<DashboardActions>(
    () => ({
      refetchIot: resolved.refetchIot,
      setIsFullyReady: resolved.setIsFullyReady,
      clearTargetPlaceholder: resolved.clearTargetPlaceholder,
      handleApplyEspConfig: resolved.handleApplyEspConfig,
      handleAddSegment: resolved.handleAddSegment,
      handleCreateAuxNode: resolved.handleCreateAuxNode,
      handleUpdateAuxNode: resolved.handleUpdateAuxNode,
      handleAddPlaceholder: resolved.handleAddPlaceholder,
      handleSetupPlaceholder: resolved.handleSetupPlaceholder,
      handleGroupColsChange: resolved.handleGroupColsChange,
      handleRemoveSegment: resolved.handleRemoveSegment,
      handleUpdateSegmentMode: resolved.handleUpdateSegmentMode,
      handleUpdateSegmentRule: resolved.handleUpdateSegmentRule,
      handleUpdateSegmentAutoOff: resolved.handleUpdateSegmentAutoOff,
      handleUpdateAnalogInputConfig: resolved.handleUpdateAnalogInputConfig,
      handleRemoveGroup: resolved.handleRemoveGroup,
      handleTogglePin: resolved.handleTogglePin,
      handleSetPinState: resolved.handleSetPinState,
      handleSetPinAnalogValue: resolved.handleSetPinAnalogValue,
      handleBatchPinState: resolved.handleBatchPinState,
      handleExecuteMacro: resolved.handleExecuteMacro,
      handleReadAnalogInput: resolved.handleReadAnalogInput,
      handleBypassSync: resolved.handleBypassSync,
      setWorkerUrl: resolved.setWorkerUrl,
      handleRetrySync: resolved.handleRetrySync,
      triggerCloudflarePush: resolved.triggerCloudflarePush,
    }),
    [
      resolved.refetchIot,
      resolved.setIsFullyReady,
      resolved.clearTargetPlaceholder,
      resolved.handleApplyEspConfig,
      resolved.handleAddSegment,
      resolved.handleCreateAuxNode,
      resolved.handleUpdateAuxNode,
      resolved.handleAddPlaceholder,
      resolved.handleSetupPlaceholder,
      resolved.handleGroupColsChange,
      resolved.handleRemoveSegment,
      resolved.handleUpdateSegmentMode,
      resolved.handleUpdateSegmentRule,
      resolved.handleUpdateSegmentAutoOff,
      resolved.handleUpdateAnalogInputConfig,
      resolved.handleRemoveGroup,
      resolved.handleTogglePin,
      resolved.handleSetPinState,
      resolved.handleSetPinAnalogValue,
      resolved.handleBatchPinState,
      resolved.handleExecuteMacro,
      resolved.handleReadAnalogInput,
      resolved.handleBypassSync,
      resolved.setWorkerUrl,
      resolved.handleRetrySync,
      resolved.triggerCloudflarePush,
    ],
  );

  const meta = useMemo(() => ({}), []);

  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      ...state,
      ...actions,
      ...meta,
      state,
      actions,
      meta,
    }),
    [state, actions, meta],
  );

  return (
    <DashboardActionsContext value={actions}>
      <DashboardContext value={contextValue}>{children}</DashboardContext>
    </DashboardActionsContext>
  );
}

export function useDashboard() {
  const context = use(DashboardContext);

  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }

  return context;
}

/**
 * Subscribes only to stable dashboard action handlers without re-rendering on
 * transient dashboard state changes (`mounted`, `isFullyReady`, `workerUrl`, `targetPlaceholderId`).
 */
export function useDashboardActions(): DashboardActions {
  const actions = use(DashboardActionsContext);

  if (!actions) {
    throw new Error("useDashboardActions must be used within a DashboardProvider");
  }

  return actions;
}

export function useOptionalDashboard(): DashboardContextValue | null {
  return use(DashboardContext);
}
