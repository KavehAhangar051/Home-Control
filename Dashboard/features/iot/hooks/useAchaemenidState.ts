"use client";

import { useAchaemenidDnd } from "./achaemenidState/useAchaemenidDnd";
import { useApplyEspConfig } from "./achaemenidState/useApplyEspConfig";
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

  useConnectionStrategy();

  const { mounted, refetchIot } = useCloudflareQuery();
  const { handleApplyEspConfig } = useApplyEspConfig();

  const {
    isFullyReady,
    setIsFullyReady,
    handleBypassSync,
    workerUrl,
    setWorkerUrl,
    handleRetrySync,
  } = useCloudflareInit({
    mounted,
    handleApplyEspConfig,
  });

  const { triggerCloudflarePush } = useCloudflarePush(isFullyReady);

  const {
    isLoadingIoT,
    updatePinOnServer,
    handleTogglePin,
    handleSetPinState,
    handleBatchPinState,
  } = usePinOperations({
    refetchIot,
  });

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

  const dnd = useAchaemenidDnd({
    handleRemoveGroup,
    handleRemoveSegment,
  });

  return {
    isLoadingIoT,
    mounted,
    refetchIot,
    isFullyReady,
    setIsFullyReady,
    ...dnd,
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
