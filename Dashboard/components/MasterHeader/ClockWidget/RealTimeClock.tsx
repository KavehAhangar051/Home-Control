"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { Clock } from "@/components/ui/hugeicons-groups/shell";

export interface RealTimeClockHandle {
  setTime: (time: Date) => void;
}

interface RealTimeClockProps {
  initialTime: Date | null;
  className?: string;
  clockRef?: React.Ref<RealTimeClockHandle>;
}

function applyClockHands(
  hourLine: SVGLineElement | null,
  minuteLine: SVGLineElement | null,
  time: Date | null,
  hovered: boolean,
  animateTransition: boolean,
) {
  if (!time || !hourLine || !minuteLine) return;

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourRotation = (hours % 12) * 30 + minutes * 0.5 + (hovered ? 30 : 0);
  const minuteRotation = minutes * 6 + seconds * 0.1 + (hovered ? 360 : 0);

  const transitionValue = animateTransition ? "transform 0.55s cubic-bezier(0.2, 0, 0, 1)" : "";

  if (hourLine.style.transition !== transitionValue) {
    hourLine.style.transition = transitionValue;
  }

  if (minuteLine.style.transition !== transitionValue) {
    minuteLine.style.transition = transitionValue;
  }

  const nextHourTransform = `rotate3d(0, 0, 1, ${hourRotation}deg)`;
  const nextMinuteTransform = `rotate3d(0, 0, 1, ${minuteRotation}deg)`;

  if (hourLine.style.transform !== nextHourTransform) {
    hourLine.style.transform = nextHourTransform;
  }

  if (minuteLine.style.transform !== nextMinuteTransform) {
    minuteLine.style.transform = nextMinuteTransform;
  }
}

/**
 * Imperative GPU-composited analog clock icon.
 * Updates hour/minute hand transforms directly via 3D `rotate3d()` without React re-renders
 * on every second tick or parent hover, keeping the exact visual spin animation intact.
 */
export default function RealTimeClock({ initialTime, className, clockRef }: RealTimeClockProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hourLineRef = useRef<SVGLineElement | null>(null);
  const minuteLineRef = useRef<SVGLineElement | null>(null);
  const lastTimeRef = useRef<Date | null>(initialTime);
  const hoveredRef = useRef(false);
  const hasTime = initialTime !== null;

  if (initialTime && !lastTimeRef.current) {
    lastTimeRef.current = initialTime;
  }

  useImperativeHandle(
    clockRef,
    () => ({
      setTime: (nextTime: Date) => {
        lastTimeRef.current = nextTime;
        applyClockHands(
          hourLineRef.current,
          minuteLineRef.current,
          nextTime,
          hoveredRef.current,
          false,
        );
      },
    }),
    [],
  );

  useEffect(() => {
    if (!hasTime) return;
    const svgEl = svgRef.current;

    if (!svgEl) return;

    const hoverTarget =
      svgEl.closest<HTMLElement>("[data-animate-icon-parent]") ?? svgEl.parentElement;

    if (!hoverTarget) return;

    const handlePointerEnter = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && !hoveredRef.current) {
        hoveredRef.current = true;
        applyClockHands(
          hourLineRef.current,
          minuteLineRef.current,
          lastTimeRef.current,
          true,
          true,
        );
      }
    };

    const handlePointerLeave = () => {
      if (hoveredRef.current) {
        hoveredRef.current = false;
        applyClockHands(
          hourLineRef.current,
          minuteLineRef.current,
          lastTimeRef.current,
          false,
          true,
        );
      }
    };

    hoverTarget.addEventListener("pointerenter", handlePointerEnter, { passive: true });
    hoverTarget.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      hoverTarget.removeEventListener("pointerenter", handlePointerEnter);
      hoverTarget.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [hasTime]);

  if (!initialTime) {
    return <Clock className={className} />;
  }

  const hours = initialTime.getHours();
  const minutes = initialTime.getMinutes();
  const seconds = initialTime.getSeconds();
  const initialHourRotation = (hours % 12) * 30 + minutes * 0.5;
  const initialMinuteRotation = minutes * 6 + seconds * 0.1;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line
        ref={hourLineRef}
        x1="12"
        y1="12"
        x2="12"
        y2="7"
        style={{
          transform: `rotate3d(0, 0, 1, ${initialHourRotation}deg)`,
          transformOrigin: "12px 12px",
          backfaceVisibility: "hidden",
        }}
      />
      <line
        ref={minuteLineRef}
        x1="12"
        y1="12"
        x2="12"
        y2="4"
        style={{
          transform: `rotate3d(0, 0, 1, ${initialMinuteRotation}deg)`,
          transformOrigin: "12px 12px",
          backfaceVisibility: "hidden",
        }}
      />
    </svg>
  );
}
