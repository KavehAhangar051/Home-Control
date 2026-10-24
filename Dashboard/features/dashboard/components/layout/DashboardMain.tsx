"use client";

import LowDataModeBanner from "@/features/iot/components/notifications/LowDataModeBanner";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import DashboardWorkspace from "./DashboardWorkspace";
import DashboardBreadcrumb from "./DashboardBreadcrumb";
import MobileVoiceCommandButton from "../widgets/MobileVoiceCommandButton";

export default function DashboardMain() {
  const { refetchIot, triggerCloudflarePush } = useDashboard();
  const animationsEnabled = useIoTStore(s => s.animationsEnabled);
  const activeWorkspaceView = useIoTStore(s => s.activeWorkspaceView);
  const activeGroupId = useIoTStore(s => s.activeGroupId);
  const activeSegmentId = useIoTStore(s => s.activeSegmentId);

  const segments = useIoTStore(s => s.segments);
  const lowDataMode = useIoTStore(s => s.lowDataMode);
  const manualSaveMode = useIoTStore(s => s.manualSaveMode);
  const unsavedChangesCount = useIoTStore(s => s.unsavedChangesCount);

  const isDragging = !!activeGroupId || !!activeSegmentId;

  return (
    <>
      {activeWorkspaceView === "home" && segments.length > 0 && (lowDataMode || (manualSaveMode && unsavedChangesCount > 0)) && (
        <LowDataModeBanner
          lowDataMode={lowDataMode}
          animationsEnabled={animationsEnabled}
          refetchIot={refetchIot}
          manualSaveMode={manualSaveMode}
          unsavedChangesCount={unsavedChangesCount}
          triggerCloudflarePush={triggerCloudflarePush}
        />
      )}

      <DashboardBreadcrumb />
      <DashboardWorkspace />

      {activeWorkspaceView === "home" && <MobileVoiceCommandButton />}
    </>
  );
}
