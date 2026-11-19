"use client";

import React from "react";
import { clampCanvasZoom } from "./canvasGeometry";
import type { CanvasViewport } from "./canvasTypes";
import { clearSheetPanMotionCssVars, setSheetPanMotionCssVars } from "./nodeMotion";
import { createSheetViewportAnimator, type SheetViewportAnimator } from "./sheetViewportAnimator";

export interface UseSheetViewportGesturesOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<CanvasViewport>;
  setViewport: (updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => void;
  setViewportTransient: (
    updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport),
  ) => void;
  onBackgroundClick?: () => void;
  onPanEnd?: (finalViewport: CanvasViewport) => void;
  isAttached?: boolean;
}

const LEFT_PAN_DRAG_THRESHOLD_PX = 3.5;

function isInteractiveCanvasOverlayTarget(target: HTMLElement | null): boolean {
  if (!target) return false;

  return Boolean(
    target.closest(
      "[data-canvas-node='true'], [data-canvas-chrome='true'], button, a, input, textarea, select, [role='button'], [contenteditable='true']",
    ),
  );
}

/**
 * Deep, reusable infinite-sheet viewport & kinetic gesture controller.
 * Encapsulates ResizeObserver container sizing, smooth focal-point zoom (`handleZoomBy`),
 * non-passive wheel zoom interpolation, 2-finger pinch-to-zoom, left/middle/right-click & touch
 * panning with physical momentum inertia coasting, and camera flight (`animateToViewport`).
 */
export function useSheetViewportGestures({
  containerRef,
  viewportRef,
  setViewport,
  setViewportTransient,
  onBackgroundClick,
  onPanEnd,
  isAttached = true,
}: UseSheetViewportGesturesOptions) {
  const [containerSize, setContainerSize] = React.useState({ width: 960, height: 600 });
  const [isPanning, setIsPanning] = React.useState(false);

  const onBackgroundClickRef = React.useRef(onBackgroundClick);
  const onPanEndRef = React.useRef(onPanEnd);
  const setViewportRef = React.useRef(setViewport);
  const setViewportTransientRef = React.useRef(setViewportTransient);

  React.useEffect(() => {
    onBackgroundClickRef.current = onBackgroundClick;
    onPanEndRef.current = onPanEnd;
    setViewportRef.current = setViewport;
    setViewportTransientRef.current = setViewportTransient;
  }, [onBackgroundClick, onPanEnd, setViewport, setViewportTransient]);

  const animatorRef = React.useRef<SheetViewportAnimator | null>(null);
  if (!animatorRef.current) {
    animatorRef.current = createSheetViewportAnimator({
      getContainer: () => containerRef.current,
      getCurrentViewport: () => viewportRef.current,
      applyTransientViewport: (next) => {
        setViewportTransientRef.current(next);
      },
      commitViewport: (finalVp) => {
        setViewportRef.current(finalVp);
        onPanEndRef.current?.(finalVp);
      },
    });
  }

  React.useEffect(() => {
    return () => {
      animatorRef.current?.cancelAll();
    };
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;

    if (!isAttached || !el) return;

    const updateRect = () => {
      const rect = el.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(el);

    return () => observer.disconnect();
  }, [containerRef, isAttached]);

  const animateToViewport = React.useCallback((target: CanvasViewport, durationMs = 260) => {
    animatorRef.current?.animateToViewport(target, durationMs);
  }, []);

  const handleZoomBy = React.useCallback(
    (delta: number, focalClientX?: number, focalClientY?: number) => {
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();

      const anchorX =
        focalClientX !== undefined && rect ? focalClientX - rect.left : containerSize.width / 2;

      const anchorY =
        focalClientY !== undefined && rect ? focalClientY - rect.top : containerSize.height / 2;

      animatorRef.current?.queueSmoothFocalZoom(delta, anchorX, anchorY);
    },
    [containerRef, containerSize],
  );

  React.useEffect(() => {
    const el = containerRef.current;

    if (!isAttached || !el) return;

    const onWheel = (e: WheelEvent) => {
      // SAFETY: WheelEvent target in DOM is an Element/HTMLElement
      const target = e.target as HTMLElement | null;

      if (target?.closest("[data-canvas-scroll-area='true']") && !e.ctrlKey && !e.metaKey) {
        return;
      }

      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 0.11 : -0.11;

      animatorRef.current?.queueSmoothFocalZoom(delta, anchorX, anchorY);
    };

    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchWorldX = 0;
    let pinchWorldY = 0;
    let isPinching = false;
    let pinchFrameId: number | null = null;
    let pendingPinchTarget: { nextZoom: number; midX: number; midY: number } | null = null;

    const applyPendingPinch = () => {
      pinchFrameId = null;
      const target = pendingPinchTarget;
      pendingPinchTarget = null;

      if (!target) return;

      setViewportTransient({
        x: Math.round(target.midX - pinchWorldX * target.nextZoom),
        y: Math.round(target.midY - pinchWorldY * target.nextZoom),
        zoom: target.nextZoom,
      });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        animatorRef.current?.cancelAll();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        const curr = viewportRef.current;
        pinchStartZoom = curr.zoom;
        pinchWorldX = (midX - curr.x) / curr.zoom;
        pinchWorldY = (midY - curr.y) / curr.zoom;
        isPinching = pinchStartDist > 12;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist > 12) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const ratio = dist / pinchStartDist;
        const nextZoom = clampCanvasZoom(pinchStartZoom * ratio);
        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        pendingPinchTarget = { nextZoom, midX, midY };

        if (pinchFrameId === null) {
          pinchFrameId = requestAnimationFrame(applyPendingPinch);
        }
      }
    };

    const onTouchFinish = (e: TouchEvent) => {
      if (!isPinching || e.touches.length >= 2) return;

      isPinching = false;
      pinchStartDist = 0;

      if (pinchFrameId !== null) {
        cancelAnimationFrame(pinchFrameId);
        applyPendingPinch();
      }

      onPanEndRef.current?.(viewportRef.current);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchFinish);
    el.addEventListener("touchcancel", onTouchFinish);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchFinish);
      el.removeEventListener("touchcancel", onTouchFinish);

      if (pinchFrameId !== null) {
        cancelAnimationFrame(pinchFrameId);
      }
    };
  }, [containerRef, isAttached, setViewportTransient, viewportRef]);

  const handleCanvasPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // SAFETY: PointerEvent target in DOM is an HTMLElement
      const target = e.target as HTMLElement;

      if (target.closest("input, textarea, select, [contenteditable='true']")) return;

      const isRightOrMiddle = e.button === 2 || e.button === 1;
      const isLeftBackground = e.button === 0 && !isInteractiveCanvasOverlayTarget(target);

      if (!isRightOrMiddle && !isLeftBackground) return;

      animatorRef.current?.cancelAll();

      if (isRightOrMiddle) {
        e.preventDefault();
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const initialVpX = viewportRef.current.x;
      const initialVpY = viewportRef.current.y;

      let hasExceededThreshold = isRightOrMiddle || e.pointerType === "touch";
      if (hasExceededThreshold) {
        setIsPanning(true);
        if (!isRightOrMiddle) {
          onBackgroundClickRef.current?.();
        }
      }

      let lastSampleX = startX;
      let lastSampleY = startY;
      let lastSampleTime = performance.now();
      let velocityX = 0;
      let velocityY = 0;

      const applyMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!hasExceededThreshold) {
          if (Math.hypot(dx, dy) < LEFT_PAN_DRAG_THRESHOLD_PX) {
            return;
          }
          hasExceededThreshold = true;
          setIsPanning(true);
          onBackgroundClickRef.current?.();
        }

        const now = performance.now();
        const dt = Math.max(4, now - lastSampleTime);
        const frameDx = moveEvent.clientX - lastSampleX;
        const frameDy = moveEvent.clientY - lastSampleY;

        const instVx = frameDx / dt;
        const instVy = frameDy / dt;
        velocityX = velocityX * 0.35 + instVx * 0.65;
        velocityY = velocityY * 0.35 + instVy * 0.65;

        lastSampleX = moveEvent.clientX;
        lastSampleY = moveEvent.clientY;
        lastSampleTime = now;

        setSheetPanMotionCssVars(containerRef.current, frameDx, frameDy);

        setViewportTransient((prev) => ({
          ...prev,
          x: Math.round(initialVpX + dx),
          y: Math.round(initialVpY + dy),
        }));
      };

      let pendingMove: PointerEvent | null = null;
      let frameId: number | null = null;

      const flushMove = () => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;

        const latestMove = pendingMove;
        pendingMove = null;

        if (latestMove) applyMove(latestMove);
      };

      const onMove = (moveEvent: PointerEvent) => {
        pendingMove = moveEvent;

        if (frameId === null) {
          frameId = requestAnimationFrame(() => {
            frameId = null;
            const latestMove = pendingMove;
            pendingMove = null;

            if (latestMove) applyMove(latestMove);
          });
        }
      };

      const cleanupListeners = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
      };

      const onUp = (endEvent: PointerEvent) => {
        pendingMove = endEvent;
        flushMove();
        cleanupListeners();
        setIsPanning(false);

        if (!hasExceededThreshold) {
          clearSheetPanMotionCssVars(containerRef.current);
          onBackgroundClickRef.current?.();
          return;
        }

        const idleAgeMs = performance.now() - lastSampleTime;
        if (idleAgeMs < 65) {
          animatorRef.current?.startPanInertia(velocityX, velocityY);
        } else {
          clearSheetPanMotionCssVars(containerRef.current);
          onPanEndRef.current?.(viewportRef.current);
        }
      };

      const onCancel = () => {
        flushMove();
        cleanupListeners();
        setIsPanning(false);
        clearSheetPanMotionCssVars(containerRef.current);
        if (hasExceededThreshold) {
          onPanEndRef.current?.(viewportRef.current);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [containerRef, setViewportTransient, viewportRef],
  );

  const handleCanvasContextMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    // SAFETY: MouseEvent target in DOM is an HTMLElement
    const target = e.target as HTMLElement | null;

    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

    e.preventDefault();
  }, []);

  return {
    containerSize,
    isPanning,
    animateToViewport,
    handleZoomBy,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  };
}
