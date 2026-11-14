"use client";

import { ChevronLeft } from "lucide-react";
import { AnimatePresence, m, useReducedMotion, type Variants } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AUTOMATIONS_TABS,
  MODULES_TABS,
  resolveSettingsTabId,
  SETTINGS_TABS,
  WORKSPACE_VIEW_META,
} from "@/features/dashboard/navigation";
import type { WorkspaceView } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import SidebarTooltip from "../SidebarTooltip";
import VoiceCommandButton from "../VoiceCommandButton";
import type { QuickAccessControlsProps } from "./types";

interface SubMenuItem {
  id: string;
  label: string;
}

const SUBMENU_VARIANTS: Variants = {
  closed: {
    opacity: 0,
    clipPath: "inset(0 0 100% 0 round 8px)",
    transition: {
      duration: 0.14,
      ease: EASE_OUT,
      staggerChildren: 0.025,
      staggerDirection: -1,
    },
  },
  open: {
    opacity: 1,
    clipPath: "inset(0 0 0% 0 round 8px)",
    transition: {
      duration: 0.2,
      delayChildren: 0.035,
      ease: EASE_OUT,
      staggerChildren: 0.045,
    },
  },
};

const SUBMENU_ITEM_VARIANTS: Variants = {
  closed: {
    opacity: 0,
    y: -6,
    filter: "blur(3px)",
  },
  open: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.18,
      ease: EASE_OUT,
    },
  },
};

const PRIMARY_NAV_VIEWS: readonly WorkspaceView[] = ["home", "modules", "automations"];

function getSubItemsForView(view: WorkspaceView): readonly SubMenuItem[] | null {
  switch (view) {
    case "modules":
      return MODULES_TABS.map((t) => ({ id: t.id, label: t.title }));
    case "automations":
      return AUTOMATIONS_TABS.map((t) => ({ id: t.id, label: t.title }));
    case "settings":
      return SETTINGS_TABS.map((t) => ({ id: t.id, label: t.compactTitle }));
    default:
      return null;
  }
}

export default function VerticalControls({
  animationsEnabled = true,
  variant,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
}: QuickAccessControlsProps) {
  const activeWorkspaceView = useIoTStore((s) => s.activeWorkspaceView);
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);
  const activeModulesTab = useIoTStore((s) => s.activeModulesTab);
  const setActiveModulesTab = useIoTStore((s) => s.setActiveModulesTab);
  const activeAutomationsTab = useIoTStore((s) => s.activeAutomationsTab);
  const setActiveAutomationsTab = useIoTStore((s) => s.setActiveAutomationsTab);
  const rawActiveSettingsTab = useIoTStore((s) => s.activeSettingsTab);
  const setActiveSettingsTab = useIoTStore((s) => s.setActiveSettingsTab);

  const activeSettingsTab = resolveSettingsTabId(rawActiveSettingsTab);
  const prefersReduced = useReducedMotion();
  const reduceMotion = Boolean(prefersReduced) || !animationsEnabled;

  const [accordionState, setAccordionState] = useState<{
    forView: WorkspaceView;
    open: WorkspaceView | null;
  }>(() => ({
    forView: activeWorkspaceView,
    open: activeWorkspaceView !== "home" ? activeWorkspaceView : null,
  }));

  const openSection =
    accordionState.forView === activeWorkspaceView
      ? accordionState.open
      : activeWorkspaceView !== "home"
        ? activeWorkspaceView
        : null;

  const itemClass = `relative flex items-center rounded-md border border-transparent text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent3-transparent)] hover:text-[var(--accent3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent4)] ${
    isSidebarCollapsed
      ? "h-10 w-10 justify-center px-0 py-0"
      : "w-full justify-between gap-2 px-3 py-2.5 text-right"
  }`;

  const getActiveSubItemId = (view: WorkspaceView): string | null => {
    if (activeWorkspaceView !== view) return null;

    if (view === "modules") return activeModulesTab;

    if (view === "automations") return activeAutomationsTab;

    if (view === "settings") return activeSettingsTab;

    return null;
  };

  const handleParentClick = (view: WorkspaceView, hasChildren: boolean) => {
    if (!hasChildren) {
      setAccordionState({ forView: view, open: null });
      setActiveWorkspaceView(view);

      return;
    }

    if (isSidebarCollapsed) {
      setIsSidebarCollapsed?.(false);
      setAccordionState({ forView: activeWorkspaceView, open: view });

      return;
    }

    setAccordionState({
      forView: activeWorkspaceView,
      open: openSection === view ? null : view,
    });
  };

  const handleSubItemClick = (view: WorkspaceView, subId: string) => {
    if (view === "modules") {
      setActiveModulesTab(subId === "list" ? "list" : "add");
    } else if (view === "automations") {
      setActiveAutomationsTab(
        subId === "manage" ? "manage" : subId === "workflows" ? "workflows" : "create",
      );
    } else if (view === "settings") {
      setActiveSettingsTab(subId);
    }

    setAccordionState({ forView: view, open: view });
    setActiveWorkspaceView(view);
  };

  const renderNavItem = (view: WorkspaceView) => {
    const meta = WORKSPACE_VIEW_META[view];
    const NavIcon = meta.navIcon;
    const subItems = getSubItemsForView(view);
    const hasChildren = Boolean(subItems && subItems.length > 0);
    const isExpanded = hasChildren && openSection === view && !isSidebarCollapsed;
    const isParentActive = activeWorkspaceView === view;
    const activeSubId = getActiveSubItemId(view);

    return (
      <div key={view} className="min-w-0">
        <SidebarTooltip label={meta.title} enabled={Boolean(isSidebarCollapsed)}>
          <Button
            variant="ghost"
            type="button"
            onClick={() => handleParentClick(view, hasChildren)}
            className={`${itemClass} ${
              isParentActive
                ? "border-[var(--accent3-medium)] bg-[var(--accent3-transparent)] text-[var(--accent3)]"
                : ""
            }`}
            aria-current={isParentActive && !hasChildren ? "page" : undefined}
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-label={meta.title}
          >
            <div className="flex min-w-0 items-center gap-3">
              <NavIcon className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span className="truncate text-sm">{meta.title}</span>}
            </div>
            {!isSidebarCollapsed && hasChildren && (
              <ChevronLeft
                aria-hidden="true"
                className={`h-3.5 w-3.5 shrink-0 text-[var(--sidebar-muted)] transition-transform duration-200 ${
                  isExpanded ? "-rotate-90 text-[var(--accent3)]" : "rotate-0"
                }`}
              />
            )}
          </Button>
        </SidebarTooltip>

        <AnimatePresence initial={false} mode="popLayout">
          {isExpanded && subItems && (
            <m.ul
              key={`${view}-submenu`}
              variants={reduceMotion ? undefined : SUBMENU_VARIANTS}
              initial={reduceMotion ? false : "closed"}
              animate={reduceMotion ? { opacity: 1 } : "open"}
              exit={reduceMotion ? { opacity: 0 } : "closed"}
              transition={reduceMotion ? { duration: 0.12 } : undefined}
              aria-label={`زیرمنوی ${meta.title}`}
              className="relative mt-1 mr-4 hidden min-w-0 flex-col gap-0.5 border-r border-[var(--sidebar-border)] pr-2.5 md:flex"
            >
              {subItems.map((sub) => {
                const isSubActive = activeSubId === sub.id;

                return (
                  <m.li
                    key={sub.id}
                    variants={reduceMotion ? undefined : SUBMENU_ITEM_VARIANTS}
                    className="relative min-w-0"
                  >
                    <button
                      type="button"
                      onClick={() => handleSubItemClick(view, sub.id)}
                      aria-current={isSubActive ? "page" : undefined}
                      className={`relative flex w-full cursor-pointer items-center rounded-md px-2.5 py-1.5 text-right text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent3)] ${
                        isSubActive
                          ? "font-semibold text-[var(--accent3)]"
                          : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
                      }`}
                    >
                      {isSubActive && (
                        <m.div
                          layoutId="sidebar-submenu-active-bg"
                          transition={reduceMotion ? { duration: 0 } : SPRING_LAYOUT}
                          className="absolute inset-0 rounded-md border border-[var(--accent3-medium)] bg-[var(--accent3-transparent)]"
                        />
                      )}
                      <span className="relative z-10 truncate leading-5">{sub.label}</span>
                    </button>
                  </m.li>
                );
              })}
            </m.ul>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <nav className="space-y-1" aria-label="بخش‌های کاربری">
      {!isSidebarCollapsed && (
        <span className="mb-2 block px-3 text-xs font-medium text-[var(--sidebar-muted)]">
          فضای خانه
        </span>
      )}

      {PRIMARY_NAV_VIEWS.map(renderNavItem)}

      <VoiceCommandButton
        animationsEnabled={animationsEnabled}
        variant={variant}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      <div className="my-3 border-t border-[var(--sidebar-border)]" />

      {renderNavItem("settings")}
    </nav>
  );
}
