"use client";

import React from "react";
import {
  type CanvasGridStyle,
  clampCanvasZoom,
  getCanvasGridStyle,
  getCanvasGridTransform,
} from "./canvasGeometry";
import type { CanvasViewport } from "./canvasTypes";
import {
  applyViewportToDom,
  createSheetViewportAnimator,
  type SheetViewportAnimator,
} from "./sheetViewportAnimator";

export interface UseSheetViewportGesturesOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  worldPlaneRef?: React.RefObject<HTMLDivElement | null>;
  gridLayerRef?: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<CanvasViewport>;
  setViewport: (updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => void;
  setViewportTransient: (
    updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport),
  ) => void;
  computeGridStyle?: (x: number, y: number, zoom: number) => CanvasGridStyle;
  isLocked?: boolean;
  onBackgroundClick?: () => void;
  onPanEnd?: (finalViewport: CanvasViewport) => void;
  isAttached?: boolean;
}

const LEFT_PAN_DRAG_THRESHOLD_PX = 3.5;
const TOUCH_PAN_DRAG_THRESHOLD_PX = 10;
const POST_PINCH_REENTRY_THRESHOLD_PX = 18;
const POST_PINCH_SETTLE_MS = 90;
const MIN_PINCH_DISTANCE_PX = 18;

type ActiveGesture =
  | { mode: "idle" }
  | {
      mode: "pan";
      pointerId: number;
      pointerType: string;
      isRightOrMiddle: boolean;
      startedOnNode: boolean;
      startedOnInteractiveControl: boolean;
      scrollAreaEl: HTMLElement | null;
      startX: number;
      startY: number;
      initialVpX: number;
      initialVpY: number;
      hasExceededThreshold: boolean;
      lastX: number;
      lastY: number;
      lastTime: number;
      vx: number;
      vy: number;
      postPinchSettleUntil: number;
    }
  | {
      mode: "scroll-child";
      pointerId: number;
      scrollEl: HTMLElement;
      startX: number;
      startY: number;
      lastY: number;
      hasExceededThreshold: boolean;
    }
  | {
      mode: "pinch";
      p1Id: number;
      p2Id: number;
      startDist: number;
      startZoom: number;
      lastZoom: number;
      worldX: number;
      worldY: number;
    };

function isAlwaysBlockedInputTarget(target: HTMLElement | null): boolean {
  if (!target) return false;

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='slider'], [data-canvas-slider='true'], [data-canvas-resize='true'], [data-canvas-chrome='true'], [data-canvas-drag-handle='true']",
    ),
  );
}

function isInteractiveControlTarget(target: HTMLElement | null): boolean {
  if (!target) return false;

  return Boolean(target.closest("button, a, [role='button'], [role='slider']"));
}

function canScrollElementVertically(scrollEl: HTMLElement | null, deltaY: number): boolean {
  if (!scrollEl?.isConnected) return false;
  if (scrollEl.scrollHeight <= scrollEl.clientHeight + 2) return false;

  if (deltaY > 0) {
    return scrollEl.scrollTop > 1;
  }

  if (deltaY < 0) {
    return scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight - 1;
  }

  return false;
}

function installOneShotClickSuppressor(container: HTMLElement) {
  let timerId: number | null = null;
  const suppressClick = (clickEvent: MouseEvent) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    cleanup();
  };
  const cleanup = () => {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    container.removeEventListener("click", suppressClick, true);
  };

  container.addEventListener("click", suppressClick, true);
  timerId = window.setTimeout(cleanup, 320);
}

/**
 * Unified infinite-sheet viewport & multi-touch gesture engine.
 * Combines mouse pan/wheel, touch scroll-area delegation, finger-locked single-touch pan
 * (zero surprise inertia drift), and 2-finger pinch-to-zoom inside one pointer-ID-locked
 * state machine so 1<->2 finger transitions never jump.
 */
export function useSheetViewportGestures({
  containerRef,
  worldPlaneRef: externalWorldPlaneRef,
  gridLayerRef: externalGridLayerRef,
  viewportRef,
  setViewport,
  setViewportTransient,
  computeGridStyle = getCanvasGridStyle,
  isLocked = false,
  onBackgroundClick,
  onPanEnd,
  isAttached = true,
}: UseSheetViewportGesturesOptions) {
  const internalWorldPlaneRef = React.useRef<HTMLDivElement | null>(null);
  const internalGridLayerRef = React.useRef<HTMLDivElement | null>(null);
  const worldPlaneRef = externalWorldPlaneRef ?? internalWorldPlaneRef;
  const gridLayerRef = externalGridLayerRef ?? internalGridLayerRef;

  const [containerSize, setContainerSize] = React.useState({ width: 960, height: 600 });
  const [isPanning, setIsPanning] = React.useState(false);

  const onBackgroundClickRef = React.useRef(onBackgroundClick);
  const onPanEndRef = React.useRef(onPanEnd);
  const setViewportRef = React.useRef(setViewport);
  const setViewportTransientRef = React.useRef(setViewportTransient);
  const computeGridStyleRef = React.useRef(computeGridStyle);
  const isLockedRef = React.useRef(isLocked);
  const cachedReadoutsRef = React.useRef<HTMLElement[] | null>(null);
  const containerRectRef = React.useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  React.useEffect(() => {
    onBackgroundClickRef.current = onBackgroundClick;
    onPanEndRef.current = onPanEnd;
    setViewportRef.current = setViewport;
    setViewportTransientRef.current = setViewportTransient;
    computeGridStyleRef.current = computeGridStyle;
    isLockedRef.current = isLocked;
  }, [onBackgroundClick, onPanEnd, setViewport, setViewportTransient, computeGridStyle, isLocked]);

  const primeReadoutCache = React.useCallback(() => {
    if (typeof document === "undefined") return;
    cachedReadoutsRef.current = Array.from(
      document.querySelectorAll<HTMLElement>('[data-sheet-zoom-readout="true"]'),
    );
  }, []);

  const applyFastTransientViewport = React.useCallback(
    (next: CanvasViewport) => {
      viewportRef.current = next;
      const plane = worldPlaneRef.current;

      if (plane) {
        applyViewportToDom(
          containerRef.current,
          plane,
          next,
          computeGridStyleRef.current,
          gridLayerRef.current,
          cachedReadoutsRef.current,
        );
      } else {
        setViewportTransientRef.current(next);
      }
    },
    [containerRef, gridLayerRef, viewportRef, worldPlaneRef],
  );

  const commitFinalViewport = React.useCallback(
    (finalVp: CanvasViewport) => {
      const normalized: CanvasViewport = {
        x: Math.round(finalVp.x * 10) / 10,
        y: Math.round(finalVp.y * 10) / 10,
        zoom: clampCanvasZoom(finalVp.zoom),
      };
      viewportRef.current = normalized;

      if (worldPlaneRef.current) {
        applyViewportToDom(
          containerRef.current,
          worldPlaneRef.current,
          normalized,
          computeGridStyleRef.current,
          gridLayerRef.current,
          cachedReadoutsRef.current,
        );
      }

      setViewportRef.current(normalized);
      onPanEndRef.current?.(normalized);
    },
    [containerRef, gridLayerRef, viewportRef, worldPlaneRef],
  );

  const syncViewportToDom = React.useCallback(
    (vp: CanvasViewport) => {
      viewportRef.current = vp;
      applyViewportToDom(
        containerRef.current,
        worldPlaneRef.current,
        vp,
        computeGridStyleRef.current,
        gridLayerRef.current,
        cachedReadoutsRef.current,
      );
    },
    [containerRef, gridLayerRef, viewportRef, worldPlaneRef],
  );

  const animatorRef = React.useRef<SheetViewportAnimator | null>(null);
  if (!animatorRef.current) {
    animatorRef.current = createSheetViewportAnimator({
      getContainer: () => containerRef.current,
      getCurrentViewport: () => viewportRef.current,
      applyTransientViewport: (next) => {
        applyFastTransientViewport(next);
      },
      commitViewport: (finalVp) => {
        commitFinalViewport(finalVp);
      },
    });
  }

  React.useEffect(() => {
    return () => {
      animatorRef.current?.cancelAll();
    };
  }, []);

  React.useEffect(() => {
    if (!isAttached) return;
    primeReadoutCache();
    syncViewportToDom(viewportRef.current);
  }, [isAttached, primeReadoutCache, syncViewportToDom, viewportRef]);

  React.useEffect(() => {
    const el = containerRef.current;

    if (!isAttached || !el) return;

    const updateRect = () => {
      const rect = el.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        containerRectRef.current = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        setContainerSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height },
        );
      }
    };

    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(el);
    window.addEventListener("resize", updateRect, { passive: true });
    window.addEventListener("scroll", updateRect, { passive: true, capture: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [containerRef, isAttached]);

  const animateToViewport = React.useCallback(
    (target: CanvasViewport, durationMs = 260) => {
      primeReadoutCache();
      animatorRef.current?.animateToViewport(target, durationMs);
    },
    [primeReadoutCache],
  );

  const handleZoomBy = React.useCallback(
    (delta: number, focalClientX?: number, focalClientY?: number) => {
      primeReadoutCache();
      const rect = containerRectRef.current ?? containerRef.current?.getBoundingClientRect();

      const anchorX =
        focalClientX !== undefined && rect ? focalClientX - rect.left : containerSize.width / 2;

      const anchorY =
        focalClientY !== undefined && rect ? focalClientY - rect.top : containerSize.height / 2;

      animatorRef.current?.queueSmoothFocalZoom(delta, anchorX, anchorY);
    },
    [containerRef, containerSize, primeReadoutCache],
  );

  const startSinglePanRef = React.useRef<(e: React.PointerEvent<HTMLDivElement>) => void>(() => {});

  React.useEffect(() => {
    const el = containerRef.current;

    if (!isAttached || !el) return;

    const touchPointers = new Map<number, { x: number; y: number }>();
    let gesture: ActiveGesture = { mode: "idle" };
    let frameId: number | null = null;
    let pendingPanEvent: PointerEvent | null = null;
    let pinchMoved = false;

    const cancelFrame = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      pendingPanEvent = null;
    };

    const initializePinchFromTouches = () => {
      if (touchPointers.size < 2) return;

      cancelFrame();
      animatorRef.current?.cancelAll();
      primeReadoutCache();
      setIsPanning(false);

      const entries = Array.from(touchPointers.entries());
      const [p1Id, p1] = entries[0];
      const [p2Id, p2] = entries[1];
      const measured = el.getBoundingClientRect();
      containerRectRef.current = {
        left: measured.left,
        top: measured.top,
        width: measured.width,
        height: measured.height,
      };
      const midX = (p1.x + p2.x) / 2 - measured.left;
      const midY = (p1.y + p2.y) / 2 - measured.top;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curr = viewportRef.current;

      pinchMoved = false;
      gesture = {
        mode: "pinch",
        p1Id,
        p2Id,
        startDist: dist,
        startZoom: curr.zoom,
        lastZoom: curr.zoom,
        worldX: (midX - curr.x) / curr.zoom,
        worldY: (midY - curr.y) / curr.zoom,
      };
    };

    const applyPinchFrame = () => {
      frameId = null;
      if (gesture.mode !== "pinch") return;

      const p1 = touchPointers.get(gesture.p1Id);
      const p2 = touchPointers.get(gesture.p2Id);
      if (!p1 || !p2) return;

      const rect = containerRectRef.current ?? el.getBoundingClientRect();
      const midX = (p1.x + p2.x) / 2 - rect.left;
      const midY = (p1.y + p2.y) / 2 - rect.top;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      if (gesture.startDist < MIN_PINCH_DISTANCE_PX) {
        if (dist >= MIN_PINCH_DISTANCE_PX) {
          const curr = viewportRef.current;
          gesture.startDist = dist;
          gesture.startZoom = curr.zoom;
          gesture.lastZoom = curr.zoom;
          gesture.worldX = (midX - curr.x) / curr.zoom;
          gesture.worldY = (midY - curr.y) / curr.zoom;
        }
        return;
      }

      if (dist < 6) return;

      const candidateZoom = clampCanvasZoom(gesture.startZoom * (dist / gesture.startDist));
      const frameRatio = candidateZoom / Math.max(0.1, gesture.lastZoom);
      if (frameRatio > 1.8 || frameRatio < 0.55) {
        return;
      }

      gesture.lastZoom = candidateZoom;
      pinchMoved = true;
      const nextX = Math.round((midX - gesture.worldX * candidateZoom) * 10) / 10;
      const nextY = Math.round((midY - gesture.worldY * candidateZoom) * 10) / 10;

      applyFastTransientViewport({ x: nextX, y: nextY, zoom: candidateZoom });
    };

    const applyPanMove = (moveEvent: PointerEvent) => {
      if (gesture.mode !== "pan" || moveEvent.pointerId !== gesture.pointerId) return;

      const now = performance.now();

      if (gesture.postPinchSettleUntil > 0 && now < gesture.postPinchSettleUntil) {
        gesture.startX = moveEvent.clientX;
        gesture.startY = moveEvent.clientY;
        gesture.lastX = moveEvent.clientX;
        gesture.lastY = moveEvent.clientY;
        gesture.lastTime = now;
        return;
      }

      const threshold = gesture.isRightOrMiddle
        ? 0
        : gesture.pointerType === "touch"
          ? gesture.postPinchSettleUntil > 0
            ? POST_PINCH_REENTRY_THRESHOLD_PX
            : TOUCH_PAN_DRAG_THRESHOLD_PX
          : LEFT_PAN_DRAG_THRESHOLD_PX;

      let dx = moveEvent.clientX - gesture.startX;
      let dy = moveEvent.clientY - gesture.startY;

      if (!gesture.hasExceededThreshold) {
        if (Math.hypot(dx, dy) < threshold) return;

        // Hand off vertical scroll inside overflowing group bodies to scroll-child when appropriate
        if (
          gesture.pointerType === "touch" &&
          gesture.scrollAreaEl &&
          Math.abs(dy) >= Math.abs(dx) &&
          canScrollElementVertically(gesture.scrollAreaEl, dy)
        ) {
          installOneShotClickSuppressor(el);
          gesture = {
            mode: "scroll-child",
            pointerId: gesture.pointerId,
            scrollEl: gesture.scrollAreaEl,
            startX: gesture.startX,
            startY: gesture.startY,
            lastY: moveEvent.clientY,
            hasExceededThreshold: true,
          };
          return;
        }

        gesture.hasExceededThreshold = true;
        gesture.initialVpX = viewportRef.current.x;
        gesture.initialVpY = viewportRef.current.y;
        gesture.startX = moveEvent.clientX;
        gesture.startY = moveEvent.clientY;
        gesture.lastX = moveEvent.clientX;
        gesture.lastY = moveEvent.clientY;
        gesture.lastTime = now;
        dx = 0;
        dy = 0;
        primeReadoutCache();
        setIsPanning(true);

        if (gesture.pointerType === "touch") {
          installOneShotClickSuppressor(el);
        } else if (!gesture.isRightOrMiddle && !gesture.startedOnNode) {
          onBackgroundClickRef.current?.();
        }
      }

      const dt = Math.max(4, now - gesture.lastTime);
      const frameDx = moveEvent.clientX - gesture.lastX;
      const frameDy = moveEvent.clientY - gesture.lastY;

      gesture.vx = gesture.vx * 0.35 + (frameDx / dt) * 0.65;
      gesture.vy = gesture.vy * 0.35 + (frameDy / dt) * 0.65;
      gesture.lastX = moveEvent.clientX;
      gesture.lastY = moveEvent.clientY;
      gesture.lastTime = now;

      applyFastTransientViewport({
        zoom: viewportRef.current.zoom,
        x: Math.round((gesture.initialVpX + dx) * 10) / 10,
        y: Math.round((gesture.initialVpY + dy) * 10) / 10,
      });
    };

    const applyScrollChildMove = (moveEvent: PointerEvent) => {
      if (gesture.mode !== "scroll-child" || moveEvent.pointerId !== gesture.pointerId) return;

      const deltaY = moveEvent.clientY - gesture.lastY;
      gesture.lastY = moveEvent.clientY;
      gesture.scrollEl.scrollTop -= deltaY;
    };

    const onCapturePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;

      // SAFETY: PointerEvent target in DOM is an HTMLElement
      const target = e.target as HTMLElement | null;
      if (isAlwaysBlockedInputTarget(target)) return;

      touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (touchPointers.size >= 2) {
        initializePinchFromTouches();
        return;
      }

      if (gesture.mode !== "idle") return;

      animatorRef.current?.cancelAll();
      primeReadoutCache();

      const scrollArea = target?.closest<HTMLElement>("[data-canvas-scroll-area='true']") ?? null;
      const validScrollArea =
        scrollArea && scrollArea.scrollHeight > scrollArea.clientHeight + 2 ? scrollArea : null;

      const curr = viewportRef.current;

      gesture = {
        mode: "pan",
        pointerId: e.pointerId,
        pointerType: "touch",
        isRightOrMiddle: false,
        startedOnNode: Boolean(target?.closest("[data-canvas-node='true']")),
        startedOnInteractiveControl: isInteractiveControlTarget(target),
        scrollAreaEl: validScrollArea,
        startX: e.clientX,
        startY: e.clientY,
        initialVpX: curr.x,
        initialVpY: curr.y,
        hasExceededThreshold: false,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: performance.now(),
        vx: 0,
        vy: 0,
        postPinchSettleUntil: 0,
      };
    };

    startSinglePanRef.current = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      if (gesture.mode !== "idle") return;

      // SAFETY: PointerEvent target in DOM is an HTMLElement
      const target = e.target as HTMLElement | null;

      if (isAlwaysBlockedInputTarget(target)) return;

      const isRightOrMiddle = e.button === 2 || e.button === 1;

      if (!isRightOrMiddle && e.button !== 0) return;

      const insideNode = Boolean(target?.closest("[data-canvas-node='true']"));
      const onInteractiveControl = isInteractiveControlTarget(target);

      if (!isRightOrMiddle) {
        if (onInteractiveControl) return;

        // Desktop mouse pans on empty background (or locked card space)
        if (insideNode && !isLockedRef.current) return;
      } else {
        e.preventDefault();
      }

      animatorRef.current?.cancelAll();
      primeReadoutCache();

      const curr = viewportRef.current;
      const immediateThreshold = isRightOrMiddle;

      if (immediateThreshold) {
        setIsPanning(true);
      }

      gesture = {
        mode: "pan",
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        isRightOrMiddle,
        startedOnNode: insideNode,
        startedOnInteractiveControl: onInteractiveControl,
        scrollAreaEl: null,
        startX: e.clientX,
        startY: e.clientY,
        initialVpX: curr.x,
        initialVpY: curr.y,
        hasExceededThreshold: immediateThreshold,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: performance.now(),
        vx: 0,
        vy: 0,
        postPinchSettleUntil: 0,
      };
    };

    const onWindowPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerType === "touch") {
        const touchPoint = touchPointers.get(moveEvent.pointerId);
        if (touchPoint) {
          touchPoint.x = moveEvent.clientX;
          touchPoint.y = moveEvent.clientY;
        }
      }

      if (gesture.mode === "pinch") {
        if (moveEvent.pointerId !== gesture.p1Id && moveEvent.pointerId !== gesture.p2Id) return;

        if (frameId === null) {
          frameId = requestAnimationFrame(applyPinchFrame);
        }
        return;
      }

      if (gesture.mode === "scroll-child" && moveEvent.pointerId === gesture.pointerId) {
        applyScrollChildMove(moveEvent);
        return;
      }

      if (gesture.mode === "pan" && moveEvent.pointerId === gesture.pointerId) {
        // Safety if mouse button was released outside window without pointerup
        if (moveEvent.pointerType === "mouse" && moveEvent.buttons === 0) {
          finishActivePointer(moveEvent, false);
          return;
        }

        pendingPanEvent = moveEvent;
        if (frameId === null) {
          frameId = requestAnimationFrame(() => {
            frameId = null;
            const latest = pendingPanEvent;
            pendingPanEvent = null;
            if (latest) applyPanMove(latest);
          });
        }
      }
    };

    const finishActivePointer = (endEvent: PointerEvent, allowInertia: boolean) => {
      if (endEvent.pointerType === "touch") {
        touchPointers.delete(endEvent.pointerId);
      }

      if (gesture.mode === "pinch") {
        if (endEvent.pointerId !== gesture.p1Id && endEvent.pointerId !== gesture.p2Id) return;

        if (frameId !== null) {
          cancelAnimationFrame(frameId);
          applyPinchFrame();
        }

        if (pinchMoved) {
          installOneShotClickSuppressor(el);
        }

        const postPinchVp = viewportRef.current;

        if (touchPointers.size === 1) {
          const [remId, remPos] = Array.from(touchPointers.entries())[0];
          const now = performance.now();
          gesture = {
            mode: "pan",
            pointerId: remId,
            pointerType: "touch",
            isRightOrMiddle: false,
            startedOnNode: true,
            startedOnInteractiveControl: false,
            scrollAreaEl: null,
            startX: remPos.x,
            startY: remPos.y,
            initialVpX: postPinchVp.x,
            initialVpY: postPinchVp.y,
            hasExceededThreshold: false,
            lastX: remPos.x,
            lastY: remPos.y,
            lastTime: now,
            vx: 0,
            vy: 0,
            postPinchSettleUntil: now + POST_PINCH_SETTLE_MS,
          };
          setIsPanning(false);
          commitFinalViewport(postPinchVp);
          return;
        }

        gesture = { mode: "idle" };
        setIsPanning(false);
        commitFinalViewport(postPinchVp);
        return;
      }

      if (gesture.mode === "scroll-child" && endEvent.pointerId === gesture.pointerId) {
        gesture = { mode: "idle" };
        return;
      }

      if (gesture.mode === "pan" && endEvent.pointerId === gesture.pointerId) {
        const latestPending = pendingPanEvent;
        cancelFrame();
        if (allowInertia && latestPending && gesture.hasExceededThreshold) {
          applyPanMove(latestPending);
        }

        const finished = gesture;
        gesture = { mode: "idle" };
        setIsPanning(false);

        if (!finished.hasExceededThreshold) {
          if (
            !finished.startedOnNode &&
            !finished.isRightOrMiddle &&
            !finished.startedOnInteractiveControl &&
            finished.postPinchSettleUntil === 0
          ) {
            onBackgroundClickRef.current?.();
          }
          return;
        }

        const now = performance.now();
        const isTouchPointer = finished.pointerType === "touch";

        // Touch gestures always stop 100% locked where the user lifted their finger (zero surprise drift)
        if (!isTouchPointer && allowInertia && now - finished.lastTime < 50) {
          animatorRef.current?.startPanInertia(finished.vx, finished.vy);
        } else {
          commitFinalViewport(viewportRef.current);
        }
      }
    };

    const onWindowPointerUp = (e: PointerEvent) => finishActivePointer(e, true);
    const onWindowPointerCancel = (e: PointerEvent) => finishActivePointer(e, false);

    const resetOrphanGestures = () => {
      cancelFrame();
      touchPointers.clear();
      const wasActive =
        gesture.mode === "pinch" || (gesture.mode === "pan" && gesture.hasExceededThreshold);
      gesture = { mode: "idle" };
      setIsPanning(false);
      if (wasActive) {
        commitFinalViewport(viewportRef.current);
      }
    };

    const onTouchEndSafety = (e: TouchEvent) => {
      if (e.touches.length === 0 && touchPointers.size > 0) {
        resetOrphanGestures();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        resetOrphanGestures();
      }
    };

    const onWheel = (e: WheelEvent) => {
      // SAFETY: WheelEvent target in DOM is an Element/HTMLElement
      const target = e.target as HTMLElement | null;
      const scrollArea = target?.closest<HTMLElement>("[data-canvas-scroll-area='true']");

      if (
        scrollArea &&
        scrollArea.scrollHeight > scrollArea.clientHeight + 2 &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        return;
      }

      e.preventDefault();
      primeReadoutCache();
      const rect = containerRectRef.current ?? el.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 0.11 : -0.11;

      animatorRef.current?.queueSmoothFocalZoom(delta, anchorX, anchorY);
    };

    el.addEventListener("pointerdown", onCapturePointerDown, { capture: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchend", onTouchEndSafety);
    el.addEventListener("touchcancel", onTouchEndSafety);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerCancel);
    window.addEventListener("blur", resetOrphanGestures);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelFrame();
      el.removeEventListener("pointerdown", onCapturePointerDown, { capture: true });
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchend", onTouchEndSafety);
      el.removeEventListener("touchcancel", onTouchEndSafety);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      window.removeEventListener("blur", resetOrphanGestures);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    applyFastTransientViewport,
    commitFinalViewport,
    containerRef,
    isAttached,
    primeReadoutCache,
    viewportRef,
  ]);

  const handleCanvasPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    startSinglePanRef.current(e);
  }, []);

  const handleCanvasContextMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    // SAFETY: MouseEvent target in DOM is an HTMLElement
    const target = e.target as HTMLElement | null;

    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

    e.preventDefault();
  }, []);

  const initialGridStyle = React.useMemo<React.CSSProperties>(() => {
    const grid = getCanvasGridTransform(0, 0, 1);

    return {
      inset: -48,
      backgroundImage: "radial-gradient(circle, var(--border-color) 1.25px, transparent 1.25px)",
      backgroundPosition: "48px 48px",
      backgroundSize: grid.backgroundSize,
      transform: grid.transform,
      backfaceVisibility: "hidden",
    };
  }, []);

  return {
    worldPlaneRef,
    gridLayerRef,
    initialGridStyle,
    containerSize,
    isPanning,
    animateToViewport,
    syncViewportToDom,
    handleZoomBy,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  };
}
