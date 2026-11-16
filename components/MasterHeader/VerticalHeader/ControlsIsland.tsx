import ClockWidget from "../ClockWidget";
import QuickAccessControls from "../QuickAccessControls";
import type { MasterHeaderProps } from "../types";

export default function ControlsIsland({ props }: { props: MasterHeaderProps }) {
  const { isSidebarCollapsed } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden">
      <div className="custom-scrollbar flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-2 py-3 md:px-3">
        <QuickAccessControls
          setIsMenuOpen={props.setIsMenuOpen}
          animationsEnabled={props.animationsEnabled}
          variant="vertical"
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={props.setIsSidebarCollapsed}
        />
      </div>

      <div className="hidden h-14 shrink-0 items-center border-t border-[var(--sidebar-border)] px-2 md:flex md:px-3">
        <ClockWidget variant="vertical" isSidebarCollapsed={isSidebarCollapsed} />
      </div>
    </div>
  );
}
