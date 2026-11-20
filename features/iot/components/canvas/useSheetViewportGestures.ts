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
const TOUCH_PAN_DRAG_THRESHOLD_PX = 6;
const POST_PINCH_INERTIA_GUARD_MS = 150;
const POST_PINCH_MIN_FLICK_PX = 28;
const MIN_PINCH_DISTANCE_PX = 12;

type ActiveGesture =
  | { mode: "idle" }
  | {
      mode: "pan";
      pointerId: number;
      pointerType: string;
      isRightOrMiddle: boolean;
      startedOnNode: boolean;
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
      postPinchGuardUntil: number;
      postPinchTravel: number;
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
      worldX: number;
      worldY: number;
    };

function isAlwaysBlockedInputTarget(target: HTMLElement | null): boolean {
  if (!target) return false;

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [data-canvas-resize='true'], [data-canvas-chrome='true']",
    ),
  );
}

function isInteractiveControlTarget(target: HTMLElement | null): boolean {
  if (!target) return false;

  return Boolean(target.closest("button, a, [role='button'], [role='slider']"));
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
  timerId = window.setTimeout(cleanup, 260);
}

/**
 * Unified infinite-sheet viewport & multi-touch gesture engine.
 * Combines mouse pan/wheel, touch scroll-area delegation, single-finger pan with inertia,
 * and 2-finger pinch-to-zoom inside one pointer-ID-locked state machine so 1<->2 finger
 * transitions never jump to stale pre-pinch coordinates.
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
        x: Math.round(finalVp.x),
        y: Math.round(finalVp.y),
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
        setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(el);

    return () => observer.disconnect();
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
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();

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
      const rect = el.getBoundingClientRect();
      const midX = (p1.x + p2.x) / 2 - rect.left;
      const midY = (p1.y + p2.y) / 2 - rect.top;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const curr = viewportRef.current;

      pinchMoved = false;
      gesture = {
        mode: "pinch",
        p1Id,
        p2Id,
        startDist: dist,
        startZoom: curr.zoom,
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

      const rect = el.getBoundingClientRect();
      const midX = (p1.x + p2.x) / 2 - rect.left;
      const midY = (p1.y + p2.y) / 2 - rect.top;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      if (gesture.startDist < MIN_PINCH_DISTANCE_PX) {
        if (dist >= MIN_PINCH_DISTANCE_PX) {
          const curr = viewportRef.current;
          gesture.startDist = dist;
          gesture.startZoom = curr.zoom;
          gesture.worldX = (midX - curr.x) / curr.zoom;
          gesture.worldY = (midY - curr.y) / curr.zoom;
        }
        return;
      }

      if (dist < 4) return;

      pinchMoved = true;
      const nextZoom = clampCanvasZoom(gesture.startZoom * (dist / gesture.startDist));
      const nextX = Math.round((midX - gesture.worldX * nextZoom) * 10) / 10;
      const nextY = Math.round((midY - gesture.worldY * nextZoom) * 10) / 10;

      applyFastTransientViewport({ x: nextX, y: nextY, zoom: nextZoom });
    };

    const applyPanMove = (moveEvent: PointerEvent) => {
      if (gesture.mode !== "pan" || moveEvent.pointerId !== gesture.pointerId) return;

      const threshold = gesture.isRightOrMiddle
        ? 0
        : gesture.pointerType === "touch"
          ? TOUCH_PAN_DRAG_THRESHOLD_PX
          : LEFT_PAN_DRAG_THRESHOLD_PX;

      let dx = moveEvent.clientX - gesture.startX;
      let dy = moveEvent.clientY - gesture.startY;

      if (!gesture.hasExceededThreshold) {
        if (Math.hypot(dx, dy) < threshold) return;

        gesture.hasExceededThreshold = true;
        gesture.startX = moveEvent.clientX;
        gesture.startY = moveEvent.clientY;
        gesture.lastX = moveEvent.clientX;
        gesture.lastY = moveEvent.clientY;
        gesture.lastTime = performance.now();
        dx = 0;
        dy = 0;
        primeReadoutCache();
        setIsPanning(true);

        if (gesture.pointerType === "touch") {
          installOneShotClickSuppressor(el);
        }

        if (!gesture.isRightOrMiddle && !gesture.startedOnNode) {
          onBackgroundClickRef.current?.();
        }
      }

      const now = performance.now();
      const dt = Math.max(4, now - gesture.lastTime);
      const frameDx = moveEvent.clientX - gesture.lastX;
      const frameDy = moveEvent.clientY - gesture.lastY;

      gesture.vx = gesture.vx * 0.35 + (frameDx / dt) * 0.65;
      gesture.vy = gesture.vy * 0.35 + (frameDy / dt) * 0.65;
      gesture.postPinchTravel += Math.hypot(frameDx, frameDy);
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

      const totalDx = moveEvent.clientX - gesture.startX;
      const totalDy = moveEvent.clientY - gesture.startY;

      if (!gesture.hasExceededThreshold) {
        if (Math.hypot(totalDx, totalDy) < TOUCH_PAN_DRAG_THRESHOLD_PX) return;

        gesture.hasExceededThreshold = true;
        gesture.lastY = moveEvent.clientY;
        installOneShotClickSuppressor(el);
        return;
      }

      const deltaY = moveEvent.clientY - gesture.lastY;
      gesture.lastY = moveEvent.clientY;
      gesture.scrollEl.scrollTop -= deltaY;
    };

    const onCapturePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;

      // SAFETY: PointerEvent target in DOM is an HTMLElement
      if (isAlwaysBlockedInputTarget(e.target as HTMLElement | null)) return;

      touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (touchPointers.size === 2) {
        initializePinchFromTouches();
      }
    };

    startSinglePanRef.current = (e: React.PointerEvent<HTMLDivElement>) => {
      if (gesture.mode !== "idle") return;

      // SAFETY: PointerEvent target in DOM is an HTMLElement
      const target = e.target as HTMLElement | null;

      if (isAlwaysBlockedInputTarget(target)) return;

      const isTouch = e.pointerType === "touch";
      if (isTouch && touchPointers.size >= 2) return;

      const isRightOrMiddle = e.button === 2 || e.button === 1;

      if (!isRightOrMiddle && e.button !== 0) return;

      // Scrollable group container delegation on touch (even starting on a segment tile)
      if (isTouch && e.button === 0 && target) {
        const scrollArea = target.closest<HTMLElement>("[data-canvas-scroll-area='true']");
        if (scrollArea && scrollArea.scrollHeight > scrollArea.clientHeight + 2) {
          animatorRef.current?.cancelAll();
          gesture = {
            mode: "scroll-child",
            pointerId: e.pointerId,
            scrollEl: scrollArea,
            startX: e.clientX,
            startY: e.clientY,
            lastY: e.clientY,
            hasExceededThreshold: false,
          };
          return;
        }
      }

      const insideNode = Boolean(target?.closest("[data-canvas-node='true']"));
      const onInteractiveControl = isInteractiveControlTarget(target);

      if (!isRightOrMiddle) {
        if (onInteractiveControl) return;

        // Desktop mouse pans on empty background (or locked card space), touch pans on background or any non-button card space
        if (insideNode && !isTouch && !isLockedRef.current) return;
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
        postPinchGuardUntil: 0,
        postPinchTravel: 0,
      };
    };

    const onWindowPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerType === "touch" && touchPointers.has(moveEvent.pointerId)) {
        touchPointers.set(moveEvent.pointerId, { x: moveEvent.clientX, y: moveEvent.clientY });
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
            startX: remPos.x,
            startY: remPos.y,
            initialVpX: postPinchVp.x,
            initialVpY: postPinchVp.y,
            hasExceededThreshold: true,
            lastX: remPos.x,
            lastY: remPos.y,
            lastTime: now,
            vx: 0,
            vy: 0,
            postPinchGuardUntil: now + POST_PINCH_INERTIA_GUARD_MS,
            postPinchTravel: 0,
          };
          setIsPanning(true);
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
        if (allowInertia && latestPending) {
          applyPanMove(latestPending);
        }

        const finished = gesture;
        gesture = { mode: "idle" };
        setIsPanning(false);

        if (!finished.hasExceededThreshold) {
          if (!finished.startedOnNode && !finished.isRightOrMiddle) {
            onBackgroundClickRef.current?.();
          }
          return;
        }

        const now = performance.now();
        const isPostPinchGuarded =
          now < finished.postPinchGuardUntil && finished.postPinchTravel < POST_PINCH_MIN_FLICK_PX;

        if (allowInertia && !isPostPinchGuarded && now - finished.lastTime < 65) {
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
      const rect = el.getBoundingClientRect();
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
