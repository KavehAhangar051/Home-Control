import RealTimeClock from "./RealTimeClock";

interface HorizontalClockProps {
  time: Date;
  timeString: string;
  dateString: string;
}

export default function HorizontalClock({ time, timeString, dateString }: HorizontalClockProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--card-bg-solid)] md:hover:bg-[var(--card-hover-bg)] border border-[var(--border-color)] rounded-xl transition-[background-color,border-color] duration-150 group cursor-default">
      <RealTimeClock
        time={time}
        className="w-4 h-4 text-[var(--text-tertiary)] md:group-hover:text-[var(--accent3)] transition-colors duration-150 shrink-0"
      />
      <div className="flex flex-col items-start justify-center">
        <span
          className="font-mono font-bold text-sm tabular-nums text-[var(--text-primary)] md:group-hover:text-[var(--accent3)] transition-colors"
          dir="ltr"
        >
          {timeString}
        </span>
        <span className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)] md:group-hover:text-[var(--text-primary)] transition-colors">
          {dateString}
        </span>
      </div>
    </div>
  );
}
