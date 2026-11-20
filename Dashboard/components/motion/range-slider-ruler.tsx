"use client";
// beui.dev/components/motion/range-slider

import { animate, m, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { type SliderOptions, snapSliderValue, useSlider } from "@/lib/hooks/use-slider";
import { TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

// Settle spring for the snap after a flick — quick, no overshoot past the tick.
const SPRING_SNAP = { type: "spring", stiffness: 500, damping: 40, mass: 0.6 } as const;

export interface RulerSliderProps extends SliderOptions {
  /** Pixels between two steps. */
  gap?: number;
  /** Label every Nth step; those ticks are drawn tall. */
  majorEvery?: number;
  /** Unit shown next to the value. */
  unit?: string;
  /** Hide the large top readout when embedded inside compact cards that already display telemetry. */
  compact?: boolean;
  className?: string;
}

/**
 * Ruler slider: the scale scrolls under a fixed needle instead of a handle
 * moving along a track. Flicks carry momentum and settle onto the nearest tick.
 */
export function RulerSlider({
  gap = 14,
  majorEvery = 5,
  unit,
  compact = false,
  className,
  ...options
}: RulerSliderProps) {
  const reduce = useReducedMotion();
  // Decimal places the step implies, so 0.5 reads "72.5" and 1 reads "72".
  // Fixed width keeps the readout from jittering as the value rolls; tick
  // labels stay trimmed so a whole-number scale is not littered with ".0".
  const decimals = String(options.step ?? 1).split(".")[1]?.length ?? 0;
  const readout = (value: number) => value.toFixed(decimals);

  const { current, min, max, step, commit, sliderProps } = useSlider({
    ...options,
    formatValueText: options.formatValueText ?? (unit ? (v) => `${readout(v)} ${unit}` : undefined),
  });

  // The range need not divide by the step (0–10 by 4). Full ticks stop at the
  // last whole one and max gets a tick of its own, so the scale never runs past
  // the value the slider can actually report.
  const span = Number(((max - min) / step).toFixed(6));
  const wholeSteps = Math.floor(span);
  const remainder = span - wholeSteps;
  const maxOffset = span * gap;
  const x = useMotionValue(-((current - min) / step) * gap);

  // While the pointer drives the strip (or its momentum still runs), x owns the
  // value; outside of that the value owns x.
  const interacting = useRef(false);
  // True only while the pointer is down. It keeps a cancelled momentum's
  // transition end from snapping underneath a fresh grab.
  const holding = useRef(false);
  // A new gesture or key press bumps this, so a snap that resolves late cannot
  // clear interacting underneath an active drag.
  const gesture = useRef(0);

  const ticks = Array.from({ length: wholeSteps + 1 }, (_, i) => ({
    value: Number((min + i * step).toFixed(6)),
    major: i % majorEvery === 0,
    offset: i * gap,
  }));

  if (remainder > 0) ticks.push({ value: max, major: true, offset: maxOffset });

  const snapToTick = () => {
    const target = snapSliderValue(min + (-x.get() / gap) * step, min, max, step);
    const snapped = -((target - min) / step) * gap;
    const id = ++gesture.current;
    const committed = commit(target);
    options.onValueCommit?.(committed);

    if (reduce) {
      x.set(snapped);
      interacting.current = false;

      return;
    }

    animate(x, snapped, SPRING_SNAP).then(() => {
      if (gesture.current === id) interacting.current = false;
    });
  };

  // A key press takes the scale back from momentum: without this the coasting
  // strip keeps committing its own value and swallows the keyboard input.
  const rootProps = {
    ...sliderProps,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      x.stop();
      gesture.current++;
      interacting.current = false;
      holding.current = false;
      sliderProps.onKeyDown(event);
    },
  };

  useEffect(() => {
    if (interacting.current) return;

    x.set(-((current - min) / step) * gap);
  }, [current, min, step, gap, x]);

  useMotionValueEvent(x, "change", (v) => {
    if (!interacting.current) return;

    commit(min + (-v / gap) * step);
  });

  return (
    <div
      {...rootProps}
      dir="ltr"
      className={cn(
        "relative w-full touch-none overflow-hidden",
        TOUCH_GESTURE_CLASS,
        options.disabled ? "pointer-events-none opacity-50" : "cursor-grab active:cursor-grabbing",
        "rounded-2xl outline-none ring-accent3/30 focus-visible:ring-4",
        className,
      )}
    >
      {!compact && (
        <div className="pointer-events-none flex items-baseline justify-center gap-1 pt-1 pb-3">
          <span className="text-2xl sm:text-3xl font-semibold tabular-nums text-text-primary">
            {readout(current)}
          </span>
          {unit ? <span className="text-xs sm:text-sm text-text-muted">{unit}</span> : null}
        </div>
      )}
      {/* masked, not overlaid with background-coloured gradients — the fade has
          to work on any surface the slider is dropped onto */}
      <div
        className={cn(
          "relative [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)]",
          compact ? "h-9" : "h-12",
        )}
      >
        {/* strip — dragged directly, so momentum comes from the drag gesture */}
        <m.div
          drag={options.disabled ? false : "x"}
          dragConstraints={{ left: -maxOffset, right: 0 }}
          dragElastic={0.03}
          dragMomentum={!reduce}
          dragTransition={{ power: 0.22, timeConstant: 320 }}
          onDragStart={() => {
            gesture.current++;
            interacting.current = true;
            holding.current = true;
          }}
          onDragTransitionEnd={() => {
            if (!holding.current) snapToTick();
          }}
          onDragEnd={() => {
            holding.current = false;

            if (reduce) snapToTick();
          }}
          style={{ x, marginLeft: -gap / 2, width: maxOffset + gap, willChange: "transform" }}
          className="absolute inset-y-0 left-1/2"
        >
          {ticks.map((tick) => (
            <span
              key={tick.value}
              className={cn(
                "absolute bottom-0 flex -translate-x-1/2 flex-col items-center",
                compact ? "pb-3.5" : "pb-[18px]",
              )}
              style={{ left: tick.offset + gap / 2 }}
            >
              <span
                className={cn(
                  "w-px rounded-full",
                  tick.major
                    ? compact
                      ? "h-5 bg-text-primary/70"
                      : "h-7 bg-text-primary/70"
                    : compact
                      ? "h-2.5 bg-text-muted/45"
                      : "h-3.5 bg-text-muted/45",
                )}
              />
              {tick.major ? (
                <span className="absolute bottom-0 text-[9px] sm:text-[10px] tabular-nums text-text-muted">
                  {tick.value}
                </span>
              ) : null}
            </span>
          ))}
        </m.div>
        {/* needle — the read head the scale moves under */}
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2",
            compact ? "bottom-3.5" : "bottom-5",
          )}
        >
          <span className={cn("block w-[3px] rounded-full bg-accent3", compact ? "h-6" : "h-9")} />
        </div>
      </div>
    </div>
  );
}
