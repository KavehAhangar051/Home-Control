import { useCallback, useSyncExternalStore } from "react";
import { Clock } from "@/components/ui/hugeicons";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import HorizontalClock from "./HorizontalClock";
import { getPersianDateString, getTimeString } from "./persianDateUtils";
import type { ClockWidgetProps } from "./types";
import VerticalClock from "./VerticalClock";

const getClockEpochSecond = () => Math.floor(Date.now() / 1000);
const getServerClockEpochSecond = () => null;

export default function ClockWidget({ variant, isSidebarCollapsed }: ClockWidgetProps) {
  const isPageVisible = useIoTStore((state) => state.isPageVisible);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!isPageVisible) return () => {};

      const timer = setInterval(onStoreChange, 1000);

      return () => clearInterval(timer);
    },
    [isPageVisible],
  );

  const epochSecond = useSyncExternalStore(
    subscribe,
    getClockEpochSecond,
    getServerClockEpochSecond,
  );

  if (epochSecond === null) {
    return (
      <div
        className={`flex h-9 items-center justify-center rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-control-bg)] px-2.5 ${variant === "vertical" ? "w-full" : ""}`}
      >
        <Clock className="w-4 h-4 text-[var(--text-muted)] animate-pulse" />
      </div>
    );
  }

  const time = new Date(epochSecond * 1000);
  const timeString = getTimeString(time);
  const dateString = getPersianDateString(time);

  if (variant === "vertical") {
    return (
      <VerticalClock
        time={time}
        timeString={timeString}
        dateString={dateString}
        isSidebarCollapsed={isSidebarCollapsed}
      />
    );
  }

  return <HorizontalClock time={time} timeString={timeString} dateString={dateString} />;
}
