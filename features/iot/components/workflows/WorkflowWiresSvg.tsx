"use client";

import React from "react";
import type { ConnectingWireDraft } from "./useWorkflowStudio";
import { WorkflowDraftWire, WorkflowEdgeItem } from "./WorkflowEdgeItem";
import { getNodeInputCount, getPortAnchor } from "./workflowEngine";
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
 * Renders interactive workflow Bezier wires and live connection draft feedback.
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

  return (
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
          />
        );
      })}

      {draftAnchor && connectingDraft && (
        <WorkflowDraftWire
          draftAnchor={draftAnchor}
          connectingDraft={connectingDraft}
          animationsEnabled={animationsEnabled}
        />
      )}
    </svg>
  );
});
