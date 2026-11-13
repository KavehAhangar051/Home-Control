import { HousePlug, PanelLeftClose, PanelRightClose } from "@/components/ui/hugeicons";
import { Toggle } from "@/components/ui/toggle";
import BrandBox from "../BrandBox";
import SidebarTooltip from "../SidebarTooltip";
import type { MasterHeaderProps } from "../types";
import ControlsIsland from "./ControlsIsland";

export default function VerticalHeader(props: MasterHeaderProps) {
  const { isSidebarCollapsed, setIsSidebarCollapsed } = props;

  return (
    <div
      id="vertical-master-header"
      className="flex h-full w-full flex-col text-right font-sans [&_span]:hidden md:[&_span]:inline [&_h1]:hidden md:[&_h1]:block [&_p]:hidden md:[&_p]:block"
      dir="rtl"
    >
      <div
        className={`flex h-14 shrink-0 items-center gap-2 border-b border-[var(--sidebar-border)] px-2 md:px-3 ${isSidebarCollapsed ? "justify-center" : "justify-between"}`}
      >
        {isSidebarCollapsed ? (
          <SidebarTooltip label="باز کردن منوی کناری" enabled>
            {setIsSidebarCollapsed ? (
              <Toggle
                pressed={false}
                onPressedChange={() => setIsSidebarCollapsed(false)}
                aria-label="باز کردن منوی کناری"
                className="group relative flex h-9 w-9 min-w-9 shrink-0 items-center justify-center rounded-md bg-transparent p-0 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] aria-pressed:bg-transparent data-[state=on]:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent4)]"
              >
                <div className="flex items-center justify-center transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] scale-100 opacity-100 group-hover/toggle:scale-50 group-hover/toggle:opacity-0 group-focus-visible/toggle:scale-50 group-focus-visible/toggle:opacity-0">
                  <HousePlug className="size-5" aria-hidden="true" strokeWidth={2} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-[var(--sidebar-muted)] scale-50 opacity-0 transition-[opacity,transform,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover/toggle:scale-100 group-hover/toggle:opacity-100 group-hover/toggle:text-[var(--sidebar-text)] group-focus-visible/toggle:scale-100 group-focus-visible/toggle:opacity-100 group-focus-visible/toggle:text-[var(--sidebar-text)]">
                  <PanelLeftClose
                    className="size-5 rotate-180"
                    aria-hidden="true"
                    strokeWidth={2}
                  />
                </div>
              </Toggle>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--sidebar-text)]">
                <HousePlug className="size-5" aria-hidden="true" strokeWidth={2} />
              </div>
            )}
          </SidebarTooltip>
        ) : (
          <>
            <div className="hidden min-w-0 flex-1 md:block">
              <BrandBox headerTitle={props.headerTitle} />
            </div>
            {setIsSidebarCollapsed && (
              <SidebarTooltip label="بستن منوی کناری" enabled>
                <Toggle
                  pressed={true}
                  onPressedChange={() => setIsSidebarCollapsed(true)}
                  aria-label="بستن منوی کناری"
                  className="flex h-9 w-9 min-w-9 shrink-0 items-center justify-center rounded-md bg-transparent p-0 text-[var(--sidebar-muted)] transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)] aria-pressed:bg-transparent data-[state=on]:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent4)]"
                >
                  <PanelRightClose className="size-5" strokeWidth={2} />
                </Toggle>
              </SidebarTooltip>
            )}
          </>
        )}
      </div>

      <ControlsIsland props={props} />
    </div>
  );
}
