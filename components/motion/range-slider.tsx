"use client";
// beui.dev/components/motion/range-slider

import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { SPRING_GLIDE } from "@/lib/ease";
import { type SliderOptions, useSlider } from "@/lib/hooks/use-slider";
import { TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

// Bouncy grab feedback for the thumb scale only.
const SPRING_BOUNCY = { type: "spring", stiffness: 500, damping: 14, mass: 0.7 } as const;

export interface RangeSliderProps extends SliderOptions {
  /** Render a tick dot at each step. */
  showTicks?: boolean;
  className?: string;
}

export function RangeSlider({ showTicks = true, className, ...options }: RangeSliderProps) {
  const reduce = useReducedMotion();
  const { percent, dragging, min, max, step, trackProps, sliderProps } = useSlider(options);
  const trackWidth = useMotionValue(0);

  useLayoutEffect(() => {
    const track = trackProps.ref.current;

    if (!track) return;

    const measure = () => {
      // clientWidth stays in local CSS coordinates even inside a CSS-scaled Canvas sheet
      const width = track.clientWidth;

      if (width > 0 && trackWidth.get() !== width) trackWidth.set(width);
    };

    measure();
    const observer = new ResizeObserver(measure);

    observer.observe(track);

    return () => observer.disconnect();
  }, [trackProps.ref, trackWidth]);

  // Spring-smoothed position drives both the thumb and the fill.
  const target = useMotionValue(percent);

  useEffect(() => {
    if (target.get() !== percent) target.set(percent);
  }, [percent, target]);

  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;
  const thumbX = useTransform([pos, trackWidth], ([p, w]: number[]) => {
    return 5 + (Math.max(0, w - 14) * p) / 100;
  });

  // Match InlineSlider: the 4px handle starts 8px inside the track, and
  // the rounded fill extends 8px past its left edge. Translate a full-size
  // fill inside the 2px inset clip so its corner never stretches.
  const fillX = useTransform([pos, trackWidth], ([p, w]: number[]) =>
    p >= 100 ? 0 : ((p - 100) / 100) * Math.max(0, w - 4) + 14 - 0.16 * p,
  );

  // Floor rather than round, so a range the step does not divide (0 to 10 by 4)
  // stops its dots at the last whole step instead of drawing one past max.
  // toFixed comes first because 0.3/0.1 is 2.9999999999999996, which would
  // floor to 2 and drop the last dot.
  const steps = Math.floor(Number(((max - min) / step).toFixed(6)));

  const ticks = useMemo(() => {
    if (!showTicks || !(max > min)) return [];

    return steps > 0 && steps <= 50
      ? Array.from({ length: steps + 1 }, (_, i) => Number((min + i * step).toFixed(6)))
      : Array.from({ length: 11 }, (_, i) => Number((min + (i / 10) * (max - min)).toFixed(6)));
  }, [showTicks, max, min, step, steps]);

  return (
    <div
      {...trackProps}
      dir="ltr"
      className={cn(
        "relative flex h-10 w-full touch-none items-center overflow-hidden rounded-lg bg-secondary border border-border-color/60",
        TOUCH_GESTURE_CLASS,
        options.disabled ? "pointer-events-none opacity-50" : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[2px] inset-y-0 overflow-hidden rounded-lg"
      >
        <m.div
          className="absolute inset-0 rounded-lg bg-accent3-medium"
          style={{ x: fillX, willChange: "transform", backfaceVisibility: "hidden" }}
        />
      </div>
      {/* Tick centres follow the same inset path as the handle centre. */}
      <div className="pointer-events-none absolute inset-x-[7px] inset-y-0">
        {ticks.map((t) => {
          const tp = ((t - min) / (max - min)) * 100;

          return (
            <span
              key={t}
              className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-muted/40"
              style={{ left: `${tp}%` }}
            />
          );
        })}
      </div>
      {/* Keep the handle inside the rounded progress fill at both ends. */}
      <m.div
        {...sliderProps}
        animate={reduce ? undefined : { scaleX: dragging ? 1.12 : 1, scaleY: dragging ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className="absolute left-0 top-1/2 h-6 w-1 rounded-full bg-accent3 outline-none ring-inset ring-accent3/30 focus-visible:ring-4"
        style={{ x: thumbX, y: "-50%", willChange: "transform", backfaceVisibility: "hidden" }}
      />
    </div>
  );
}
