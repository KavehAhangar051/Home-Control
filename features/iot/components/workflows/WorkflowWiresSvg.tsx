"use client";

import React from "react";
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
 * Renders interactive workflow Bezier wires paired with a GPU-composited signal particle overlay.
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

  const draftSource = connectingDraft ? nodeMap.get(connectingDraft.sourceId) : undefined;
  const draftAnchor = draftSource ? getPortAnchor(draftSource, "out") : null;
  const showParticles = animationsEnabled && !isLiteTier;

  const draftBezierPath =
    showParticles && draftAnchor && connectingDraft?.magneticTargetId
      ? buildWorkflowBezierPath(
          draftAnchor.x,
          draftAnchor.y,
          connectingDraft.pointerWorldX,
          connectingDraft.pointerWorldY,
        ).path
      : null;

  return (
    <>
      <svg
        aria-label="اتصالات گردش کار"
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        style={{ width: 1, height: 1 }}
      >
        {edges.map((edge) => {
          const source = nodeMap.get(edge.sourceId);
          const target = nodeMap.get(edge.targetId);

          if (!source || !target) return null;

          return (
            <WorkflowEdgeItem
              key={edge.id}
              edge={edge}
              source={source}
              target={target}
              resolvedPortIdx={incomingIndexByEdgeId.get(edge.id) ?? 0}
              totalInPorts={getNodeInputCount(target)}
              isActive={activeEdgeIds.has(edge.id)}
              isSelected={selectedEdgeId === edge.id}
              animationsEnabled={animationsEnabled}
              onSelectEdge={onSelectEdge}
              onDeleteEdge={onDeleteEdge}
              onHoverEdge={setHoveredEdgeId}
            />
          );
        })}

        {draftAnchor && connectingDraft && (
          <WorkflowDraftWire draftAnchor={draftAnchor} connectingDraft={connectingDraft} />
        )}
      </svg>

      {showParticles && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 size-0 overflow-visible"
        >
          {edges.map((edge) => {
            if (!activeEdgeIds.has(edge.id) || hoveredEdgeId === edge.id) return null;

            const source = nodeMap.get(edge.sourceId);
            const target = nodeMap.get(edge.targetId);

            if (!source || !target) return null;

            const start = getPortAnchor(source, "out");
            const end = getPortAnchor(
              target,
              "in",
              incomingIndexByEdgeId.get(edge.id) ?? 0,
              getNodeInputCount(target),
            );
            const { path } = buildWorkflowBezierPath(start.x, start.y, end.x, end.y);

            const baseStyle: React.CSSProperties = {
              offsetPath: `path("${path}")`,
              offsetAnchor: "50% 50%",
              offsetRotate: "0deg",
              animationDuration: "1.25s",
              transform: "translateZ(0)",
            };

            return (
              <React.Fragment key={`${edge.id}-particles`}>
                <span
                  className="animate-wire-signal pointer-events-none absolute top-0 left-0 flex size-3.5 items-center justify-center rounded-full bg-success/30"
                  style={baseStyle}
                >
                  <span className="size-1.5 rounded-full bg-success" />
                </span>
                <span
                  className="animate-wire-signal pointer-events-none absolute top-0 left-0 flex size-3.5 items-center justify-center rounded-full bg-success/30"
                  style={{ ...baseStyle, animationDelay: "-0.625s" }}
                >
                  <span className="size-1.5 rounded-full bg-success" />
                </span>
              </React.Fragment>
            );
          })}

          {draftBezierPath && (
            <span
              className="animate-wire-signal pointer-events-none absolute top-0 left-0 flex size-3.5 items-center justify-center rounded-full bg-success/35"
              style={{
                offsetPath: `path("${draftBezierPath}")`,
                offsetAnchor: "50% 50%",
                offsetRotate: "0deg",
                animationDuration: "0.7s",
                transform: "translateZ(0)",
              }}
            >
              <span className="size-1.5 rounded-full bg-success" />
            </span>
          )}
        </div>
      )}
    </>
  );
});
