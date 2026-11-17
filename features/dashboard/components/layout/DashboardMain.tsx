"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import LowDataModeBanner from "@/features/iot/components/notifications/LowDataModeBanner";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import MobileVoiceCommandButton from "../widgets/MobileVoiceCommandButton";
import DashboardBreadcrumb from "./DashboardBreadcrumb";
import DashboardWorkspace from "./DashboardWorkspace";

function resolveScrollContainerClass(params: {
  activeWorkspaceView: string;
  workspaceDisplayMode: string;
  activeAutomationsTab: string;
  hasOrLoadingContent: boolean;
}): string {
  const { activeWorkspaceView, workspaceDisplayMode, activeAutomationsTab, hasOrLoadingContent } =
    params;

  const isHomeCanvas =
    activeWorkspaceView === "home" && workspaceDisplayMode === "canvas" && hasOrLoadingContent;

  const isWorkflowCanvas =
    activeWorkspaceView === "automations" && activeAutomationsTab === "workflows";

  if (isHomeCanvas || isWorkflowCanvas) {
    return "overflow-hidden gap-0 p-0";
  }

  const isTrellisActive =
    activeWorkspaceView === "home" && workspaceDisplayMode === "trellis" && hasOrLoadingContent;

  if (isTrellisActive) {
    return "overflow-hidden gap-3 p-2 md:p-4";
  }

  return "overflow-y-auto gap-fluid-md p-fluid-sm md:p-6 md:pb-8 md:px-8";
}

function shouldDisplayHomeBanner(params: {
  activeWorkspaceView: string;
  hasSegments: boolean;
  lowDataMode: boolean;
  manualSaveMode: boolean;
  unsavedChangesCount: number;
}): boolean {
  if (params.activeWorkspaceView !== "home" || !params.hasSegments) {
    return false;
  }

  return params.lowDataMode || (params.manualSaveMode && params.unsavedChangesCount > 0);
}

export default function DashboardMain() {
  const { isFullyReady, refetchIot, triggerCloudflarePush } = useDashboard();
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const activeWorkspaceView = useIoTStore((s) => s.activeWorkspaceView);

  const hasSegments = useIoTStore((s) => s.segments.length > 0);
  const lowDataMode = useIoTStore((s) => s.lowDataMode);
  const manualSaveMode = useIoTStore((s) => s.manualSaveMode);
  const unsavedChangesCount = useIoTStore((s) => s.unsavedChangesCount);
  const activeAutomationsTab = useIoTStore((s) => s.activeAutomationsTab);
  const workspaceDisplayMode = useIoTStore((s) => s.workspaceDisplayMode);

  const hasOrLoadingContent = !isFullyReady || hasSegments;

  const scrollModeClass = resolveScrollContainerClass({
    activeWorkspaceView,
    workspaceDisplayMode,
    activeAutomationsTab,
    hasOrLoadingContent,
  });

  const showBanner = shouldDisplayHomeBanner({
    activeWorkspaceView,
    hasSegments,
    lowDataMode,
    manualSaveMode,
    unsavedChangesCount,
  });

  return (
    <>
      <DashboardBreadcrumb />

      <div
        id="dashboard-workspace-scroll"
        tabIndex={-1}
        className={`@container/workspace custom-scrollbar flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col w-full focus:outline-none ${scrollModeClass}`}
      >
        {showBanner && (
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
        className="relative z-30 flex h-14 w-full shrink-0 items-center justify-end border-t border-sidebar-border bg-sidebar-bg px-4 md:px-8"
      >
        <div
          id="dashboard-footer-center"
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-14"
        />
        <ThemeToggle />
      </footer>

      {activeWorkspaceView === "home" && <MobileVoiceCommandButton />}
    </>
  );
}
