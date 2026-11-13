"use client";

import { useEffect, useRef, useState } from "react";
import { HousePlug } from "@/components/ui/hugeicons";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import type { BrandBoxProps } from "./types";

const MARQUEE_PIXELS_PER_SECOND = 34;
const MARQUEE_MIN_DURATION_SECONDS = 6;
const OVERFLOW_TOLERANCE_PX = 2;

export default function VerticalBrandBox({ headerTitle }: Omit<BrandBoxProps, "variant">) {
  const { isFullyReady } = useDashboard();

  const containerRef = useRef<HTMLHeadingElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const [marqueeState, setMarqueeState] = useState<{
    isOverflowing: boolean;
    durationSeconds: number;
  }>({
    isOverflowing: false,
    durationSeconds: MARQUEE_MIN_DURATION_SECONDS,
  });

  useEffect(() => {
    if (!isFullyReady) return;

    const container = containerRef.current;
    const measureEl = measureRef.current;

    if (!container || !measureEl) return;

    const updateMetrics = () => {
      const containerWidth = container.clientWidth;
      const textWidth = measureEl.getBoundingClientRect().width;

      if (containerWidth <= 0) return;

      const isOverflowing = textWidth > containerWidth + OVERFLOW_TOLERANCE_PX;
      const cycleDistance = textWidth + 40;

      const durationSeconds = Math.max(
        MARQUEE_MIN_DURATION_SECONDS,
        Math.round((cycleDistance / MARQUEE_PIXELS_PER_SECOND) * 10) / 10,
      );

      setMarqueeState((prev) =>
        prev.isOverflowing === isOverflowing && prev.durationSeconds === durationSeconds
          ? prev
          : { isOverflowing, durationSeconds },
      );
    };

    updateMetrics();

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(container);
    resizeObserver.observe(measureEl);

    let cancelled = false;

    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) updateMetrics();
      });
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [isFullyReady]);

  return (
    <div data-animate-icon-parent className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--sidebar-hover)] text-[var(--sidebar-text)]">
        <HousePlug aria-label="Home Control" className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h1
        ref={containerRef}
        title={headerTitle}
        className={`relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-right text-sm font-semibold tracking-tight text-[var(--sidebar-text)] ${
          marqueeState.isOverflowing
            ? "header-title-marquee [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
            : ""
        }`}
      >
        {isFullyReady ? (
          <>
            <span
              ref={measureRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute top-0 right-0 whitespace-nowrap md:!inline-block"
            >
              {headerTitle}
            </span>

            {marqueeState.isOverflowing ? (
              <div
                className="header-title-marquee-track items-center"
                style={{ animationDuration: `${marqueeState.durationSeconds}s` }}
              >
                <span className="shrink-0 whitespace-nowrap pl-10 md:!inline-block">
                  {headerTitle}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 whitespace-nowrap pl-10 md:!inline-block"
                >
                  {headerTitle}
                </span>
              </div>
            ) : (
              <span className="whitespace-nowrap md:!inline">{headerTitle}</span>
            )}
          </>
        ) : (
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--text-muted)] opacity-20" />
        )}
      </h1>
    </div>
  );
}
