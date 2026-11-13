"use client";

import dynamic from "next/dynamic";
import React from "react";
import GroupFilterSelector from "@/components/MasterHeader/GroupFilterSelector";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import IoTWorkspace from "@/features/iot/components/IoTWorkspace";
import { WorkspaceSkeleton } from "@/features/iot/components/workspace";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useWorkspaceSwipe } from "../../hooks/useWorkspaceSwipe";

const MacroSidebar = dynamic(() => import("../widgets/MacroSidebar"), { ssr: false });

const WelcomePortal = dynamic(() => import("@/features/iot/components/welcome-portal"), {
  ssr: false,
});

const WorkspaceSection = dynamic(() => import("./WorkspaceSection"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-14 w-64 rounded-xl bg-[var(--card-bg)] animate-pulse border border-[var(--border-color)]" />
      <div className="h-80 w-full rounded-2xl bg-[var(--card-bg)] animate-pulse border border-[var(--border-color)]" />
    </div>
  ),
});

function preloadWorkspaceEngine(mode: "grid" | "trellis") {
  if (mode === "trellis") {
    void import("@/features/iot/components/trellis/TrellisWorkspace");
  } else {
    void import("@/features/iot/components/workspace/components/DndGridWorkspace");
  }
}

interface HomeWorkspaceMainContentProps {
  isFullyReady: boolean;
  isTrellisMode: boolean;
  segmentsLength: number;
  groupsCols: number;
  groupsOrder: string[];
  selectedGroupFilter: string | null;
  setSelectedGroupFilter: (groupId: string | null) => void;
  animationsEnabled: boolean;
}

function HomeWorkspaceMainContent({
  isFullyReady,
  isTrellisMode,
  segmentsLength,
  groupsCols,
  groupsOrder,
  selectedGroupFilter,
  setSelectedGroupFilter,
  animationsEnabled,
}: HomeWorkspaceMainContentProps) {
  const {
    sensors,
    isLoadingIoT,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleGroupColsChange,
    handleAddPlaceholder,
    handleRemoveGroup,
    handleRemoveSegment,
    handleTogglePin,
    handleSetPinState,
    handleUpdateSegmentMode,
    handleUpdateSegmentAutoOff,
    handleUpdateSegmentRule,
    handleSetupPlaceholder,
  } = useDashboard();

  const activeSegmentId = useIoTStore((s) => s.activeSegmentId);
  const activeGroupId = useIoTStore((s) => s.activeGroupId);
  const groupConfigs = useIoTStore((s) => s.groupConfigs);

  if (!isFullyReady) {
    return (
      <div className="w-full flex flex-col gap-4">
        <div className="-mt-6 sm:-mt-10 mb-2 w-full flex justify-center">
          <div className="w-32 h-10 bg-[var(--card-bg)] rounded-2xl animate-pulse border border-[var(--border-color)]" />
        </div>
        <WorkspaceSkeleton groupsCols={groupsCols} />
      </div>
    );
  }

  if (segmentsLength === 0) {
    return (
      <React.Suspense
        fallback={
          <div className="w-full h-96 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-[var(--accent3)] border-t-transparent animate-spin" />
          </div>
        }
      >
        <WelcomePortal />
      </React.Suspense>
    );
  }

  return (
    <div
      className={`w-full flex flex-col ${isTrellisMode ? "flex-1 min-h-0 h-full gap-2" : "gap-4"}`}
    >
      <div
        className={`${
          isTrellisMode ? "shrink-0" : "-mt-6 sm:-mt-10 mb-2"
        } w-full flex justify-center`}
      >
        <div className="block md:hidden w-full">
          <React.Suspense fallback={<div className="h-16 w-full" />}>
            <MacroSidebar />
          </React.Suspense>
        </div>
        <div className="hidden md:flex w-full justify-center">
          <GroupFilterSelector
            groupsOrder={groupsOrder}
            selectedGroupFilter={selectedGroupFilter}
            setSelectedGroupFilter={setSelectedGroupFilter}
            animationsEnabled={animationsEnabled}
            isCompact={isTrellisMode}
          />
        </div>
      </div>

      <div className={isTrellisMode ? "flex-1 min-h-0 w-full flex flex-col" : "w-full"}>
        <IoTWorkspace
          sensors={sensors}
          groupsOrder={groupsOrder}
          groupsCols={groupsCols}
          groupConfigs={groupConfigs}
          isLoadingIoT={isLoadingIoT}
          activeSegmentId={activeSegmentId}
          activeGroupId={activeGroupId}
          animationsEnabled={animationsEnabled}
          selectedGroupFilter={selectedGroupFilter}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragEnd={handleDragEnd}
          handleGroupColsChange={handleGroupColsChange}
          handleAddPlaceholder={handleAddPlaceholder}
          handleRemoveGroup={handleRemoveGroup}
          handleRemoveSegment={handleRemoveSegment}
          handleTogglePin={handleTogglePin}
          handleSetPinState={handleSetPinState}
          handleUpdateSegmentMode={handleUpdateSegmentMode}
          handleUpdateSegmentAutoOff={handleUpdateSegmentAutoOff}
          handleUpdateSegmentRule={handleUpdateSegmentRule}
          handleSetupPlaceholder={handleSetupPlaceholder}
        />
      </div>
    </div>
  );
}

export default function DashboardWorkspace() {
  const { isFullyReady } = useDashboard();

  const activeWorkspaceView = useIoTStore((s) => s.activeWorkspaceView);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const segmentsLength = useIoTStore((s) => s.segments.length);
  const selectedGroupFilter = useIoTStore((s) => s.selectedGroupFilter);
  const setSelectedGroupFilter = useIoTStore((s) => s.setSelectedGroupFilter);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const groupsCols = useIoTStore((s) => s.groupsCols);
  const workspaceDisplayMode = useIoTStore((s) => s.workspaceDisplayMode);

  const { onTouchStart, onTouchMove, onTouchEnd } = useWorkspaceSwipe(
    selectedGroupFilter,
    setSelectedGroupFilter,
    groupsOrder,
  );

  // Preload the active workspace engine chunk while Cloudflare config is still in flight.
  React.useEffect(() => {
    if (activeWorkspaceView !== "home") return;

    preloadWorkspaceEngine(workspaceDisplayMode);
  }, [activeWorkspaceView, workspaceDisplayMode]);

  if (activeWorkspaceView !== "home") {
    return <WorkspaceSection view={activeWorkspaceView} />;
  }

  const isTrellisMode = workspaceDisplayMode === "trellis" && isFullyReady && segmentsLength > 0;

  return (
    <div
      className={`w-full flex flex-col items-center mx-auto ${isTrellisMode ? "flex-1 min-h-0 h-full" : ""}`}
      onTouchStart={isTrellisMode ? undefined : onTouchStart}
      onTouchMove={isTrellisMode ? undefined : onTouchMove}
      onTouchEnd={isTrellisMode ? undefined : onTouchEnd}
    >
      <div className={isTrellisMode ? "hidden lg:block" : "hidden lg:block pt-[115px]"}>
        <React.Suspense fallback={<div className="w-20 lg:w-24 shrink-0 bg-transparent h-full" />}>
          <MacroSidebar />
        </React.Suspense>
      </div>
      <main
        className={`flex-1 flex flex-col items-center text-center mx-auto w-full relative ${
          isTrellisMode ? "min-h-0 h-full justify-start gap-2" : "justify-center space-y-8 py-4"
        }`}
      >
        <HomeWorkspaceMainContent
          isFullyReady={isFullyReady}
          isTrellisMode={isTrellisMode}
          segmentsLength={segmentsLength}
          groupsCols={groupsCols}
          groupsOrder={groupsOrder}
          selectedGroupFilter={selectedGroupFilter}
          setSelectedGroupFilter={setSelectedGroupFilter}
          animationsEnabled={animationsEnabled}
        />
      </main>
    </div>
  );
}
