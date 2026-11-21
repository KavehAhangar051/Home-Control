import {
  canConnectWorkflowPorts,
  getPortAnchor,
  isTriggerWorkflowNodeKind,
} from "@/features/iot/components/workflows/workflowEngine";
import type { WorkflowEdge, WorkflowNode } from "@/features/iot/components/workflows/workflowTypes";

/**
 * Pure state returned when a dragged wire enters the magnetic capture radius
 * of an eligible workflow target input port.
 */
export interface MagneticPortMatch {
  targetId: string;
  anchorX: number;
  anchorY: number;
  distance: number;
}

export interface FindMagneticPortOptions {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  sourceId: string;
  pointerWorldX: number;
  pointerWorldY: number;
  snapRadius?: number;
}

export type CanvasNodeMotionState = {
  opacity: number;
  scale: number;
  rotate: number;
  y: number;
};

const MOTION_IDLE_STATE: CanvasNodeMotionState = Object.freeze({
  opacity: 1,
  scale: 1,
  rotate: 0,
  y: 0,
});

const MOTION_DRAG_1016: CanvasNodeMotionState = Object.freeze({
  opacity: 1,
  scale: 1.016,
  rotate: 0,
  y: -2,
});

const MOTION_DRAG_1018: CanvasNodeMotionState = Object.freeze({
  opacity: 1,
  scale: 1.018,
  rotate: 0,
  y: -2,
});

const MOTION_DRAG_1022: CanvasNodeMotionState = Object.freeze({
  opacity: 1,
  scale: 1.022,
  rotate: 0,
  y: -2,
});

/**
 * Computes the unified motion target state for canvas and workflow nodes
 * across idle, dragging, and reduced-motion states.
 */
export function resolveCanvasNodeMotionState(
  animationsEnabled: boolean,
  isDragging: boolean,
  dragTiltDeg: number,
  dragScale = 1.018,
): CanvasNodeMotionState {
  if (!animationsEnabled || !isDragging) {
    return MOTION_IDLE_STATE;
  }

  if (dragTiltDeg === 0) {
    if (dragScale === 1.016) return MOTION_DRAG_1016;
    if (dragScale === 1.018) return MOTION_DRAG_1018;
    if (dragScale === 1.022) return MOTION_DRAG_1022;
  }

  return {
    opacity: 1,
    scale: dragScale,
    rotate: dragTiltDeg,
    y: -2,
  };
}

/**
 * Converts horizontal pointer drag velocity (`deltaClientX` between pointermove frames)
 * into a subtle, physically grounded tilt angle in degrees (`[-maxDeg, +maxDeg]`).
 * Applies a small deadzone so micro-jitter during slow drags stays level.
 */
export function computeDragTiltDeg(deltaClientX: number, maxDeg = 2.6): number {
  if (!Number.isFinite(deltaClientX) || Math.abs(deltaClientX) < 1.5) {
    return 0;
  }

  const scaled = deltaClientX * 0.14;
  const clamped = Math.max(-maxDeg, Math.min(maxDeg, scaled));

  return Math.round(clamped * 100) / 100;
}

/**
 * Resolves the inner motion DOM element (`[data-canvas-node-motion="true"]`) for a dragged node once at gesture start.
 */
export function findNodeTiltElement(nodeId: string): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const escapedId =
    typeof CSS !== "undefined" && CSS.escape instanceof Function ? CSS.escape(nodeId) : nodeId;

  const nodeRoot = document.querySelector<HTMLElement>(`[data-canvas-node-id="${escapedId}"]`);
  if (!nodeRoot) return null;

  return nodeRoot.querySelector<HTMLElement>('[data-canvas-node-motion="true"]') ?? nodeRoot;
}

/**
 * Updates `style.rotate` imperatively on the dragged card's motion element so pointer velocity
 * animates smoothly on the compositor thread without triggering React re-renders or inherited style recalculation.
 */
export function setNodeDragTiltCssVar(element: HTMLElement | null, tiltDeg: number): void {
  if (!element) return;

  if (!areSheetAnimationsAllowed()) {
    if (element.style.rotate) {
      element.style.removeProperty("rotate");
    }
    return;
  }

  const rotateValue = `${tiltDeg}deg`;
  if (element.style.rotate !== rotateValue) {
    element.style.rotate = rotateValue;
  }
}

export function clearNodeDragTiltCssVar(element: HTMLElement | null): void {
  if (!element || !element.style.rotate) return;
  element.style.removeProperty("rotate");
}

/**
 * Checks whether canvas/sheet motion animations are enabled both in user preferences
 * (`document.documentElement.dataset.animationsEnabled`) and OS `prefers-reduced-motion`.
 */
let reducedMotionQuery: MediaQueryList | null = null;

export function areSheetAnimationsAllowed(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;

  if (document.documentElement.dataset.animationsEnabled === "false") {
    return false;
  }

  if (typeof window.matchMedia === "function") {
    reducedMotionQuery ??= window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotionQuery.matches) return false;
  }

  return true;
}

const cachedMotionNodesByContainer = new WeakMap<HTMLElement, HTMLElement[]>();
const panMotionStateByContainer = new WeakMap<
  HTMLElement,
  { tilt: number; shiftX: number; shiftY: number }
>();

function getContainerMotionNodes(container: HTMLElement): HTMLElement[] {
  let cached = cachedMotionNodesByContainer.get(container);
  if (!cached || cached.length === 0 || !cached[0]?.isConnected) {
    cached = Array.from(
      container.querySelectorAll<HTMLElement>('[data-canvas-node-motion="true"]'),
    );
    cachedMotionNodesByContainer.set(container, cached);
  }
  return cached;
}

/**
 * Refreshes the cached list of card motion elements inside `container` at the start of a pan gesture.
 */
export function primeSheetPanMotionNodes(container: HTMLElement | null): void {
  if (!container) return;
  cachedMotionNodesByContainer.set(
    container,
    Array.from(container.querySelectorAll<HTMLElement>('[data-canvas-node-motion="true"]')),
  );
}

/**
 * Imperatively updates non-inherited `rotate` and `translate` compositor properties directly
 * on the cached card motion elements inside `container` with built-in exponential smoothing.
 * Avoids mutating inherited CSS custom properties on the root container (which would force
 * Recalculate Style across 1,000+ inner DOM nodes every frame) and avoids CSS transition thrashing.
 */
export function setSheetPanMotionCssVars(
  container: HTMLElement | null,
  frameDeltaX: number,
  frameDeltaY: number,
): void {
  if (!container) return;

  if (!areSheetAnimationsAllowed()) {
    clearSheetPanMotionCssVars(container);
    return;
  }

  const targetTilt = computeDragTiltDeg(frameDeltaX * 0.65, 1.5);
  const targetShiftX = Math.max(-4.5, Math.min(4.5, frameDeltaX * 0.14));
  const targetShiftY = Math.max(-4.5, Math.min(4.5, frameDeltaY * 0.14));

  let motionState = panMotionStateByContainer.get(container);
  if (!motionState) {
    motionState = { tilt: 0, shiftX: 0, shiftY: 0 };
    panMotionStateByContainer.set(container, motionState);
  }

  const nextTilt = Math.round((motionState.tilt * 0.62 + targetTilt * 0.38) * 100) / 100;
  const nextShiftX = Math.round((motionState.shiftX * 0.62 + targetShiftX * 0.38) * 10) / 10;
  const nextShiftY = Math.round((motionState.shiftY * 0.62 + targetShiftY * 0.38) * 10) / 10;

  if (
    Math.abs(nextTilt - motionState.tilt) < 0.03 &&
    Math.abs(nextShiftX - motionState.shiftX) < 0.08 &&
    Math.abs(nextShiftY - motionState.shiftY) < 0.08
  ) {
    return;
  }

  motionState.tilt = nextTilt;
  motionState.shiftX = nextShiftX;
  motionState.shiftY = nextShiftY;

  const rotateValue = `${nextTilt}deg`;
  const translateValue = `${nextShiftX}px ${nextShiftY}px`;
  const nodes = getContainerMotionNodes(container);

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (el.style.rotate !== rotateValue) {
      el.style.rotate = rotateValue;
    }
    if (el.style.translate !== translateValue) {
      el.style.translate = translateValue;
    }
  }
}

export function clearSheetPanMotionCssVars(container: HTMLElement | null): void {
  if (!container) return;
  panMotionStateByContainer.delete(container);
  const nodes = getContainerMotionNodes(container);
  cachedMotionNodesByContainer.delete(container);

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (el.style.rotate) el.style.removeProperty("rotate");
    if (el.style.translate) el.style.removeProperty("translate");
  }
}

/**
 * Finds the closest eligible workflow target input port within `snapRadius` world pixels
 * of the pointer during wire drafting, enforcing cycle/self-loop validation.
 */
export function findMagneticInputPort({
  nodes,
  edges,
  sourceId,
  pointerWorldX,
  pointerWorldY,
  snapRadius = 42,
}: FindMagneticPortOptions): MagneticPortMatch | null {
  let bestMatch: MagneticPortMatch | null = null;
  let maxDistSq = snapRadius * snapRadius;

  for (let i = 0; i < nodes.length; i++) {
    const candidate = nodes[i];

    if (candidate.id === sourceId || isTriggerWorkflowNodeKind(candidate.kind)) {
      continue;
    }

    const anchor = getPortAnchor(candidate, "in");
    const dx = pointerWorldX - anchor.x;
    const dy = pointerWorldY - anchor.y;
    const distSq = dx * dx + dy * dy;

    // Fast spatial rejection before running graph cycle/duplicate edge BFS
    if (distSq > maxDistSq || (bestMatch !== null && distSq >= maxDistSq)) {
      continue;
    }

    if (!canConnectWorkflowPorts(edges, nodes, sourceId, candidate.id)) {
      continue;
    }

    const distance = Math.sqrt(distSq);
    maxDistSq = distSq;
    bestMatch = {
      targetId: candidate.id,
      anchorX: anchor.x,
      anchorY: anchor.y,
      distance,
    };
  }

  return bestMatch;
}
