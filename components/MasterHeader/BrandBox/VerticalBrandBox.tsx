"use client";

import { useEffect, useRef, useState } from "react";
import { HousePlug } from "@/components/ui/hugeicons-groups/shell";
import type { BrandBoxProps } from "./types";

const MARQUEE_PIXELS_PER_SECOND = 34;
const MARQUEE_MIN_DURATION_SECONDS = 6;
const OVERFLOW_TOLERANCE_PX = 2;

export default function VerticalBrandBox({ headerTitle }: Omit<BrandBoxProps, "variant">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const [marqueeState, setMarqueeState] = useState<{
    isOverflowing: boolean;
    durationSeconds: number;
  }>({
    isOverflowing: false,
    durationSeconds: MARQUEE_MIN_DURATION_SECONDS,
  });

  useEffect(() => {
    const headerTitleLength = headerTitle.length;

    if (headerTitleLength < 0) return;

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

    if (globalThis.document?.fonts?.ready) {
      void globalThis.document.fonts.ready.then(() => {
        if (!cancelled) updateMetrics();
      });
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [headerTitle]);

  return (
    <div data-animate-icon-parent className="flex min-w-0 flex-1 items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-accent4/40 bg-accent4-transparent text-accent4">
        <HousePlug aria-label="Home Control" className="size-4" strokeWidth={1.5} />
      </div>
      <div
        ref={containerRef}
        title={headerTitle}
        className={`relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-start text-sm font-medium text-sidebar-text ${
          marqueeState.isOverflowing
            ? "header-title-marquee [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
            : ""
        }`}
      >
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 right-0 whitespace-nowrap md:!inline-block"
        >
          {headerTitle}
        </span>

        <div
          className={
            marqueeState.isOverflowing
              ? "header-title-marquee-track items-center"
              : "flex items-center"
          }
          style={
            marqueeState.isOverflowing
              ? { animationDuration: `${marqueeState.durationSeconds}s` }
              : undefined
          }
        >
          <span
            className={`shrink-0 whitespace-nowrap md:!inline-block ${
              marqueeState.isOverflowing ? "pl-10" : ""
            }`}
          >
            {headerTitle}
          </span>
          {marqueeState.isOverflowing && (
            <span aria-hidden="true" className="shrink-0 whitespace-nowrap pl-10 md:!inline-block">
              {headerTitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
