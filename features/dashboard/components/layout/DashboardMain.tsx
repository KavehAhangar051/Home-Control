"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import LowDataModeBanner from "@/features/iot/components/notifications/LowDataModeBanner";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import MobileVoiceCommandButton from "../widgets/MobileVoiceCommandButton";
import DashboardBreadcrumb from "./DashboardBreadcrumb";
import DashboardWorkspace from "./DashboardWorkspace";

export default function DashboardMain() {
  const { refetchIot, triggerCloudflarePush } = useDashboard();
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const activeWorkspaceView = useIoTStore((s) => s.activeWorkspaceView);

  const segments = useIoTStore((s) => s.segments);
  const lowDataMode = useIoTStore((s) => s.lowDataMode);
  const manualSaveMode = useIoTStore((s) => s.manualSaveMode);
  const unsavedChangesCount = useIoTStore((s) => s.unsavedChangesCount);
  const workspaceDisplayMode = useIoTStore((s) => s.workspaceDisplayMode);

  const isTrellisCanvasActive =
    activeWorkspaceView === "home" && workspaceDisplayMode === "trellis" && segments.length > 0;

  return (
    <>
      <DashboardBreadcrumb />

      <div
        id="dashboard-workspace-scroll"
        className={`custom-scrollbar flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col w-full ${
          isTrellisCanvasActive
            ? "overflow-hidden gap-3 p-2 md:p-4"
            : "overflow-y-auto gap-8 p-3 md:p-6 md:pb-8 md:px-8"
        }`}
      >
        {activeWorkspaceView === "home" &&
          segments.length > 0 &&
          (lowDataMode || (manualSaveMode && unsavedChangesCount > 0)) && (
            <LowDataModeBanner
              lowDataMode={lowDataMode}
              animationsEnabled={animationsEnabled}
              refetchIot={refetchIot}
              manualSaveMode={manualSaveMode}
              unsavedChangesCount={unsavedChangesCount}
              triggerCloudflarePush={triggerCloudflarePush}
            />
          )}

        <DashboardWorkspace />
      </div>

      <footer
        dir="rtl"
        className="flex h-14 w-full shrink-0 items-center justify-end border-t border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 md:px-8"
      >
        <ThemeToggle />
      </footer>

      {activeWorkspaceView === "home" && <MobileVoiceCommandButton />}
    </>
  );
}
