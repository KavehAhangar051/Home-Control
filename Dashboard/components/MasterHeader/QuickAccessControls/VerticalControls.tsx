import { Button } from "@/components/ui/button";
import { WORKSPACE_VIEW_META } from "@/features/dashboard/navigation";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { WorkspaceView } from "@/features/iot/hooks/store/types";
import VoiceCommandButton from "../VoiceCommandButton";
import SidebarTooltip from "../SidebarTooltip";
import type { QuickAccessControlsProps } from "./types";

const PRIMARY_NAV_VIEWS: readonly WorkspaceView[] = ["home", "modules", "automations"];

export default function VerticalControls({
  animationsEnabled,
  variant,
  isSidebarCollapsed,
}: QuickAccessControlsProps) {
  const activeWorkspaceView = useIoTStore((s) => s.activeWorkspaceView);
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);

  const itemClass = `relative flex items-center rounded-md border border-transparent text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent3-transparent)] hover:text-[var(--accent3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent4)] ${isSidebarCollapsed ? "h-10 w-10 justify-center px-0 py-0" : "w-full justify-start gap-3 px-3 py-2.5 text-right"}`;
  const navClass = (view: WorkspaceView) =>
    `${itemClass} ${activeWorkspaceView === view ? "border-[var(--accent3-medium)] bg-[var(--accent3-transparent)] text-[var(--accent3)]" : ""}`;

  const renderNavItem = (view: WorkspaceView) => {
    const meta = WORKSPACE_VIEW_META[view];
    const NavIcon = meta.navIcon;
    return (
      <SidebarTooltip key={view} label={meta.title} enabled={Boolean(isSidebarCollapsed)}>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setActiveWorkspaceView(view)}
          className={navClass(view)}
          aria-current={activeWorkspaceView === view ? "page" : undefined}
          data-tooltip={isSidebarCollapsed ? meta.title : undefined}
          aria-label={meta.title}
        >
          <NavIcon className="h-4 w-4 shrink-0" />
          {!isSidebarCollapsed && <span className="text-sm">{meta.title}</span>}
        </Button>
      </SidebarTooltip>
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
