"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import LowDataModeBanner from "@/features/iot/components/notifications/LowDataModeBanner";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useMediaQuery } from "@/features/iot/hooks/useMediaQuery";
import { setPortalTarget } from "@/lib/hooks/use-portal-target";
import DashboardBreadcrumb from "./DashboardBreadcrumb";
import DashboardWorkspace from "./DashboardWorkspace";
import MobileDockNav from "./MobileDockNav";

const registerFooterCenterPortal = (node: HTMLDivElement | null) => {
  setPortalTarget("dashboard-footer-center", node);
};

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
    return "overflow-hidden gap-3 p-2 pb-20 md:p-4";
  }

  return "overflow-y-auto gap-fluid-sm p-2.5 pb-24 sm:p-fluid-sm md:p-6 md:pb-8 md:px-8";
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
  const isDesktop = useMediaQuery("(min-width: 768px)");
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
        className={`@container/workspace custom-scrollbar overscroll-y-contain flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col w-full focus:outline-none ${scrollModeClass}`}
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
        style={{ contain: "style" }}
        className="relative z-30 hidden h-14 w-full shrink-0 items-center justify-end border-t border-sidebar-border bg-sidebar-bg px-4 [backface-visibility:hidden] md:flex md:px-8"
      >
        {isDesktop && (
          <>
            <div
              id="dashboard-footer-center"
              ref={registerFooterCenterPortal}
              className="pointer-events-none absolute inset-0 flex items-center justify-center px-14"
            />
            <ThemeToggle />
          </>
        )}
      </footer>

      <MobileDockNav />
    </>
  );
}
