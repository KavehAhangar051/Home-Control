"use client";
// beui.dev/components/motion/range-slider

import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { SPRING_GLIDE, SPRING_PRESS } from "@/lib/ease";
import { type SliderOptions, useSlider } from "@/lib/hooks/use-slider";
import { TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

export interface FluidSliderProps extends SliderOptions {
  /** Text shown on the left of the track. */
  label?: string;
  /** Formats the value shown on the right. */
  format?: (value: number) => string;
  className?: string;
}

/**
 * Thumbless slider: the whole pill is the control. The fill glides to the new
 * value behind a rounded liquid cap, and the label reads inverted wherever the
 * fill has covered it — composited purely via GPU transforms with zero `clip-path` repaints.
 */
export function FluidSlider({
  label,
  // The value arrives already snapped to the step. Rounding it again would
  // only make the label and the announcement disagree with aria-valuenow.
  format = (v) => `${v}%`,
  className,
  ...options
}: FluidSliderProps) {
  const reduce = useReducedMotion();
  const { percent, current, dragging, trackProps, sliderProps } = useSlider({
    ...options,
    formatValueText: options.formatValueText ?? format,
  });

  const [trackWidth, setTrackWidth] = useState(292);

  useLayoutEffect(() => {
    const track = trackProps.ref.current;

    if (!track) return;

    const measure = () => {
      const width = track.getBoundingClientRect().width;

      if (width > 0) setTrackWidth(width);
    };

    measure();
    const observer = new ResizeObserver(measure);

    observer.observe(track);

    return () => observer.disconnect();
  }, [trackProps.ref]);

  const target = useMotionValue(percent);

  useEffect(() => {
    target.set(percent);
  }, [percent, target]);

  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;

  // Slide a full-width rounded fill layer and counter-slide the inverted label inside it
  // by exact negated pixel offset: preserves the rounded liquid right cap and exact
  // glyph-for-glyph alignment strictly on the GPU compositor without `clip-path`.
  const fillX = useTransform(pos, (v) => ((v - 100) / 100) * trackWidth);
  const labelCounterX = useTransform(fillX, (x) => -x);

  const row = (
    <>
      {label ? (
        <span dir="auto" className="truncate">
          {label}
        </span>
      ) : (
        <span />
      )}
      <span className="shrink-0 tabular-nums">{format(current)}</span>
    </>
  );

  return (
    <m.div
      {...trackProps}
      dir="ltr"
      animate={reduce ? undefined : { scale: dragging ? 1.03 : 1 }}
      transition={SPRING_PRESS}
      style={{ willChange: dragging ? "transform" : undefined }}
      className={cn(
        "relative flex h-12 w-full touch-none overflow-hidden rounded-full bg-secondary border border-border-color/60",
        TOUCH_GESTURE_CLASS,
        options.disabled ? "pointer-events-none opacity-50" : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      {/* uncovered label — sits on the muted track */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-4 sm:px-5 text-xs sm:text-sm font-medium text-text-primary">
        {row}
      </div>

      {/* Sliding rounded pill fill + counter-translated inverted label */}
      <m.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-accent3"
        style={{ x: fillX, willChange: "transform" }}
      >
        <m.div
          className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-4 sm:px-5 text-xs sm:text-sm font-medium text-accent3-foreground"
          style={{ x: labelCounterX, willChange: "transform" }}
        >
          {row}
        </m.div>
      </m.div>

      {/* focusable, keyboard-controlled handle surface. The ring is inset — an
          outset one is clipped away by the track's overflow-hidden. */}
      <button
        type="button"
        {...sliderProps}
        className="absolute inset-0 touch-none rounded-full outline-none ring-inset ring-accent3/40 focus-visible:ring-4"
      />
    </m.div>
  );
}
