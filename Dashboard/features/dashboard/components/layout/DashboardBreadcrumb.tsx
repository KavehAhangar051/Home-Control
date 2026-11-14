"use client";

import GroupFilterSelector from "@/components/MasterHeader/GroupFilterSelector";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/reui/breadcrumb";
import { House } from "@/components/ui/hugeicons";
import {
  AUTOMATIONS_TABS,
  MODULES_TABS,
  resolveSettingsTabId,
  SETTINGS_TABS,
  WORKSPACE_VIEW_META,
} from "@/features/dashboard/navigation";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export default function DashboardBreadcrumb() {
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

  const subSectionTitle =
    activeView === "modules"
      ? MODULES_TABS.find((t) => t.id === activeModulesTab)?.compactTitle
      : activeView === "automations"
        ? AUTOMATIONS_TABS.find((t) => t.id === activeAutomationsTab)?.compactTitle
        : activeView === "settings"
          ? SETTINGS_TABS.find((t) => t.id === resolveSettingsTabId(rawSettingsTab))?.compactTitle
          : null;

  return (
    <header
      dir="rtl"
      className="relative flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-3 sm:px-4 md:px-8"
    >
      <Breadcrumb dir="rtl" className="relative z-10 min-w-0 shrink-0">
        <BreadcrumbList className="gap-1.5 text-sm text-[var(--sidebar-muted)] sm:gap-2">
          <BreadcrumbItem>
            <BreadcrumbLink
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setActiveWorkspaceView("home");
              }}
              className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 font-medium text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent3)]"
            >
              <House className="size-4 shrink-0" aria-hidden="true" />
              <span className="hidden xs:inline sm:inline">خانه</span>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-[var(--sidebar-muted)] opacity-60" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="inline-flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 font-semibold text-[var(--sidebar-text)]">
              <ActiveIcon className="size-4 shrink-0 text-[var(--accent3)]" aria-hidden="true" />
              <span className="truncate">{activeMeta.title}</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
          {subSectionTitle && (
            <>
              <BreadcrumbSeparator className="hidden text-[var(--sidebar-muted)] opacity-60 sm:inline-flex" />
              <BreadcrumbItem className="hidden min-w-0 sm:inline-flex">
                <BreadcrumbPage className="truncate rounded-md px-1.5 py-1 text-xs font-medium text-[var(--sidebar-muted)]">
                  {subSectionTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {activeView === "home" && (
        <div className="pointer-events-none hidden md:flex absolute inset-0 items-center justify-center px-4">
          <GroupFilterSelector
            groupsOrder={groupsOrder}
            selectedGroupFilter={selectedGroupFilter}
            setSelectedGroupFilter={setSelectedGroupFilter}
            animationsEnabled={animationsEnabled}
            isCompact
          />
        </div>
      )}
    </header>
  );
}
