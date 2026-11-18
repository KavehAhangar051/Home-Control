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
  if (!animationsEnabled) {
    return { opacity: 1, scale: 1, rotate: 0, y: 0 };
  }

  return {
    opacity: 1,
    scale: isDragging ? dragScale : 1,
    rotate: isDragging ? dragTiltDeg : 0,
    y: isDragging ? -2 : 0,
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
 * Resolves the outer DOM element for a dragged node once at gesture start.
 */
export function findNodeTiltElement(nodeId: string): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const escapedId =
    typeof CSS !== "undefined" && CSS.escape instanceof Function ? CSS.escape(nodeId) : nodeId;

  return document.querySelector<HTMLElement>(`[data-canvas-node-id="${escapedId}"]`);
}

/**
 * Updates `--drag-tilt` imperatively on the dragged element so pointer velocity
 * animates smoothly on the compositor thread without triggering React re-renders.
 */
export function setNodeDragTiltCssVar(element: HTMLElement | null, tiltDeg: number): void {
  if (!element) return;

  if (
    typeof document !== "undefined" &&
    document.documentElement.dataset.animationsEnabled === "false"
  ) {
    element.style.removeProperty("--drag-tilt");

    return;
  }

  element.style.setProperty("--drag-tilt", `${tiltDeg}deg`);
}

export function clearNodeDragTiltCssVar(element: HTMLElement | null): void {
  if (!element) return;
  element.style.removeProperty("--drag-tilt");
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
