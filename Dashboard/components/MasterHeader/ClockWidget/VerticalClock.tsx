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
          className="group flex h-9 w-full items-center justify-center rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-control-bg)] text-[var(--sidebar-muted)] transition-colors duration-150 md:hover:bg-[var(--sidebar-hover)] md:hover:text-[var(--sidebar-text)]"
        >
          <RealTimeClock time={time} className="h-4 w-4 shrink-0" />
        </div>
      </SidebarTooltip>
    );
  }

  return (
    <div
      data-animate-icon-parent
      className="group flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-control-bg)] px-2.5 transition-colors duration-150 md:hover:bg-[var(--sidebar-hover)]"
    >
      <div className="flex items-center gap-2 text-[var(--sidebar-text)]">
        <RealTimeClock time={time} className="h-4 w-4 shrink-0 text-[var(--sidebar-muted)]" />
        <span className="font-mono text-xs font-medium tabular-nums" dir="ltr">
          {timeString}
        </span>
      </div>
      <div className="truncate text-xs font-normal tabular-nums text-[var(--sidebar-muted)] transition-colors duration-150 md:group-hover:text-[var(--sidebar-text)]">
        {dateString}
      </div>
    </div>
  );
}
