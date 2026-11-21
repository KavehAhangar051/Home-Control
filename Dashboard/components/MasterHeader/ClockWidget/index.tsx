"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Clock } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import HorizontalClock from "./HorizontalClock";
import { getPersianDateString, getTimeString } from "./persianDateUtils";
import type { RealTimeClockHandle } from "./RealTimeClock";
import type { ClockWidgetProps } from "./types";
import VerticalClock from "./VerticalClock";

const emptySubscribe = () => () => {};
const getHydratedClientSnapshot = () => true;
const getHydratedServerSnapshot = () => false;

/**
 * Always-mounted desktop header clock with zero per-second React re-renders.
 * Aligns imperatively to exact wall-clock seconds via refs and GPU-composited hand rotations,
 * pausing cleanly while the tab is hidden and re-rendering React only on calendar day rollover.
 */
export default function ClockWidget({ variant, isSidebarCollapsed }: ClockWidgetProps) {
  const isPageVisible = useIoTStore((state) => state.isPageVisible);
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    getHydratedClientSnapshot,
    getHydratedServerSnapshot,
  );

  const timeTextRef = useRef<HTMLSpanElement | null>(null);
  const clockHandsRef = useRef<RealTimeClockHandle | null>(null);
  const initialDateRef = useRef<Date | null>(null);

  if (isHydrated && initialDateRef.current === null) {
    initialDateRef.current = new Date();
  }

  const [dateString, setDateString] = useState<string>(() =>
    initialDateRef.current ? getPersianDateString(initialDateRef.current) : "",
  );

  useEffect(() => {
    if (!isHydrated || !isPageVisible) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const syncClock = () => {
      if (!active) return;

      const now = new Date();
      const nextTime = getTimeString(now);
      const nextDate = getPersianDateString(now);

      if (timeTextRef.current && timeTextRef.current.textContent !== nextTime) {
        timeTextRef.current.textContent = nextTime;
      }

      clockHandsRef.current?.setTime(now);
      setDateString((prev) => (prev === nextDate ? prev : nextDate));

      const delayMs = 1000 - (now.getTime() % 1000) + 4;
      timerId = setTimeout(syncClock, delayMs);
    };

    syncClock();

    return () => {
      active = false;

      if (timerId !== null) clearTimeout(timerId);
    };
  }, [isHydrated, isPageVisible]);

  if (!isHydrated || !initialDateRef.current) {
    return (
      <div
        className={`flex h-9 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-control-bg px-2.5 ${variant === "vertical" ? "w-full" : ""}`}
      >
        <Clock className="size-4 text-text-muted animate-pulse" />
      </div>
    );
  }

  const initialTime = initialDateRef.current;
  const initialTimeString = getTimeString(initialTime);
  const resolvedDateString = dateString || getPersianDateString(initialTime);

  if (variant === "vertical") {
    return (
      <VerticalClock
        initialTime={initialTime}
        initialTimeString={initialTimeString}
        dateString={resolvedDateString}
        isSidebarCollapsed={isSidebarCollapsed}
        timeTextRef={timeTextRef}
        clockRef={clockHandsRef}
      />
    );
  }

  return (
    <HorizontalClock
      initialTime={initialTime}
      initialTimeString={initialTimeString}
      dateString={resolvedDateString}
      timeTextRef={timeTextRef}
      clockRef={clockHandsRef}
    />
  );
}
