"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { capturePointer, releasePointer } from "@/lib/touch";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Nearest legal value on [min, max] for the given step. max counts as a
 * candidate when the step does not divide the range, so a pointer near the end
 * does not snap back onto the last whole step. */
export function snapSliderValue(next: number, min: number, max: number, step: number): number {
  // Neither case has a grid to walk. An empty range has exactly one legal
  // point, and a non-positive step only needs a clamp, which also keeps the
  // division below away from zero.
  if (!(max > min)) return min;

  if (!(step > 0)) return clamp(next, min, max);

  const whole = Math.floor(Number(((max - min) / step).toFixed(6)));
  const lastWhole = Number((min + whole * step).toFixed(6));
  const toGrid = clamp(Math.round((next - min) / step) * step + min, min, lastWhole);
  const snapped = lastWhole < max && Math.abs(next - max) <= Math.abs(next - toGrid) ? max : toGrid;

  return Number(snapped.toFixed(6));
}

export interface SliderOptions {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Fired once when a drag finishes or a keyboard step commits a final value. */
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  "aria-label"?: string;
  /** Announced instead of the raw number — pass one when the value carries a
   * unit or a suffix ("72.5 kg", "35%"); a bare number needs no valueText. */
  formatValueText?: (value: number) => string;
}

/**
 * Shared value + input plumbing for slider designs: controlled/uncontrolled
 * value, step snapping, pointer-capture drag along a track and arrow-key
 * control. Visuals and motion live in the component; this only owns the number.
 */
export function useSlider({
  value,
  defaultValue = 0,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  "aria-label": ariaLabel,
  formatValueText,
}: SliderOptions) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sliderEl = useRef<HTMLElement | null>(null);
  // The state drives visuals. Move reads this ref instead, so the first
  // pointermove after pointerdown does not have to wait on a re-render.
  const draggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const [internal, setInternal] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const controlled = value !== undefined;

  // Collapse inverted or empty ranges and non-positive steps here, so that
  // percent, ticks and the keyboard maths never divide by zero or walk a
  // NaN grid.
  const lo = min;
  const hi = max > min ? max : min;
  const stride = step > 0 ? step : 1;
  const current = clamp(controlled ? value : internal, lo, hi);
  const latestValueRef = useRef(current);
  latestValueRef.current = current;
  const percent = hi > lo ? ((current - lo) / (hi - lo)) * 100 : 0;

  const commit = useCallback(
    (next: number) => {
      const clean = snapSliderValue(next, lo, hi, stride);
      if (clean === latestValueRef.current) return clean;

      latestValueRef.current = clean;
      if (!controlled) setInternal(clean);
      onValueChange?.(clean);

      return clean;
    },
    [controlled, onValueChange, lo, hi, stride],
  );

  const commitFromX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();

      if (!rect || rect.width === 0) return;

      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);

      commit(lo + ratio * (hi - lo));
    },
    [commit, lo, hi],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled || event.button !== 0 || draggingRef.current) return;
      // Start the drag first: capture is a convenience, and a browser that
      // refuses it — or a test DOM that has no pointer capture at all — must
      // not take the drag down with it.
      draggingRef.current = true;
      activePointerIdRef.current = event.pointerId;
      setDragging(true);
      capturePointer(event.currentTarget, event.pointerId);
      // A click on the track should land keyboard focus on the handle.
      sliderEl.current?.focus({ preventScroll: true });
      commitFromX(event.clientX);
    },
    [disabled, commitFromX],
  );

  const pendingClientXRef = useRef<number | null>(null);
  const moveFrameRef = useRef<number | null>(null);

  const cancelPendingPointerMove = useCallback(() => {
    if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current);

    moveFrameRef.current = null;
    pendingClientXRef.current = null;
  }, []);

  const queuePointerMove = useCallback(
    (clientX: number) => {
      pendingClientXRef.current = clientX;

      if (moveFrameRef.current !== null) return;

      moveFrameRef.current = requestAnimationFrame(() => {
        moveFrameRef.current = null;
        const pendingClientX = pendingClientXRef.current;
        pendingClientXRef.current = null;

        if (pendingClientX !== null && draggingRef.current && !disabled) {
          commitFromX(pendingClientX);
        }
      });
    },
    [disabled, commitFromX],
  );

  const flushPointerMove = useCallback(
    (clientX: number) => {
      cancelPendingPointerMove();
      commitFromX(clientX);
    },
    [cancelPendingPointerMove, commitFromX],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || activePointerIdRef.current !== event.pointerId || disabled) {
        return;
      }

      queuePointerMove(event.clientX);
    },
    [disabled, queuePointerMove],
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || activePointerIdRef.current !== event.pointerId) return;

      activePointerIdRef.current = null;
      draggingRef.current = false;
      releasePointer(event.currentTarget, event.pointerId);
      setDragging(false);
      onValueCommit?.(latestValueRef.current);
    },
    [onValueCommit],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current && activePointerIdRef.current === event.pointerId) {
        flushPointerMove(event.clientX);
      }

      endDrag(event);
    },
    [flushPointerMove, endDrag],
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (activePointerIdRef.current !== event.pointerId) return;

      cancelPendingPointerMove();
      endDrag(event);
    },
    [cancelPendingPointerMove, endDrag],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleWindowBlur = () => {
      if (!draggingRef.current) return;
      cancelPendingPointerMove();
      const pointerId = activePointerIdRef.current;
      activePointerIdRef.current = null;
      draggingRef.current = false;
      if (trackRef.current && pointerId !== null) {
        releasePointer(trackRef.current, pointerId);
      }
      setDragging(false);
      onValueCommit?.(latestValueRef.current);
    };

    window.addEventListener("blur", handleWindowBlur);

    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [dragging, onValueCommit, cancelPendingPointerMove]);

  useEffect(
    () => () => {
      cancelPendingPointerMove();
    },
    [cancelPendingPointerMove],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled) return;

      let next: number | undefined;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = current + stride;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = current - stride;
          break;
        case "PageUp":
          next = current + stride * 10;
          break;
        case "PageDown":
          next = current - stride * 10;
          break;
        case "Home":
          next = lo;
          break;
        case "End":
          next = hi;
          break;
      }

      if (next !== undefined) {
        event.preventDefault();
        const committed = commit(next);
        onValueCommit?.(committed);
      }
    },
    [disabled, current, stride, lo, hi, commit, onValueCommit],
  );

  return {
    current,
    percent,
    dragging,
    min: lo,
    max: hi,
    step: stride,
    commit,
    /** Pointer handlers for the track element — drag anywhere on it. */
    trackProps: {
      ref: trackRef,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
    },
    /** ARIA + keyboard props for the focusable slider element. */
    sliderProps: {
      // Callback keeps the handle typed across button/div/motion hosts.
      ref: (node: HTMLElement | null) => {
        sliderEl.current = node;
      },
      role: "slider" as const,
      tabIndex: disabled ? -1 : 0,
      "aria-label": ariaLabel,
      "aria-valuemin": lo,
      "aria-valuemax": hi,
      "aria-valuenow": current,
      "aria-valuetext": formatValueText?.(current),
      "aria-disabled": disabled || undefined,
      onKeyDown,
    },
  };
}
