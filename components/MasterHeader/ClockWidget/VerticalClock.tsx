import SidebarTooltip from "../SidebarTooltip";
import RealTimeClock from "./RealTimeClock";

interface VerticalClockProps {
  time: Date;
  timeString: string;
  dateString: string;
  isSidebarCollapsed?: boolean;
}

export default function VerticalClock({
  time,
  timeString,
  dateString,
  isSidebarCollapsed,
}: VerticalClockProps) {
  if (isSidebarCollapsed) {
    return (
      <SidebarTooltip label={dateString} enabled>
        <div
          data-animate-icon-parent
          className="group flex h-9 w-full items-center justify-center rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-control-bg)] text-[var(--sidebar-muted)] transition-colors md:hover:bg-[var(--sidebar-hover)] md:hover:text-[var(--sidebar-text)]"
        >
          <RealTimeClock time={time} className="h-4 w-4 shrink-0" />
        </div>
      </SidebarTooltip>
    );
  }

  return (
    <div
      data-animate-icon-parent
      className="group flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-control-bg)] px-2.5 transition-colors md:hover:bg-[var(--sidebar-hover)]"
    >
      <div className="flex items-center gap-1.5 text-[var(--sidebar-text)]">
        <RealTimeClock time={time} className="h-4 w-4 shrink-0" />
        <span className="font-mono text-xs font-bold tabular-nums tracking-wider" dir="ltr">
          {timeString}
        </span>
      </div>
      <div className="truncate text-[11px] font-medium tabular-nums text-[var(--sidebar-muted)] transition-colors md:group-hover:text-[var(--sidebar-text)]">
        {dateString}
      </div>
    </div>
  );
}
