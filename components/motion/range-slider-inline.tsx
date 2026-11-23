"use client";
// beui.dev/components/motion/range-slider

import { animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SPRING_GLIDE } from "@/lib/ease";
import { type SliderOptions, snapSliderValue, useSlider } from "@/lib/hooks/use-slider";
import { capturePointer, releasePointer, TOUCH_GESTURE_CLASS } from "@/lib/touch";
import { cn } from "@/lib/utils";

const STOP_COUNT = 10;
const HANDLE_START = 8;
const HANDLE_END_INSET = 12;
const TEXT_INSET = 20;

// Matches RangeSlider's bouncy grab and release feedback.
const SPRING_BOUNCY = { type: "spring", stiffness: 500, damping: 14, mass: 0.7 } as const;

type Stop = { value: number; x: number };

function mapBetweenStops(stops: Stop[], point: number, from: keyof Stop, to: keyof Stop) {
  const upperIndex = stops.findIndex((stop) => stop[from] >= point);
  const upper = stops[upperIndex < 0 ? stops.length - 1 : upperIndex];
  const lower = stops[Math.max(0, upperIndex - 1)];

  if (lower[from] === upper[from]) return upper[to];

  return (
    lower[to] + ((point - lower[from]) / (upper[from] - lower[from])) * (upper[to] - lower[to])
  );
}

function nearestStop(stops: Stop[], x: number) {
  return stops.reduce((nearest, stop) =>
    Math.abs(stop.x - x) < Math.abs(nearest.x - x) ? stop : nearest,
  );
}

export interface InlineSliderProps extends SliderOptions {
  /** Rounds snap-stop values. While dragging, the readout keeps this step's decimal precision. */
  step?: number;
  /** Compact label inside the left edge of the track. */
  label: string;
  /** Formats the inline value without changing its precision. */
  format?: (value: number) => string;
  /** Show markers for the evenly spaced snap stops, except where they overlap inline text. */
  showTicks?: boolean;
  /** Number of evenly spaced stops across the track (defaults to beUI's 10). */
  stopCount?: number;
  /** When false, release commits the exact stepped value instead of snapping only to stops. */
  snapToStops?: boolean;
  className?: string;
}

/**
 * An always-visible inline slider with an inset fill and a thumb that parts
 * around its labels, keeping their text readable as the handle passes them.
 */
export function InlineSlider({
  label,
  format = String,
  showTicks = true,
  stopCount = STOP_COUNT,
  snapToStops = true,
  className,
  ...options
}: InlineSliderProps) {
  const reduce = useReducedMotion();
  const step = options.step && options.step > 0 ? options.step : 1;
  const precision = step.toFixed(6).replace(/0+$/, "").split(".")[1]?.length ?? 0;

  const { current, min, max, commit, trackProps, sliderProps } = useSlider({
    ...options,
    step: snapToStops ? 10 ** -precision : step,
    "aria-label": options["aria-label"] ?? label,
    formatValueText: options.formatValueText ?? format,
  });

  const labelRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  const [geometry, setGeometry] = useState({
    width: 292,
    labelWidth: 22,
    readoutWidth: 24,
  });

  const [dragging, setDragging] = useState(false);
  const dragFrame = useRef<number | null>(null);
  const pendingDragValue = useRef<number | null>(null);
  const trackWidthMv = useMotionValue(292);
  const gesture = useRef<{
    id: number;
    left: number;
    scale: number;
    offset: number;
    x: number;
  } | null>(null);

  useLayoutEffect(() => {
    const track = trackProps.ref.current;
    const labelElement = labelRef.current;
    const readout = readoutRef.current;

    if (!track || !labelElement || !readout) return;

    const measure = () => {
      // clientWidth/offsetWidth remain in local CSS pixels even inside a CSS-scaled Canvas sheet
      const width = track.clientWidth;

      if (!width) return;

      if (trackWidthMv.get() !== width) trackWidthMv.set(width);

      const next = {
        width,
        labelWidth: labelElement.offsetWidth,
        readoutWidth: readout.offsetWidth,
      };

      setGeometry((previous) =>
        previous.width === next.width &&
        previous.labelWidth === next.labelWidth &&
        previous.readoutWidth === next.readoutWidth
          ? previous
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);

    observer.observe(track);
    observer.observe(labelElement);
    observer.observe(readout);

    return () => observer.disconnect();
  }, [trackProps.ref, trackWidthMv]);

  // Each stop owns both a value and a physical position. As in RangeSlider,
  // the stops span the entire track at even intervals; text only affects
  // whether a marker is painted, never whether its stop remains interactive.
  const endX = Math.max(HANDLE_START, geometry.width - HANDLE_END_INSET);
  const safeStopCount = Math.max(2, Math.floor(stopCount));

  const stops = useMemo(() => {
    const values = [
      ...new Set(
        Array.from({ length: safeStopCount }, (_, index) =>
          snapSliderValue(min + (index / (safeStopCount - 1)) * (max - min), min, max, step),
        ),
      ),
    ];

    return values.map((value, index) => ({
      value,
      x:
        values.length === 1
          ? HANDLE_START
          : HANDLE_START + (index / (values.length - 1)) * (endX - HANDLE_START),
    }));
  }, [min, max, step, endX, safeStopCount]);

  const restingX = mapBetweenStops(stops, current, "value", "x");

  // One motion value owns the thumb for the entire gesture. Pointer movement
  // writes pixels directly; only release/click/keyboard changes use a spring.
  const handleX = useMotionValue(restingX);
  const restingTarget = useRef(restingX);

  const settleTo = useCallback(
    (x: number) => {
      restingTarget.current = x;
      handleX.jump(handleX.get());

      if (reduce) handleX.jump(x);
      else animate(handleX, x, { type: "spring", ...SPRING_GLIDE });
    },
    [handleX, reduce],
  );

  useLayoutEffect(() => {
    if (gesture.current || restingTarget.current === restingX) return;

    settleTo(restingX);
  }, [restingX, settleTo]);

  useEffect(
    () => () => {
      handleX.stop();

      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    },
    [handleX],
  );

  const fillRight = useTransform([handleX, trackWidthMv], ([x, width]: number[]) => {
    const localEndX = Math.max(HANDLE_START, width - HANDLE_END_INSET);
    return x >= localEndX ? width - 2 : x + 8;
  });

  // Slide a fixed-size fill inside the inset clipping window. The labels and
  // dots stay above it, and only transforms animate.
  const fillX = useTransform([fillRight, trackWidthMv], ([right, width]: number[]) => {
    return right - width + 2;
  });

  // Part progressively over six pixels at each text edge instead of
  // toggling the stem on/off in a single pointer frame. The thumb uses the
  // same two-dot treatment across both the label and numeric readout.
  const split = useTransform(handleX, (x) => {
    const overlap = (start: number, end: number) =>
      Math.max(0, Math.min(1, (x + 4 - start) / 6, (end - x) / 6));

    return Math.max(
      overlap(TEXT_INSET, TEXT_INSET + geometry.labelWidth),
      overlap(geometry.width - TEXT_INSET - geometry.readoutWidth, geometry.width - TEXT_INSET),
    );
  });

  const stemOpacity = useTransform(split, (amount) => 1 - amount);
  const capTop = useTransform(split, (amount) => -amount);
  const capBottom = useTransform(split, (amount) => amount);

  const ticks = useMemo(() => {
    if (!showTicks) return [];

    const overlapsText = (x: number, bounds: { start: number; end: number }) =>
      x + 2 >= bounds.start && x - 2 <= bounds.end;

    const labelBounds = { start: TEXT_INSET, end: TEXT_INSET + geometry.labelWidth };
    const readoutBounds = {
      start: geometry.width - TEXT_INSET - geometry.readoutWidth,
      end: geometry.width - TEXT_INSET,
    };

    return stops
      .map((stop) => stop.x)
      .filter((x) => !overlapsText(x, labelBounds) && !overlapsText(x, readoutBounds));
  }, [showTicks, stops, geometry.width, geometry.labelWidth, geometry.readoutWidth]);

  const queueDragCommit = (value: number) => {
    pendingDragValue.current = value;

    if (dragFrame.current !== null) return;

    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;

      if (pendingDragValue.current !== null) commit(pendingDragValue.current);

      pendingDragValue.current = null;
    });
  };

  const cancelDragCommit = () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);

    dragFrame.current = null;
    pendingDragValue.current = null;
  };

  const endGesture = (event: PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;

    if (!active || active.id !== event.pointerId) return;

    // Clear before releasing capture: its lost-capture event must not commit twice.
    gesture.current = null;
    cancelDragCommit();
    setDragging(false);

    if (!options.disabled && geometry.width > 0) {
      const x =
        event.type === "pointerup"
          ? Math.min(
              endX,
              Math.max(HANDLE_START, (event.clientX - active.left) / active.scale - active.offset),
            )
          : active.x;

      if (snapToStops) {
        const stop = nearestStop(stops, x);
        const committed = commit(stop.value);
        options.onValueCommit?.(committed);
        settleTo(options.value === undefined ? stop.x : restingX);
      } else {
        const rawVal = mapBetweenStops(stops, x, "x", "value");
        const committed = commit(rawVal);
        options.onValueCommit?.(committed);
        settleTo(mapBetweenStops(stops, committed, "value", "x"));
      }
    } else {
      settleTo(restingX);
    }

    releasePointer(event.currentTarget, event.pointerId);
  };

  const blurCleanupRef = useRef<() => void>(() => {});
  blurCleanupRef.current = () => {
    if (!gesture.current) return;
    gesture.current = null;
    cancelDragCommit();
    setDragging(false);
    settleTo(restingX);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleWindowBlur = () => blurCleanupRef.current();

    window.addEventListener("blur", handleWindowBlur);

    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [dragging]);

  return (
    <div
      {...trackProps}
      dir="ltr"
      onPointerDown={(event) => {
        if (options.disabled || event.button !== 0 || gesture.current) return;

        const rect = event.currentTarget.getBoundingClientRect();

        if (!rect.width) return;

        event.preventDefault();
        const localWidth = event.currentTarget.clientWidth || geometry.width;
        const scale = localWidth > 0 ? rect.width / localWidth : 1;
        const pointerX = (event.clientX - rect.left) / scale;
        const thumbX = handleX.get();
        // Grabbing the thumb preserves the exact grab point. A track click
        // waits for release, so it glides to a dot without an intermediate jump.
        const offset = Math.abs(pointerX - thumbX - 2) <= 12 ? pointerX - thumbX : 2;
        gesture.current = { id: event.pointerId, left: rect.left, scale, offset, x: thumbX };
        setDragging(true);
        handleX.stop();
        cancelDragCommit();
        capturePointer(event.currentTarget, event.pointerId);
        event.currentTarget
          .querySelector<HTMLButtonElement>("[role=slider]")
          ?.focus({ preventScroll: true });
      }}
      onPointerMove={(event) => {
        const active = gesture.current;

        if (!active || active.id !== event.pointerId || options.disabled) return;

        const x = Math.min(
          endX,
          Math.max(HANDLE_START, (event.clientX - active.left) / active.scale - active.offset),
        );
        active.x = x;
        handleX.set(x);
        // Use the same piecewise map as the resting stops, so value and
        // position agree throughout the drag.
        queueDragCommit(mapBetweenStops(stops, x, "x", "value"));
      }}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onLostPointerCapture={endGesture}
      className={cn(
        "relative h-10 w-full touch-none select-none overflow-hidden rounded-lg bg-secondary border border-border-color/60",
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
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-text-primary">
        <span
          ref={labelRef}
          dir="auto"
          className="absolute left-5 top-1/2 max-w-[44%] -translate-y-1/2 truncate text-xs sm:text-sm font-medium leading-5"
        >
          {label}
        </span>
        <span
          ref={readoutRef}
          className="absolute right-5 top-1/2 max-w-[40%] -translate-y-1/2 truncate text-[13px] font-semibold leading-[18px] tracking-tight tabular-nums"
        >
          {format(current)}
        </span>
        {ticks.map((left) => (
          <span
            key={left}
            className="absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-text-muted/40"
            style={{ left }}
          />
        ))}
      </div>
      <m.div
        aria-hidden="true"
        animate={reduce ? undefined : { scaleY: dragging ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className="pointer-events-none absolute left-0 top-1/2 h-6 w-1 text-accent3"
        style={{ x: handleX, y: "-50%", willChange: "transform", backfaceVisibility: "hidden" }}
      >
        <m.span
          className="absolute top-0 size-1 rounded-full bg-current"
          style={{ y: reduce ? 0 : capTop }}
        />
        <m.span
          className="absolute inset-y-0 w-1 rounded-full bg-current"
          style={{ opacity: stemOpacity }}
        />
        <m.span
          className="absolute bottom-0 size-1 rounded-full bg-current"
          style={{ y: reduce ? 0 : capBottom }}
        />
      </m.div>
      <button
        type="button"
        {...sliderProps}
        onKeyDown={(event) => {
          if (options.disabled) return;

          const nextValue = snapToStops
            ? {
                ArrowRight: stops.find((stop) => stop.value > current)?.value ?? max,
                ArrowUp: stops.find((stop) => stop.value > current)?.value ?? max,
                ArrowLeft: stops.findLast((stop) => stop.value < current)?.value ?? min,
                ArrowDown: stops.findLast((stop) => stop.value < current)?.value ?? min,
                Home: min,
                End: max,
                PageUp: max,
                PageDown: min,
              }[event.key]
            : {
                ArrowRight: current + step,
                ArrowUp: current + step,
                ArrowLeft: current - step,
                ArrowDown: current - step,
                Home: min,
                End: max,
                PageUp: current + step * 10,
                PageDown: current - step * 10,
              }[event.key];

          if (nextValue !== undefined) {
            event.preventDefault();
            const committed = commit(nextValue);
            options.onValueCommit?.(committed);
          }
        }}
        className="absolute inset-0 cursor-inherit touch-none rounded-lg border-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent3"
      />
    </div>
  );
}
