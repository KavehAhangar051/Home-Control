"use client";
// beui.dev/components/motion/range-slider

import { useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { type SliderOptions, useSlider } from "@/lib/hooks/use-slider";
import { TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

/** Bar count that reads as a wave without turning into a stripe pattern. */
const BARS = 32;

/** Width of the crest in bars — bigger spreads the bell wider. */
const SPREAD = 2.6;

export interface WaveSliderProps extends SliderOptions {
  /** Number of bars drawn across the track. */
  bars?: number;
  /** Bar height class override for compact surfaces (defaults to beUI's `h-14`). */
  barClassName?: string;
  className?: string;
}

/**
 * Equalizer slider: bars rise into a crest around the handle position and fall
 * back as it passes, so the value reads as a travelling wave. Runs purely via GPU
 * compositor `transform: scaleY(...) translateZ(0)` transitions without 32 JS spring instances.
 */
export function WaveSlider({ bars = BARS, barClassName, className, ...options }: WaveSliderProps) {
  const reduce = useReducedMotion();
  const { percent, dragging, trackProps, sliderProps } = useSlider(options);

  // Keys only change when the bar count does — the list never reorders.
  const keys = useMemo(() => Array.from({ length: bars }, (_, i) => `bar-${i}`), [bars]);
  const head = (percent / 100) * (bars - 1);

  return (
    <div
      {...trackProps}
      dir="ltr"
      className={cn(
        "relative flex h-20 w-full touch-none items-center justify-between gap-1",
        TOUCH_GESTURE_CLASS,
        options.disabled ? "pointer-events-none opacity-50" : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      {keys.map((key, i) => {
        const distance = Math.abs(i - head);
        const crest = Math.exp(-(distance ** 2) / (2 * SPREAD ** 2));
        const filled = i <= Math.round(head);
        const scaleY = reduce ? 0.4 : 0.22 + crest * (dragging ? 0.78 : 0.6);
        const delayMs = reduce ? 0 : Math.min(Math.round(distance * 12), 120);

        return (
          <span key={key} className="flex h-full flex-1 items-center justify-center">
            <span
              className={cn(
                "h-14 w-full max-w-[5px] origin-center rounded-full will-change-transform [backface-visibility:hidden]",
                !reduce &&
                  "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                // /45 keeps the unfilled track above the 3:1 non-text contrast
                // floor in both themes (measured 4.16 dark / 3.13 light)
                filled ? "bg-accent3" : "bg-text-muted/45",
                barClassName,
              )}
              style={{
                transform: `scaleY(${scaleY.toFixed(4)}) translateZ(0)`,
                transitionDelay: `${delayMs}ms`,
              }}
            />
          </span>
        );
      })}
      <button
        type="button"
        {...sliderProps}
        className="absolute inset-0 touch-none rounded-xl outline-none ring-accent3/30 focus-visible:ring-4"
      />
    </div>
  );
}
