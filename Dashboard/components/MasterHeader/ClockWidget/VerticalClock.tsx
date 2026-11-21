import type React from "react";
import SidebarTooltip from "../SidebarTooltip";
import RealTimeClock, { type RealTimeClockHandle } from "./RealTimeClock";

interface VerticalClockProps {
  initialTime: Date;
  initialTimeString: string;
  dateString: string;
  isSidebarCollapsed?: boolean;
  timeTextRef: React.RefObject<HTMLSpanElement | null>;
  clockRef: React.RefObject<RealTimeClockHandle | null>;
}

export default function VerticalClock({
  initialTime,
  initialTimeString,
  dateString,
  isSidebarCollapsed,
  timeTextRef,
  clockRef,
}: VerticalClockProps) {
  if (isSidebarCollapsed) {
    return (
      <SidebarTooltip label={dateString} enabled>
        <div
          data-animate-icon-parent
          style={{ contain: "layout style" }}
          className="group flex h-9 w-full items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-control-bg text-sidebar-muted transition-colors duration-150 md:hover:bg-sidebar-hover md:hover:text-sidebar-text"
        >
          <RealTimeClock
            initialTime={initialTime}
            clockRef={clockRef}
            className="size-4 shrink-0"
          />
        </div>
      </SidebarTooltip>
    );
  }

  return (
    <div
      data-animate-icon-parent
      style={{ contain: "layout style" }}
      className="group flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-control-bg px-2.5 transition-colors duration-150 md:hover:bg-sidebar-hover"
    >
      <div className="flex items-center gap-2 text-sidebar-text">
        <RealTimeClock
          initialTime={initialTime}
          clockRef={clockRef}
          className="size-4 shrink-0 text-sidebar-muted"
        />
        <span ref={timeTextRef} className="font-mono text-xs font-medium tabular-nums" dir="ltr">
          {initialTimeString}
        </span>
      </div>
      <div className="truncate text-xs font-normal tabular-nums text-sidebar-muted transition-colors duration-150 md:group-hover:text-sidebar-text">
        {dateString}
      </div>
    </div>
  );
}
