"use client";

import { useCloudflareInit } from "./achaemenidState/useCloudflareInit";
import { useCloudflarePush } from "./achaemenidState/useCloudflarePush";
import { useCloudflareQuery } from "./achaemenidState/useCloudflareQuery";
import { useConnectionStrategy } from "./achaemenidState/useConnectionStrategy";
import { usePinOperations } from "./achaemenidState/usePinOperations";
import { useSegmentManagement } from "./achaemenidState/useSegmentManagement";
import { useSegmentUpdates } from "./achaemenidState/useSegmentUpdates";
import { useIoTStore } from "./useIoTStore";

export function useAchaemenidState() {
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);
  const handleApplyEspConfig = useIoTStore((s) => s.applyEspConfig);

  useConnectionStrategy();

  const { mounted } = useCloudflareQuery();

  const {
    isFullyReady,
    setIsFullyReady,
    remoteSyncEpoch,
    handleBypassSync,
    workerUrl,
    setWorkerUrl,
    handleRetrySync,
  } = useCloudflareInit({
    mounted,
    handleApplyEspConfig,
  });

  const { triggerCloudflarePush } = useCloudflarePush(isFullyReady, remoteSyncEpoch);

  const {
    isLoadingIoT,
    updatePinOnServer,
    handleTogglePin,
    handleSetPinState,
    handleBatchPinState,
  } = usePinOperations();

  const {
    targetPlaceholderId,
    clearTargetPlaceholder,
    handleAddSegment,
    handleAddPlaceholder,
    handleSetupPlaceholder,
    handleGroupColsChange,
    handleRemoveSegment,
    handleRemoveGroup,
  } = useSegmentManagement({
    setActiveWorkspaceView,
    updatePinOnServer,
  });

  const { handleUpdateSegmentMode, handleUpdateSegmentRule, handleUpdateSegmentAutoOff } =
    useSegmentUpdates();

  return {
    isLoadingIoT,
    mounted,
    refetchIot: handleRetrySync,
    isFullyReady,
    setIsFullyReady,
    targetPlaceholderId,
    clearTargetPlaceholder,
    handleApplyEspConfig,
    handleAddSegment,
    handleAddPlaceholder,
    handleSetupPlaceholder,
    handleGroupColsChange,
    handleRemoveSegment,
    handleUpdateSegmentMode,
    handleUpdateSegmentRule,
    handleUpdateSegmentAutoOff,
    handleRemoveGroup,
    handleTogglePin,
    handleSetPinState,
    handleBatchPinState,
    handleBypassSync,
    workerUrl,
    setWorkerUrl,
    handleRetrySync,
    triggerCloudflarePush,
  };
}

export const useDashboardState = useAchaemenidState;
