"use client";

import GroupFilterSelector from "@/components/MasterHeader/GroupFilterSelector";
import WorkspaceViewModeSelector from "@/components/MasterHeader/WorkspaceViewModeSelector";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/reui/breadcrumb";
import { House } from "@/components/ui/hugeicons-groups/shell";
import MacroSidebar from "@/features/dashboard/components/widgets/MacroSidebar";
import {
  AUTOMATIONS_TABS,
  MODULES_TABS,
  resolveSettingsTabId,
  SETTINGS_TABS,
  WORKSPACE_VIEW_META,
} from "@/features/dashboard/navigation";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useMediaQuery } from "@/features/iot/hooks/useMediaQuery";

export default function DashboardBreadcrumb() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const activeView = useIoTStore((s) => s.activeWorkspaceView);
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);
  const activeModulesTab = useIoTStore((s) => s.activeModulesTab);
  const activeAutomationsTab = useIoTStore((s) => s.activeAutomationsTab);
  const rawSettingsTab = useIoTStore((s) => s.activeSettingsTab);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const selectedGroupFilter = useIoTStore((s) => s.selectedGroupFilter);
  const setSelectedGroupFilter = useIoTStore((s) => s.setSelectedGroupFilter);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const activeMeta = WORKSPACE_VIEW_META[activeView];
  const ActiveIcon = activeMeta.navIcon;

  const subSectionMeta =
    activeView === "modules"
      ? MODULES_TABS.find((t) => t.id === activeModulesTab)
      : activeView === "automations"
        ? AUTOMATIONS_TABS.find((t) => t.id === activeAutomationsTab)
        : activeView === "settings"
          ? SETTINGS_TABS.find((t) => t.id === resolveSettingsTabId(rawSettingsTab))
          : null;

  const SubSectionIcon = subSectionMeta?.icon;

  return (
    <header
      dir="rtl"
      style={{ contain: "style" }}
      className="relative z-30 flex h-12 w-full shrink-0 items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar-bg px-3 [backface-visibility:hidden] sm:gap-3 sm:px-4 md:h-14 md:px-6 lg:px-8"
    >
      <Breadcrumb dir="rtl" className="relative z-10 min-w-0 shrink">
        <BreadcrumbList className="gap-1.5 text-sm text-sidebar-muted sm:gap-2">
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setActiveWorkspaceView("home");
              }}
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 font-medium text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
            >
              <House className="size-4 shrink-0" aria-hidden="true" />
              <span>خانه</span>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden text-sidebar-muted opacity-60 sm:inline-flex" />
          <BreadcrumbItem className="min-w-0">
            {subSectionMeta ? (
              <span className="inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 font-medium text-sidebar-muted sm:px-2">
                <ActiveIcon className="size-4 shrink-0 text-sidebar-muted" aria-hidden="true" />
                <span className="truncate">{activeMeta.title}</span>
              </span>
            ) : (
              <BreadcrumbPage className="inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 font-semibold text-sidebar-text sm:px-2">
                <ActiveIcon className="size-4 shrink-0 text-accent3" aria-hidden="true" />
                <span className="truncate">{activeMeta.title}</span>
              </BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {subSectionMeta && (
            <>
              <BreadcrumbSeparator className="inline-flex text-sidebar-muted opacity-60" />
              <BreadcrumbItem className="inline-flex min-w-0">
                <BreadcrumbPage className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm font-semibold text-sidebar-text sm:px-2">
                  {SubSectionIcon && (
                    <SubSectionIcon
                      className="size-3.5 shrink-0 text-accent3"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{subSectionMeta.compactTitle}</span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {activeView === "home" && (
        <>
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center px-4 xl:flex">
            <GroupFilterSelector
              groupsOrder={groupsOrder}
              selectedGroupFilter={selectedGroupFilter}
              setSelectedGroupFilter={setSelectedGroupFilter}
              animationsEnabled={animationsEnabled}
              isCompact
            />
          </div>
          <div className="relative z-10 hidden shrink-0 items-center gap-2 md:flex">
            {isDesktop && <MacroSidebar />}
            <WorkspaceViewModeSelector compact />
          </div>
        </>
      )}
    </header>
  );
}
