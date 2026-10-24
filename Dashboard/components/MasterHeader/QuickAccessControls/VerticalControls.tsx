import { Settings as SettingsIcon, Layers, Clock3, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import VoiceCommandButton from "../VoiceCommandButton";
import SidebarTooltip from "../SidebarTooltip";
import type { QuickAccessControlsProps } from "./types";

type WorkspaceView = "home" | "modules" | "automations" | "settings";

export default function VerticalControls({
  setIsModulesMenuOpen,
  setIsMenuOpen,
  animationsEnabled,
  variant,
  isSidebarCollapsed,
}: QuickAccessControlsProps) {
  const setIsAutomationsMenuOpen = useIoTStore(s => s.setIsAutomationsMenuOpen);
  const activeWorkspaceView = useIoTStore(s => s.activeWorkspaceView);
  const setActiveWorkspaceView = useIoTStore(s => s.setActiveWorkspaceView);

  const itemClass = `relative flex items-center rounded-md border border-transparent text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent3-transparent)] hover:text-[var(--accent3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent4)] ${isSidebarCollapsed ? "h-10 w-10 justify-center px-0 py-0" : "w-full justify-start gap-3 px-3 py-2.5 text-right"}`;
  const navClass = (view: WorkspaceView) =>
    `${itemClass} ${activeWorkspaceView === view ? "border-[var(--accent3-medium)] bg-[var(--accent3-transparent)] text-[var(--accent3)]" : ""}`;

  const navigateTo = (view: WorkspaceView) => {
    setActiveWorkspaceView(view);
    setIsModulesMenuOpen(false);
    setIsAutomationsMenuOpen(false);
    setIsMenuOpen(false);
  };

  return (
    <nav className="space-y-1" aria-label="بخش‌های کاربری">
      {!isSidebarCollapsed && (
        <span className="mb-2 block px-3 text-xs font-medium text-[var(--sidebar-muted)]">
          فضای خانه
        </span>
      )}

      <SidebarTooltip label="داشبورد خانه" enabled={Boolean(isSidebarCollapsed)}>
      <Button variant="ghost"
        type="button"
        onClick={() => navigateTo("home")}
        className={navClass("home")}
        aria-current={activeWorkspaceView === "home" ? "page" : undefined}
        data-tooltip={isSidebarCollapsed ? "داشبورد خانه" : undefined}
        aria-label="داشبورد خانه"
      >
        <House className="h-4 w-4 shrink-0" />
        {!isSidebarCollapsed && <span className="text-sm">داشبورد خانه</span>}
      </Button>
      </SidebarTooltip>

      <SidebarTooltip label="پالایه و ماژول‌ها" enabled={Boolean(isSidebarCollapsed)}>
      <Button variant="ghost"
        type="button"
        onClick={() => navigateTo("modules")}
        className={navClass("modules")}
        aria-current={activeWorkspaceView === "modules" ? "page" : undefined}
        data-tooltip={isSidebarCollapsed ? "پالایه و ماژول‌ها" : undefined}
        aria-label="پالایه و ماژول‌ها"
      >
        <Layers className="h-4 w-4 shrink-0" />
        {!isSidebarCollapsed && <span className="text-sm">پالایه و ماژول‌ها</span>}
      </Button>
      </SidebarTooltip>

      <SidebarTooltip label="اتوماسیون‌ها" enabled={Boolean(isSidebarCollapsed)}>
      <Button variant="ghost"
        type="button"
        onClick={() => navigateTo("automations")}
        className={navClass("automations")}
        aria-current={activeWorkspaceView === "automations" ? "page" : undefined}
        data-tooltip={isSidebarCollapsed ? "اتوماسیون‌ها" : undefined}
        aria-label="اتوماسیون‌ها"
      >
        <Clock3 className="h-4 w-4 shrink-0" />
        {!isSidebarCollapsed && <span className="text-sm">اتوماسیون‌ها</span>}
      </Button>
      </SidebarTooltip>

      <VoiceCommandButton
        animationsEnabled={animationsEnabled}
        variant={variant}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      <div className="my-3 border-t border-[var(--sidebar-border)]" />

      <SidebarTooltip label="تنظیمات اصلی" enabled={Boolean(isSidebarCollapsed)}>
      <Button variant="ghost"
        type="button"
        onClick={() => navigateTo("settings")}
        className={navClass("settings")}
        aria-current={activeWorkspaceView === "settings" ? "page" : undefined}
        data-tooltip={isSidebarCollapsed ? "تنظیمات اصلی" : undefined}
        aria-label="تنظیمات اصلی"
      >
        <SettingsIcon className="h-4 w-4 shrink-0" />
        {!isSidebarCollapsed && <span className="text-sm">تنظیمات اصلی</span>}
      </Button>
      </SidebarTooltip>
    </nav>
  );
}
