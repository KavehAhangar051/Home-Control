"use client";

import { Scissors, X } from "lucide-react";
import { m } from "motion/react";
import React from "react";
import { SPRING_BOUNCE } from "@/lib/ease";
import type { ConnectingWireDraft } from "./useWorkflowStudio";
import { buildWorkflowBezierPath, getPortAnchor } from "./workflowEngine";
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
 * Renders interactive workflow Bezier wires with DesignPass-inspired flowing signal packets,
 * magnetic wire wake-up feedback during drafting, and hover-cut midpoint disconnection.
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

  const draftSource = connectingDraft ? nodeMap.get(connectingDraft.sourceId) : undefined;
  const draftAnchor = draftSource ? getPortAnchor(draftSource, "out") : null;

  const draftBezier =
    draftAnchor && connectingDraft
      ? buildWorkflowBezierPath(
          draftAnchor.x,
          draftAnchor.y,
          connectingDraft.pointerWorldX,
          connectingDraft.pointerWorldY,
        )
      : null;

  const isDraftMagnetic = Boolean(connectingDraft?.magneticTargetId);

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

        const start = getPortAnchor(source, "out");
        const end = getPortAnchor(target, "in");
        const { path, midX, midY } = buildWorkflowBezierPath(start.x, start.y, end.x, end.y);
        const isActive = activeEdgeIds.has(edge.id);
        const isSelected = selectedEdgeId === edge.id;

        const strokeColor = isSelected
          ? "var(--accent3)"
          : isActive
            ? "#10b981"
            : "var(--border-color)";

        return (
          <g key={edge.id} className="group/edge pointer-events-auto">
            {/* Wide invisible hit target for effortless touch, mouse selection & hover-cut */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectEdge(isSelected ? null : edge.id);
              }}
            />

            {/* Soft luminous aura when active, selected, or hovered */}
            <path
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={6}
              strokeLinecap="round"
              className={`pointer-events-none transition-opacity duration-150 ${
                isActive || isSelected
                  ? "opacity-20 group-hover/edge:stroke-red-500 group-hover/edge:opacity-25"
                  : "opacity-0 group-hover/edge:stroke-red-500 group-hover/edge:opacity-25"
              }`}
            />

            {/* Main Bezier cable */}
            <path
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isSelected || isActive ? 2.75 : 2}
              strokeOpacity={isActive || isSelected ? 0.96 : 0.72}
              strokeLinecap="round"
              className={`pointer-events-none transition-[stroke,stroke-opacity] duration-150 ${
                isSelected
                  ? ""
                  : "group-hover/edge:stroke-red-500 group-hover/edge:[stroke-dasharray:6_4]"
              }`}
            />

            {/* Flowing active signal dashes + luminous spark packet */}
            {isActive && animationsEnabled && (
              <>
                <path
                  d={path}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  strokeDasharray="6 10"
                  strokeLinecap="round"
                  className="pointer-events-none animate-[dash_1s_linear_infinite] group-hover/edge:opacity-0"
                />
                <circle
                  r={4.5}
                  fill="#10b981"
                  fillOpacity={0.28}
                  className="pointer-events-none group-hover/edge:opacity-0"
                >
                  <animateMotion dur="1.25s" repeatCount="indefinite" path={path} />
                </circle>
                <circle
                  r={2.5}
                  fill="#a7f3d0"
                  className="pointer-events-none group-hover/edge:opacity-0"
                >
                  <animateMotion dur="1.25s" repeatCount="indefinite" path={path} />
                </circle>
              </>
            )}

            <circle
              cx={start.x}
              cy={start.y}
              r={3.8}
              fill={isActive ? "#10b981" : "var(--card-bg-solid)"}
              stroke={strokeColor}
              strokeWidth={2}
              className="pointer-events-none transition-colors group-hover/edge:stroke-red-500"
            />
            <circle
              cx={end.x}
              cy={end.y}
              r={3.8}
              fill={isActive ? "#10b981" : "var(--card-bg-solid)"}
              stroke={strokeColor}
              strokeWidth={2}
              className="pointer-events-none transition-colors group-hover/edge:stroke-red-500"
            />

            {/* Hover / Selection Quick-Cut Action Badge */}
            <foreignObject
              x={midX - 16}
              y={midY - 16}
              width={32}
              height={32}
              className="overflow-visible"
            >
              <m.div
                initial={false}
                animate={animationsEnabled && isSelected ? { scale: 1.05 } : { scale: 1 }}
                transition={SPRING_BOUNCE}
                className={`flex h-8 w-8 items-center justify-center transition-all duration-150 ${
                  isSelected
                    ? "pointer-events-auto scale-100 opacity-100"
                    : "pointer-events-none scale-75 opacity-0 group-hover/edge:pointer-events-auto group-hover/edge:scale-100 group-hover/edge:opacity-100"
                }`}
              >
                <button
                  type="button"
                  aria-label="قطع اتصال"
                  title="قطع اتصال"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEdge(edge.id);
                  }}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-red-500/60 bg-[var(--card-bg-solid)] text-red-500 shadow-lg transition-transform hover:scale-110 hover:bg-red-500 hover:text-white active:scale-95"
                >
                  {isSelected ? (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </m.div>
            </foreignObject>
          </g>
        );
      })}

      {/* Live Draft Wire with Magnetic Port Wake-Up Spark */}
      {draftBezier && draftAnchor && connectingDraft && (
        <g className="pointer-events-none">
          {isDraftMagnetic && (
            <path
              d={draftBezier.path}
              fill="none"
              stroke="#10b981"
              strokeWidth={7}
              strokeOpacity={0.22}
              strokeLinecap="round"
            />
          )}

          <path
            d={draftBezier.path}
            fill="none"
            stroke={isDraftMagnetic ? "#10b981" : "var(--accent3)"}
            strokeWidth={isDraftMagnetic ? 3 : 2.5}
            strokeDasharray={isDraftMagnetic ? "8 6" : "5 5"}
            strokeLinecap="round"
            className={animationsEnabled ? "animate-[dash_0.65s_linear_infinite]" : undefined}
          />

          {isDraftMagnetic && animationsEnabled && (
            <circle r={3} fill="#a7f3d0">
              <animateMotion dur="0.7s" repeatCount="indefinite" path={draftBezier.path} />
            </circle>
          )}

          <circle
            cx={draftAnchor.x}
            cy={draftAnchor.y}
            r={4.5}
            fill={isDraftMagnetic ? "#10b981" : "var(--accent3)"}
          />
          <circle
            cx={connectingDraft.pointerWorldX}
            cy={connectingDraft.pointerWorldY}
            r={isDraftMagnetic ? 5.5 : 4}
            fill={isDraftMagnetic ? "#10b981" : "var(--card-bg-solid)"}
            stroke={isDraftMagnetic ? "#a7f3d0" : "var(--accent3)"}
            strokeWidth={2}
          />
        </g>
      )}
    </svg>
  );
});
