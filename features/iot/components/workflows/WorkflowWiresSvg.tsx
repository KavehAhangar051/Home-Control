"use client";

import React from "react";
import { CompositedBezierParticle } from "@/components/motion/composited-bezier-particle";
import { useIsLitePerformanceTier } from "@/lib/hooks/use-performance-tier";
import type { ConnectingWireDraft } from "./useWorkflowStudio";
import { WorkflowDraftWire, WorkflowEdgeItem } from "./WorkflowEdgeItem";
import { buildWorkflowBezierPath, getNodeInputCount, getPortAnchor } from "./workflowEngine";
import type { WorkflowEdge, WorkflowNode } from "./workflowTypes";

interface WorkflowWiresSvgProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  activeEdgeIds: Set<string>;
  selectedEdgeId: string | null;
  connectingDraft: ConnectingWireDraft | null;
  animationsEnabled: boolean;
  onSelectEdge: (edgeId: string | null) => void;
  onDeleteEdge: (edgeId: string) => void;
}

/**
 * Renders interactive workflow Bezier wires with compositor-friendly signal particle animations.
 */
export default React.memo(function WorkflowWiresSvg({
  nodes,
  edges,
  activeEdgeIds,
  selectedEdgeId,
  connectingDraft,
  animationsEnabled,
  onSelectEdge,
  onDeleteEdge,
}: WorkflowWiresSvgProps) {
  const isLiteTier = useIsLitePerformanceTier();
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);

  const nodeMap = React.useMemo(() => {
    const map = new Map<string, WorkflowNode>();

    for (const node of nodes) {
      map.set(node.id, node);
    }

    return map;
  }, [nodes]);

  const incomingIndexByEdgeId = React.useMemo(() => {
    const countsByTarget = new Map<string, number>();
    const indexMap = new Map<string, number>();

    for (const edge of edges) {
      const idx = countsByTarget.get(edge.targetId) ?? 0;
      indexMap.set(edge.id, edge.targetPortIndex ?? idx);
      countsByTarget.set(edge.targetId, idx + 1);
    }

    return indexMap;
  }, [edges]);

  const geometryByEdgeId = React.useMemo(() => {
    const geometryMap = new Map<string, ReturnType<typeof buildWorkflowBezierPath>>();

    for (const edge of edges) {
      const source = nodeMap.get(edge.sourceId);
      const target = nodeMap.get(edge.targetId);

      if (!source || !target) continue;

      const start = getPortAnchor(source, "out");
      const end = getPortAnchor(
        target,
        "in",
        incomingIndexByEdgeId.get(edge.id) ?? 0,
        getNodeInputCount(target),
      );

      geometryMap.set(edge.id, buildWorkflowBezierPath(start.x, start.y, end.x, end.y));
    }

    return geometryMap;
  }, [edges, incomingIndexByEdgeId, nodeMap]);

  const draftSource = connectingDraft ? nodeMap.get(connectingDraft.sourceId) : undefined;
  const draftAnchor = draftSource ? getPortAnchor(draftSource, "out") : null;
  const showParticles = animationsEnabled && !isLiteTier;

  const draftGeometry =
    draftAnchor && connectingDraft
      ? buildWorkflowBezierPath(
          draftAnchor.x,
          draftAnchor.y,
          connectingDraft.pointerWorldX,
          connectingDraft.pointerWorldY,
        )
      : null;
  const draftBezierCurve =
    showParticles && connectingDraft?.magneticTargetId ? draftGeometry : null;

  return (
    <>
      <svg
        aria-label="اتصالات گردش کار"
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        style={{ width: 1, height: 1 }}
      >
        {edges.map((edge) => {
          const geometry = geometryByEdgeId.get(edge.id);
          if (!geometry) return null;

          return (
            <WorkflowEdgeItem
              key={edge.id}
              edge={edge}
              geometry={geometry}
              isActive={activeEdgeIds.has(edge.id)}
              isSelected={selectedEdgeId === edge.id}
              animationsEnabled={animationsEnabled}
              onSelectEdge={onSelectEdge}
              onDeleteEdge={onDeleteEdge}
              onHoverEdge={setHoveredEdgeId}
            />
          );
        })}

        {draftAnchor && connectingDraft && draftGeometry && (
          <WorkflowDraftWire
            draftAnchor={draftAnchor}
            connectingDraft={connectingDraft}
            geometry={draftGeometry}
          />
        )}
      </svg>

      {showParticles && (
        <div
          aria-hidden="true"
          style={{ contain: "layout style" }}
          className="pointer-events-none absolute top-0 left-0 size-0 overflow-visible"
        >
          {edges.map((edge) => {
            if (!activeEdgeIds.has(edge.id) || hoveredEdgeId === edge.id) return null;

            const curve = geometryByEdgeId.get(edge.id);
            if (!curve) return null;

            return (
              <React.Fragment key={`${edge.id}-particles`}>
                <CompositedBezierParticle
                  curve={curve}
                  durationMs={1250}
                  className="flex size-3.5 items-center justify-center rounded-full bg-success/30"
                >
                  <span className="size-1.5 rounded-full bg-success" />
                </CompositedBezierParticle>
                <CompositedBezierParticle
                  curve={curve}
                  durationMs={1250}
                  delayMs={-625}
                  className="flex size-3.5 items-center justify-center rounded-full bg-success/30"
                >
                  <span className="size-1.5 rounded-full bg-success" />
                </CompositedBezierParticle>
              </React.Fragment>
            );
          })}

          {draftBezierCurve && (
            <CompositedBezierParticle
              curve={draftBezierCurve}
              durationMs={700}
              className="flex size-3.5 items-center justify-center rounded-full bg-success/35"
            >
              <span className="size-1.5 rounded-full bg-success" />
            </CompositedBezierParticle>
          )}
        </div>
      )}
    </>
  );
});
