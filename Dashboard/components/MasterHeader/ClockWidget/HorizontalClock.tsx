import type React from "react";
import RealTimeClock, { type RealTimeClockHandle } from "./RealTimeClock";

interface HorizontalClockProps {
  initialTime: Date;
  initialTimeString: string;
  dateString: string;
  timeTextRef: React.RefObject<HTMLSpanElement | null>;
  clockRef: React.RefObject<RealTimeClockHandle | null>;
}

export default function HorizontalClock({
  initialTime,
  initialTimeString,
  dateString,
  timeTextRef,
  clockRef,
}: HorizontalClockProps) {
  return (
    <div
      style={{ contain: "layout style" }}
      className="flex items-center gap-3 px-4 py-2 bg-card-bg-solid md:hover:bg-card-hover-bg border border-border-color rounded-xl transition-[background-color,border-color] duration-150 group cursor-default"
    >
      <RealTimeClock
        initialTime={initialTime}
        clockRef={clockRef}
        className="size-4 text-text-tertiary md:group-hover:text-accent3 transition-colors duration-150 shrink-0"
      />
      <div className="flex flex-col items-start justify-center">
        <span
          ref={timeTextRef}
          className="font-mono font-bold text-sm tabular-nums text-text-primary md:group-hover:text-accent3 transition-colors"
          dir="ltr"
        >
          {initialTimeString}
        </span>
        <span className="text-[11px] font-medium tabular-nums text-text-secondary md:group-hover:text-text-primary transition-colors">
          {dateString}
        </span>
      </div>
    </div>
  );
}
