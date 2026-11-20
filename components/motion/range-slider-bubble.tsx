"use client";
// beui.dev/components/motion/range-slider

import {
  AnimatePresence,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { SPRING_GLIDE, SPRING_PANEL, SPRING_PRESS } from "@/lib/ease";
import { type SliderOptions, useSlider } from "@/lib/hooks/use-slider";
import { TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

// Loose enough that the bubble keeps leaning a beat after the pointer stops.
const SPRING_TILT = { stiffness: 260, damping: 22, mass: 0.4 } as const;

/** Drag speed (px/s of track percent) that maxes out lean and squash. */
const FULL_TILT = 320;

export interface BubbleSliderProps extends SliderOptions {
  /** Formats the value shown in the bubble. */
  format?: (value: number) => string;
  className?: string;
}

/**
 * Slider with a value bubble that pops out of the thumb on grab and reacts to
 * how fast you drag: it leans into the direction of travel and squashes along
 * the way, then settles upright when you let go — composited exclusively via GPU transforms.
 */
export function BubbleSlider({ format, className, ...options }: BubbleSliderProps) {
  const reduce = useReducedMotion();
  // A bare number needs no valueText — it would only repeat aria-valuenow.
  const { percent, current, dragging, trackProps, sliderProps } = useSlider({
    ...options,
    formatValueText: options.formatValueText ?? format,
  });

  const [trackWidth, setTrackWidth] = useState(252);

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

  // The value is already snapped to the step — rounding here would only make
  // the bubble disagree with aria-valuenow on a fractional scale.
  const readout = format ? format(current) : current;
  const target = useMotionValue(percent);

  useEffect(() => {
    target.set(percent);
  }, [percent, target]);

  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;
  const fillScaleX = useTransform(pos, (v) => v / 100);
  const thumbX = useTransform(pos, (v) => (v / 100) * trackWidth);

  // One spring drives the whole reaction: lean is signed, squash reads its
  // magnitude. Two springs off the same velocity would just run twice.
  const velocity = useVelocity(pos);
  const lean = useSpring(
    useTransform(velocity, [-FULL_TILT, 0, FULL_TILT], [1, 0, -1], { clamp: true }),
    SPRING_TILT,
  );
  const tilt = useTransform(lean, (v) => v * 16);
  const squash = useTransform(lean, (v) => 1 + Math.abs(v) * 0.18);
  const stretch = useTransform(lean, (v) => 1 - Math.abs(v) * 0.12);

  return (
    <div
      dir="ltr"
      className={cn(
        // px/pb leave room for the thumb, the bubble and the 48px hit area to
        // overhang the 8px track without escaping the component's own box
        "relative flex h-20 w-full items-end px-5 pb-5",
        options.disabled ? "pointer-events-none opacity-50" : undefined,
        className,
      )}
    >
      <div
        {...trackProps}
        className={cn(
          "relative h-2 w-full touch-none rounded-full bg-secondary",
          TOUCH_GESTURE_CLASS,
          options.disabled ? undefined : "cursor-grab active:cursor-grabbing",
        )}
      >
        <m.div
          className="pointer-events-none absolute inset-0 origin-left rounded-full bg-accent3"
          style={{ scaleX: fillScaleX, willChange: "transform" }}
        />

        {/* thumb — translates horizontally via GPU x without CSS left/width reflow */}
        <m.div
          className="pointer-events-none absolute left-0 top-1/2"
          style={{ x: thumbX, willChange: "transform" }}
        >
          <m.div
            className="size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent3 bg-card-bg-solid shadow-sm"
            animate={reduce ? undefined : { scale: dragging ? 1.25 : 1 }}
            transition={SPRING_PRESS}
          />
        </m.div>

        {/* bubble — anchored to the thumb via GPU x, leaning with drag velocity */}
        <m.div
          className="pointer-events-none absolute bottom-6 left-0 z-20"
          style={{ x: thumbX, willChange: "transform" }}
        >
          <div className="-translate-x-1/2">
            <AnimatePresence>
              {dragging ? (
                <m.div
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 10 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={
                    reduce
                      ? { opacity: 0, transition: { duration: 0.12 } }
                      : { opacity: 0, scale: 0.5, y: 8, transition: { duration: 0.12 } }
                  }
                  transition={reduce ? { duration: 0.12 } : SPRING_PANEL}
                  style={
                    reduce
                      ? undefined
                      : {
                          rotate: tilt,
                          scaleX: squash,
                          scaleY: stretch,
                          originY: 1,
                          willChange: "transform, opacity",
                        }
                  }
                  className="relative whitespace-nowrap rounded-xl bg-accent3 px-2.5 py-1 text-sm font-medium tabular-nums text-accent3-foreground shadow-md"
                >
                  {readout}
                  <span className="absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[3px] bg-accent3" />
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        </m.div>

        {/* 8px of track is not a touch target — pad the hit area out to 48px */}
        <button
          type="button"
          {...sliderProps}
          className="absolute -inset-y-5 inset-x-0 touch-none rounded-full outline-none ring-accent3/30 focus-visible:ring-4"
        />
      </div>
    </div>
  );
}
