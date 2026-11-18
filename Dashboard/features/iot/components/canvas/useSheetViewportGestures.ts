"use client";

import React from "react";
import { clampCanvasZoom, computeFocalZoomViewport } from "./canvasGeometry";
import type { CanvasViewport } from "./canvasTypes";

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

/**
 * Deep, reusable infinite-sheet viewport & gesture controller.
 * Encapsulates ResizeObserver container sizing, focal-point zoom (`handleZoomBy`),
 * non-passive wheel zoom, 2-finger pinch-to-zoom, right-click/touch panning,
 * and context menu prevention.
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

  React.useEffect(() => {
    onBackgroundClickRef.current = onBackgroundClick;
    onPanEndRef.current = onPanEnd;
  }, [onBackgroundClick, onPanEnd]);

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

  const handleZoomBy = React.useCallback(
    (delta: number, focalClientX?: number, focalClientY?: number) => {
      setViewport((prev) => {
        const el = containerRef.current;
        const rect = el?.getBoundingClientRect();

        const anchorX =
          focalClientX !== undefined && rect ? focalClientX - rect.left : containerSize.width / 2;

        const anchorY =
          focalClientY !== undefined && rect ? focalClientY - rect.top : containerSize.height / 2;

        return computeFocalZoomViewport(prev, prev.zoom + delta, anchorX, anchorY);
      });
    },
    [containerRef, containerSize, setViewport],
  );

  React.useEffect(() => {
    const el = containerRef.current;

    if (!isAttached || !el) return;

    let wheelFrameId: number | null = null;
    let wheelCommitTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingWheelDelta = 0;
    let pendingWheelClientX = 0;
    let pendingWheelClientY = 0;

    const flushWheelCommit = () => {
      if (wheelCommitTimer !== null) {
        clearTimeout(wheelCommitTimer);
        wheelCommitTimer = null;
      }

      onPanEndRef.current?.(viewportRef.current);
    };

    const scheduleWheelCommit = () => {
      if (wheelCommitTimer !== null) {
        clearTimeout(wheelCommitTimer);
      }

      wheelCommitTimer = setTimeout(() => {
        wheelCommitTimer = null;
        onPanEndRef.current?.(viewportRef.current);
      }, 160);
    };

    const applyPendingWheel = () => {
      wheelFrameId = null;
      const delta = pendingWheelDelta;
      const clientX = pendingWheelClientX;
      const clientY = pendingWheelClientY;
      pendingWheelDelta = 0;

      if (delta === 0) return;

      const rect = el.getBoundingClientRect();
      const anchorX = clientX - rect.left;
      const anchorY = clientY - rect.top;

      setViewportTransient((prev) =>
        computeFocalZoomViewport(prev, prev.zoom + delta, anchorX, anchorY),
      );
      scheduleWheelCommit();
    };

    const onWheel = (e: WheelEvent) => {
      // SAFETY: WheelEvent target in DOM is an Element/HTMLElement
      const target = e.target as HTMLElement | null;

      if (target?.closest("[data-canvas-scroll-area='true']") && !e.ctrlKey && !e.metaKey) {
        return;
      }

      e.preventDefault();
      pendingWheelDelta += e.deltaY < 0 ? 0.1 : -0.1;
      pendingWheelClientX = e.clientX;
      pendingWheelClientY = e.clientY;

      if (wheelFrameId === null) {
        wheelFrameId = requestAnimationFrame(applyPendingWheel);
      }
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

      if (wheelFrameId !== null) {
        cancelAnimationFrame(wheelFrameId);
        applyPendingWheel();
      }

      if (wheelCommitTimer !== null) {
        flushWheelCommit();
      }

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

      const isRightButton = e.button === 2;
      const isTouchPan = e.pointerType === "touch" && e.button === 0;

      if (e.button === 0 && !isTouchPan) {
        if (!target.closest("[data-canvas-node='true']")) {
          onBackgroundClickRef.current?.();
        }

        return;
      }

      if (!isRightButton && !isTouchPan) return;

      if (!isRightButton && target.closest("[data-canvas-node='true']")) return;

      if (isRightButton) {
        e.preventDefault();
      } else {
        onBackgroundClickRef.current?.();
      }

      setIsPanning(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const initialVpX = viewportRef.current.x;
      const initialVpY = viewportRef.current.y;

      const applyMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
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

      const finishPan = () => {
        setIsPanning(false);
        onPanEndRef.current?.(viewportRef.current);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
      };

      const onUp = (endEvent: PointerEvent) => {
        pendingMove = endEvent;
        flushMove();
        finishPan();
      };

      const onCancel = () => {
        flushMove();
        finishPan();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [setViewportTransient, viewportRef],
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
    handleZoomBy,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  };
}
