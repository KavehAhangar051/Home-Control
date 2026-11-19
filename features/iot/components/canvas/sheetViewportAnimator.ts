import { clampCanvasZoom, computeFocalZoomViewport } from "./canvasGeometry";
import type { CanvasViewport } from "./canvasTypes";
import {
  areSheetAnimationsAllowed,
  clearSheetPanMotionCssVars,
  setSheetPanMotionCssVars,
} from "./nodeMotion";

export interface SheetViewportAnimatorDeps {
  getContainer: () => HTMLDivElement | null;
  getCurrentViewport: () => CanvasViewport;
  applyTransientViewport: (next: CanvasViewport) => void;
  commitViewport: (finalViewport: CanvasViewport) => void;
}

export interface SheetViewportAnimator {
  cancelAll: () => void;
  animateToViewport: (target: CanvasViewport, durationMs?: number) => void;
  queueSmoothFocalZoom: (deltaZoom: number, anchorX: number, anchorY: number) => void;
  startPanInertia: (velocityXPerMs: number, velocityYPerMs: number) => void;
}

const MIN_INERTIA_SPEED_PX_PER_MS = 0.08;
const STOP_INERTIA_SPEED_PX_PER_MS = 0.022;
const INERTIA_FRICTION_PER_FRAME = 0.915;
const MAX_INERTIA_SPEED_PX_PER_MS = 3.2;

function easeOutCubic(t: number): number {
  const inv = 1 - Math.min(1, Math.max(0, t));
  return 1 - inv * inv * inv;
}

/**
 * Creates a frame-rate-independent imperative viewport camera & inertia engine
 * for infinite sheets (Home Canvas & Workflow Studio).
 *
 * Provides:
 * 1. `animateToViewport`: smooth cubic-out camera flight for Fit View, Reset Layout, and center-on-node.
 * 2. `queueSmoothFocalZoom`: continuous critically damped focal zoom for mouse-wheel and +/- buttons.
 * 3. `startPanInertia`: physical momentum coasting after releasing a pan gesture, paired with
 *    zero-re-render CSS custom property spatial parallax/tilt on the sheet container.
 */
export function createSheetViewportAnimator(
  deps: SheetViewportAnimatorDeps,
): SheetViewportAnimator {
  let activeFrameId: number | null = null;
  let activeMode: "idle" | "flight" | "zoom" | "inertia" = "idle";
  let zoomTargetViewport: CanvasViewport | null = null;

  const stopAnimationLoop = (shouldCommit: boolean) => {
    if (activeFrameId !== null) {
      cancelAnimationFrame(activeFrameId);
      activeFrameId = null;
    }

    const hadActiveLoop = activeMode !== "idle";
    activeMode = "idle";
    zoomTargetViewport = null;
    clearSheetPanMotionCssVars(deps.getContainer());

    if (shouldCommit && hadActiveLoop) {
      deps.commitViewport(deps.getCurrentViewport());
    }
  };

  const cancelAll = () => {
    stopAnimationLoop(false);
  };

  const animateToViewport = (target: CanvasViewport, durationMs = 260) => {
    stopAnimationLoop(false);

    const safeTarget: CanvasViewport = {
      x: Math.round(target.x),
      y: Math.round(target.y),
      zoom: clampCanvasZoom(target.zoom),
    };

    const start = deps.getCurrentViewport();
    const dx = safeTarget.x - start.x;
    const dy = safeTarget.y - start.y;
    const dz = safeTarget.zoom - start.zoom;

    if (
      !areSheetAnimationsAllowed() ||
      durationMs <= 0 ||
      (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(dz) < 0.005)
    ) {
      deps.applyTransientViewport(safeTarget);
      deps.commitViewport(safeTarget);
      return;
    }

    activeMode = "flight";
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);

      if (progress >= 1) {
        activeFrameId = null;
        activeMode = "idle";
        clearSheetPanMotionCssVars(deps.getContainer());
        deps.applyTransientViewport(safeTarget);
        deps.commitViewport(safeTarget);
        return;
      }

      const nextX = Math.round(start.x + dx * eased);
      const nextY = Math.round(start.y + dy * eased);
      const nextZoom = Math.round((start.zoom + dz * eased) * 1000) / 1000;

      deps.applyTransientViewport({
        x: nextX,
        y: nextY,
        zoom: nextZoom,
      });

      activeFrameId = requestAnimationFrame(step);
    };

    activeFrameId = requestAnimationFrame(step);
  };

  const queueSmoothFocalZoom = (deltaZoom: number, anchorX: number, anchorY: number) => {
    if (activeMode !== "zoom") {
      stopAnimationLoop(false);
    }

    const baseViewport = zoomTargetViewport ?? deps.getCurrentViewport();
    const nextTarget = computeFocalZoomViewport(
      baseViewport,
      baseViewport.zoom + deltaZoom,
      anchorX,
      anchorY,
    );

    if (!areSheetAnimationsAllowed()) {
      zoomTargetViewport = null;
      deps.applyTransientViewport(nextTarget);
      deps.commitViewport(nextTarget);
      return;
    }

    zoomTargetViewport = nextTarget;

    if (activeMode === "zoom" && activeFrameId !== null) {
      return;
    }

    activeMode = "zoom";
    let lastTime = performance.now();

    const step = (now: number) => {
      const target = zoomTargetViewport;
      if (!target) {
        stopAnimationLoop(true);
        return;
      }

      const dt = Math.min(64, Math.max(4, now - lastTime));
      lastTime = now;

      const current = deps.getCurrentViewport();
      const alpha = 1 - 0.001 ** (dt / 170);

      const nextZoom = current.zoom + (target.zoom - current.zoom) * alpha;
      const nextX = current.x + (target.x - current.x) * alpha;
      const nextY = current.y + (target.y - current.y) * alpha;

      const done =
        Math.abs(target.zoom - nextZoom) < 0.003 &&
        Math.abs(target.x - nextX) < 0.6 &&
        Math.abs(target.y - nextY) < 0.6;

      if (done) {
        activeFrameId = null;
        activeMode = "idle";
        zoomTargetViewport = null;
        deps.applyTransientViewport(target);
        deps.commitViewport(target);
        return;
      }

      deps.applyTransientViewport({
        x: Math.round(nextX * 10) / 10,
        y: Math.round(nextY * 10) / 10,
        zoom: Math.round(nextZoom * 1000) / 1000,
      });

      activeFrameId = requestAnimationFrame(step);
    };

    activeFrameId = requestAnimationFrame(step);
  };

  const startPanInertia = (velocityXPerMs: number, velocityYPerMs: number) => {
    stopAnimationLoop(false);

    const rawSpeed = Math.hypot(velocityXPerMs, velocityYPerMs);
    if (!areSheetAnimationsAllowed() || rawSpeed < MIN_INERTIA_SPEED_PX_PER_MS) {
      clearSheetPanMotionCssVars(deps.getContainer());
      deps.commitViewport(deps.getCurrentViewport());
      return;
    }

    const scale =
      rawSpeed > MAX_INERTIA_SPEED_PX_PER_MS ? MAX_INERTIA_SPEED_PX_PER_MS / rawSpeed : 1;
    let vx = velocityXPerMs * scale;
    let vy = velocityYPerMs * scale;

    const initialVp = deps.getCurrentViewport();
    let floatX = initialVp.x;
    let floatY = initialVp.y;
    let lastTime = performance.now();
    activeMode = "inertia";

    const step = (now: number) => {
      const dt = Math.min(48, Math.max(4, now - lastTime));
      lastTime = now;

      const decay = INERTIA_FRICTION_PER_FRAME ** (dt / 16.67);
      vx *= decay;
      vy *= decay;

      const speed = Math.hypot(vx, vy);
      if (speed < STOP_INERTIA_SPEED_PX_PER_MS) {
        activeFrameId = null;
        activeMode = "idle";
        clearSheetPanMotionCssVars(deps.getContainer());
        const settled: CanvasViewport = {
          ...deps.getCurrentViewport(),
          x: Math.round(floatX),
          y: Math.round(floatY),
        };
        deps.applyTransientViewport(settled);
        deps.commitViewport(settled);
        return;
      }

      floatX += vx * dt;
      floatY += vy * dt;

      setSheetPanMotionCssVars(deps.getContainer(), vx * 16.67, vy * 16.67);

      deps.applyTransientViewport({
        ...deps.getCurrentViewport(),
        x: Math.round(floatX),
        y: Math.round(floatY),
      });

      activeFrameId = requestAnimationFrame(step);
    };

    activeFrameId = requestAnimationFrame(step);
  };

  return {
    cancelAll,
    animateToViewport,
    queueSmoothFocalZoom,
    startPanInertia,
  };
}
