"use client";

/**
 * @file features/dashboard/components/layout/MobileDockNav.tsx
 * @description Mobile-only floating bottom navigation combining beui.dev Dock and ExpandableTabs.
 * Replaces the desktop right rail, mobile bottom footer, mobile top view-mode switcher, and
 * floating voice button on screens narrower than `md` (768px).
 */

import {
  Check,
  ChevronLeft,
  LayoutGrid,
  type LucideIcon,
  PanelsTopLeft,
  Play,
  Settings2,
  Workflow,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DockItem, DockSeparator } from "@/components/motion/dock";
import { ExpandableTabs, type ExpandableTabsItem } from "@/components/motion/expandable-tabs";
import { resolveMobileDockTabAction } from "@/components/motion/expandable-tabs-layout";
import { Clock3, House, Layers, Mic, Settings } from "@/components/ui/hugeicons-groups/shell";
import {
  filterVisibleMacros,
  isMultiCharTextIcon,
  MacroGlyph,
} from "@/features/dashboard/components/widgets/MacroSidebar";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import { useMobileVoiceCommand } from "@/features/dashboard/hooks/useMobileVoiceCommand";
import {
  AUTOMATIONS_TABS,
  type AutomationsTabId,
  MODULES_TABS,
  type ModulesTabId,
  resolveSettingsTabId,
  SETTINGS_TABS,
  type SettingsTabId,
} from "@/features/dashboard/navigation";
import type { Macro, WorkspaceDisplayMode, WorkspaceView } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type MobileDockTabId = WorkspaceView | "macros";

const DISPLAY_MODE_OPTIONS: ReadonlyArray<{
  id: WorkspaceDisplayMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: "grid", label: "ستونی", icon: LayoutGrid },
  { id: "trellis", label: "آزاد", icon: PanelsTopLeft },
  { id: "canvas", label: "شیت بوم", icon: Workflow },
];

const DIRECT_NAV_VIEWS: readonly MobileDockTabId[] = ["home"];

interface DockSubRowProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
}

function DockSubRow({ label, icon: Icon, isActive, onClick }: DockSubRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-10 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-right text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
        isActive
          ? "bg-sidebar-hover text-text-primary dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "text-text-secondary hover:bg-sidebar-hover/70 hover:text-text-primary",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn("size-3.5 shrink-0", isActive ? "text-accent3" : "text-text-muted")}
        />
        <span className="truncate">{label}</span>
      </span>
      {isActive ? (
        <Check className="size-3.5 shrink-0 text-accent3" aria-hidden="true" />
      ) : (
        <ChevronLeft className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Floating mobile bottom Dock with upward-morphing ExpandableTabs panels,
 * custom buttons (macros) launcher, and integrated Voice Command.
 */
export default function MobileDockNav() {
  const { handleExecuteMacro: runMacro } = useDashboard();
  const activeWorkspaceView = useIoTStore((s) => s.activeWorkspaceView);
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);
  const activeModulesTab = useIoTStore((s) => s.activeModulesTab);
  const setActiveModulesTab = useIoTStore((s) => s.setActiveModulesTab);
  const activeAutomationsTab = useIoTStore((s) => s.activeAutomationsTab);
  const setActiveAutomationsTab = useIoTStore((s) => s.setActiveAutomationsTab);
  const rawSettingsTab = useIoTStore((s) => s.activeSettingsTab);
  const setActiveSettingsTab = useIoTStore((s) => s.setActiveSettingsTab);
  const workspaceDisplayMode = useIoTStore((s) => s.workspaceDisplayMode);
  const setWorkspaceDisplayMode = useIoTStore((s) => s.setWorkspaceDisplayMode);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const selectedGroupFilter = useIoTStore((s) => s.selectedGroupFilter);
  const setSelectedGroupFilter = useIoTStore((s) => s.setSelectedGroupFilter);
  const macros = useIoTStore((s) => s.macros);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const activeGroupId = useIoTStore((s) => s.activeGroupId);
  const activeSegmentId = useIoTStore((s) => s.activeSegmentId);

  const visibleMacros = useMemo(() => filterVisibleMacros(macros), [macros]);
  const activeSettingsTab = resolveSettingsTabId(rawSettingsTab);
  const [openPanel, setOpenPanel] = useState<MobileDockTabId | null>(null);
  const [recentMacroId, setRecentMacroId] = useState<string | null>(null);

  const { isListening, handlePointerDown, handlePointerUp, handlePointerCancel } =
    useMobileVoiceCommand();

  useEffect(() => {
    if (!recentMacroId) return;

    const timer = setTimeout(() => setRecentMacroId(null), 900);

    return () => clearTimeout(timer);
  }, [recentMacroId]);

  const handleExecuteMacro = useCallback(
    (macro: Macro) => {
      triggerHaptic("macro");
      void runMacro(macro);
      setRecentMacroId(macro.id);
      setOpenPanel(null);
    },
    [runMacro],
  );

  const handleManageMacros = useCallback(() => {
    triggerHaptic("tap");
    setActiveSettingsTab("macros");
    setActiveWorkspaceView("settings");
    setOpenPanel(null);
  }, [setActiveSettingsTab, setActiveWorkspaceView]);

  const handleSelectModulesTab = useCallback(
    (tabId: ModulesTabId) => {
      triggerHaptic("tap");
      setActiveModulesTab(tabId);
      setActiveWorkspaceView("modules");
      setOpenPanel(null);
    },
    [setActiveModulesTab, setActiveWorkspaceView],
  );

  const handleSelectAutomationsTab = useCallback(
    (tabId: AutomationsTabId) => {
      triggerHaptic("tap");
      setActiveAutomationsTab(tabId);
      setActiveWorkspaceView("automations");
      setOpenPanel(null);
    },
    [setActiveAutomationsTab, setActiveWorkspaceView],
  );

  const handleSelectSettingsTab = useCallback(
    (tabId: SettingsTabId) => {
      triggerHaptic("tap");
      setActiveSettingsTab(tabId);
      setActiveWorkspaceView("settings");
      setOpenPanel(null);
    },
    [setActiveSettingsTab, setActiveWorkspaceView],
  );

  const handleSelectDisplayMode = useCallback(
    (mode: WorkspaceDisplayMode) => {
      triggerHaptic("tap");
      setWorkspaceDisplayMode(mode);
      setActiveWorkspaceView("home");
      setOpenPanel(null);
    },
    [setWorkspaceDisplayMode, setActiveWorkspaceView],
  );

  const handleSelectGroupFilter = useCallback(
    (group: string | null) => {
      triggerHaptic("tap");
      setSelectedGroupFilter(group);
      setOpenPanel(null);
    },
    [setSelectedGroupFilter],
  );

  const handleTabClick = useCallback(
    (id: string) => {
      triggerHaptic("tap");
      const clicked = id as MobileDockTabId;

      if (clicked === "macros") {
        setOpenPanel((current) => (current === "macros" ? null : "macros"));

        return;
      }

      const result = resolveMobileDockTabAction<MobileDockTabId>({
        clickedTabId: clicked,
        activeWorkspaceView,
        openPanelId: openPanel,
        directNavigateViews: DIRECT_NAV_VIEWS,
      });

      if (result.navigateToView && result.navigateToView !== "macros") {
        setActiveWorkspaceView(result.navigateToView);
      }

      setOpenPanel(result.nextOpenPanelId);
    },
    [activeWorkspaceView, openPanel, setActiveWorkspaceView],
  );

  const items = useMemo<ExpandableTabsItem[]>(() => {
    const baseItems: ExpandableTabsItem[] = [
      {
        id: "home",
        label: "خانه",
        icon: <House className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />,
        content: (
          <div className="flex w-[min(19rem,calc(100vw-3rem))] flex-col gap-3 p-1" dir="rtl">
            <div className="space-y-1.5">
              <span className="block px-1 text-[11px] font-medium text-text-muted">
                فرم نمایش داشبورد
              </span>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border-color bg-bg-main p-1">
                {DISPLAY_MODE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isActive = workspaceDisplayMode === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleSelectDisplayMode(option.id)}
                      className={cn(
                        "flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                        isActive
                          ? "bg-accent3 text-accent3-foreground shadow-2xs"
                          : "text-text-secondary hover:text-text-primary",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="whitespace-nowrap">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {groupsOrder.length > 0 && (
              <div className="space-y-1.5 border-t border-border-color/70 pt-2.5">
                <span className="block px-1 text-[11px] font-medium text-text-muted">
                  فیلتر گروه
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    aria-pressed={selectedGroupFilter === null}
                    onClick={() => handleSelectGroupFilter(null)}
                    className={cn(
                      "min-h-8 cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                      selectedGroupFilter === null
                        ? "border-accent3 bg-accent3/15 text-text-primary"
                        : "border-border-color bg-bg-main text-text-secondary hover:text-text-primary",
                    )}
                  >
                    همه گروه‌ها
                  </button>
                  {groupsOrder.map((group) => {
                    const isSelected = selectedGroupFilter === group;

                    return (
                      <button
                        key={group}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectGroupFilter(group)}
                        className={cn(
                          "min-h-8 max-w-[11rem] cursor-pointer truncate rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                          isSelected
                            ? "border-accent3 bg-accent3/15 text-text-primary"
                            : "border-border-color bg-bg-main text-text-secondary hover:text-text-primary",
                        )}
                      >
                        {group}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "modules",
        label: "ماژول‌ها",
        icon: <Layers className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />,
        content: (
          <div className="flex w-[min(17.5rem,calc(100vw-3rem))] flex-col gap-0.5 p-0.5" dir="rtl">
            {MODULES_TABS.map((tab) => (
              <DockSubRow
                key={tab.id}
                label={tab.title}
                icon={tab.icon}
                isActive={activeWorkspaceView === "modules" && activeModulesTab === tab.id}
                onClick={() => handleSelectModulesTab(tab.id)}
              />
            ))}
          </div>
        ),
      },
      {
        id: "automations",
        label: "اتوماسیون",
        icon: <Clock3 className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />,
        content: (
          <div className="flex w-[min(17.5rem,calc(100vw-3rem))] flex-col gap-0.5 p-0.5" dir="rtl">
            {AUTOMATIONS_TABS.map((tab) => (
              <DockSubRow
                key={tab.id}
                label={tab.title}
                icon={tab.icon}
                isActive={activeWorkspaceView === "automations" && activeAutomationsTab === tab.id}
                onClick={() => handleSelectAutomationsTab(tab.id)}
              />
            ))}
          </div>
        ),
      },
      {
        id: "settings",
        label: "تنظیمات",
        icon: <Settings className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />,
        content: (
          <div className="grid w-[min(21rem,calc(100vw-3rem))] grid-cols-2 gap-1 p-0.5" dir="rtl">
            {SETTINGS_TABS.map((tab) => {
              const isActive = activeWorkspaceView === "settings" && activeSettingsTab === tab.id;
              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectSettingsTab(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 w-full cursor-pointer items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-right text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                    isActive
                      ? "bg-sidebar-hover text-text-primary dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "text-text-secondary hover:bg-sidebar-hover/70 hover:text-text-primary",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <TabIcon
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className={cn(
                        "size-3.5 shrink-0",
                        isActive ? "text-accent3" : "text-text-muted",
                      )}
                    />
                    <span className="truncate">{tab.compactTitle}</span>
                  </span>
                  {isActive && (
                    <Check className="size-3.5 shrink-0 text-accent3" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ),
      },
    ];

    if (visibleMacros.length > 0) {
      baseItems.push({
        id: "macros",
        label: "سفارشی",
        icon: <Zap className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />,
        content: (
          <div className="flex w-[min(19rem,calc(100vw-3rem))] flex-col gap-1.5 p-0.5" dir="rtl">
            <div className="flex items-center justify-between border-b border-border-color/70 px-2 pb-1.5">
              <span className="text-[11px] font-medium text-text-muted">دکمه‌های سفارشی</span>
              <span className="font-mono text-[10px] tabular-nums text-text-muted">
                {visibleMacros.length} مورد
              </span>
            </div>

            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {visibleMacros.map((macro) => {
                const isRecent = recentMacroId === macro.id;

                return (
                  <button
                    key={macro.id}
                    type="button"
                    onClick={() => handleExecuteMacro(macro)}
                    aria-label={`اجرای دکمه سفارشی ${macro.title}`}
                    className={cn(
                      "group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-right transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 active:scale-[0.99]",
                      isRecent
                        ? "bg-accent3/15 text-text-primary"
                        : "bg-bg-main/60 text-text-primary hover:bg-sidebar-hover",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 shrink-0 items-center justify-center rounded-lg border border-border-color bg-secondary text-accent3 transition-colors group-hover:border-accent3/50 group-hover:bg-accent3 group-hover:text-accent3-foreground",
                          isMultiCharTextIcon(macro.icon) ? "min-w-8 px-1" : "w-8",
                        )}
                      >
                        <MacroGlyph icon={macro.icon} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-text-primary">
                          {macro.title}
                        </span>
                        <span className="block text-[11px] text-text-muted">
                          {macro.actions.length} فرمان هم‌زمان
                        </span>
                      </span>
                    </span>
                    <Play
                      aria-hidden="true"
                      strokeWidth={2}
                      className="size-3.5 shrink-0 text-text-muted opacity-80 transition-colors group-hover:text-accent3"
                    />
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border-color/70 pt-1">
              <button
                type="button"
                onClick={handleManageMacros}
                className="flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-sidebar-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
              >
                <Settings2 aria-hidden="true" className="size-3.5 shrink-0" />
                <span>مدیریت دکمه‌های سفارشی</span>
              </button>
            </div>
          </div>
        ),
      });
    }

    return baseItems;
  }, [
    activeAutomationsTab,
    activeModulesTab,
    activeSettingsTab,
    activeWorkspaceView,
    groupsOrder,
    handleExecuteMacro,
    handleManageMacros,
    handleSelectAutomationsTab,
    handleSelectDisplayMode,
    handleSelectGroupFilter,
    handleSelectModulesTab,
    handleSelectSettingsTab,
    recentMacroId,
    selectedGroupFilter,
    visibleMacros,
    workspaceDisplayMode,
  ]);

  const isDragging = Boolean(activeGroupId || activeSegmentId);

  if (isDragging) {
    return null;
  }

  return (
    <nav
      aria-label="ناوبری پایین موبایل"
      className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="pointer-events-auto">
        <ExpandableTabs
          items={items}
          value={openPanel}
          onValueChange={(next) => setOpenPanel(next as MobileDockTabId | null)}
          onTabClick={handleTabClick}
          activeNavId={activeWorkspaceView}
          dir="rtl"
          labels={{ label: "بخش‌های داشبورد" }}
          trailing={
            <>
              <DockSeparator />
              <DockItem
                active={isListening}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onContextMenu={(event) => event.preventDefault()}
                touchAction="none"
                aria-label={isListening ? "در حال شنیدن فرمان صوتی" : "فرمان صوتی (نگه دارید)"}
                className={cn(
                  "!size-10 rounded-[18px] transition-colors duration-150",
                  isListening
                    ? "bg-accent4 text-accent4-foreground hover:text-accent4-foreground"
                    : "text-text-secondary hover:bg-sidebar-hover hover:text-text-primary",
                )}
              >
                <Mic
                  strokeWidth={1.6}
                  aria-hidden="true"
                  className={cn(
                    "size-[18px]",
                    isListening && animationsEnabled ? "animate-pulse" : "",
                  )}
                />
              </DockItem>
            </>
          }
        />
      </div>
    </nav>
  );
}
