import { HousePlug, PanelRightClose, PanelLeftClose } from "lucide-react";
import type { MasterHeaderProps } from "../types";
import BrandBox from "../BrandBox";
import ControlsIsland from "./ControlsIsland";
import SidebarTooltip from "../SidebarTooltip";

export default function VerticalHeader(props: MasterHeaderProps) {
  const { isSidebarCollapsed, setIsSidebarCollapsed } = props;

  return (
    <div
      id="vertical-master-header"
      className="flex h-full w-full flex-col gap-4 text-right font-sans [&_span]:hidden md:[&_span]:inline [&_h1]:hidden md:[&_h1]:block [&_p]:hidden md:[&_p]:block"
      dir="rtl"
    >
      <div className={`flex min-h-10 gap-2 border-b border-[var(--sidebar-border)] pb-4 ${isSidebarCollapsed ? "flex-col items-center" : "items-center justify-between"}`}>
        {isSidebarCollapsed ? (
          <SidebarTooltip label="باز کردن منوی کناری" enabled>
          <div className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--sidebar-text)]">
            <HousePlug className="h-5 w-5 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0" aria-hidden="true" strokeWidth={1.8} />
            {setIsSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                className="absolute inset-0 flex items-center justify-center rounded-md text-[var(--sidebar-muted)] opacity-0 transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent4)] group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                data-tooltip="باز کردن منوی کناری"
                aria-label="باز کردن منوی کناری"
              >
                <PanelLeftClose className="h-4 w-4 rotate-180" />
              </button>
            )}
          </div>
          </SidebarTooltip>
        ) : (
          <>
            <div className="hidden min-w-0 flex-1 md:block">
              <BrandBox headerTitle={props.headerTitle} />
            </div>
            {setIsSidebarCollapsed && (
              <SidebarTooltip label="بستن منوی کناری" enabled>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent4)]"
                data-tooltip="بستن منوی کناری"
                aria-label="بستن منوی کناری"
              >
                <PanelRightClose className="h-5 w-5" />
              </button>
              </SidebarTooltip>
            )}
          </>
        )}
      </div>

      <ControlsIsland props={props} />
    </div>
  );
}
