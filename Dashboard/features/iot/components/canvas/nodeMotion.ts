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

  return Math.round(clamped * 100) / 100;
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

    if (
      candidate.id === sourceId ||
      candidate.kind === "trigger_manual" ||
      candidate.kind === "trigger_schedule"
    ) {
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
