import {
  canConnectWorkflowPorts,
  getPortAnchor,
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

  return Number(clamped.toFixed(2));
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

  for (const candidate of nodes) {
    if (!canConnectWorkflowPorts(edges, nodes, sourceId, candidate.id)) {
      continue;
    }

    const anchor = getPortAnchor(candidate, "in");
    const distance = Math.hypot(pointerWorldX - anchor.x, pointerWorldY - anchor.y);

    if (distance <= snapRadius && (!bestMatch || distance < bestMatch.distance)) {
      bestMatch = {
        targetId: candidate.id,
        anchorX: anchor.x,
        anchorY: anchor.y,
        distance,
      };
    }
  }

  return bestMatch;
}
