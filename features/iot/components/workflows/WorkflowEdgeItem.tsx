"use client";

import { Scissors, X } from "lucide-react";
import { m } from "motion/react";
import React from "react";
import { SPRING_BOUNCE } from "@/lib/ease";
import type { ConnectingWireDraft } from "./useWorkflowStudio";
import { buildWorkflowBezierPath, getPortAnchor } from "./workflowEngine";
import type { WorkflowEdge, WorkflowNode } from "./workflowTypes";

interface WorkflowEdgeItemProps {
  edge: WorkflowEdge;
  source: WorkflowNode;
  target: WorkflowNode;
  geometry: ReturnType<typeof buildWorkflowBezierPath> | undefined;
  resolvedPortIdx: number;
  totalInPorts: number;
  isActive: boolean;
  isSelected: boolean;
  animationsEnabled: boolean;
  onSelectEdge: (edgeId: string | null) => void;
  onDeleteEdge: (edgeId: string) => void;
  onHoverEdge: (edgeId: string | null) => void;
}

function resolveEdgeStrokeColor(isSelected: boolean, isActive: boolean): string {
  if (isSelected) return "var(--accent3)";

  if (isActive) return "var(--success)";

  return "var(--border-color)";
}

function WorkflowEdgeCutBadge({
  edgeId,
  midX,
  midY,
  isSelected,
  animationsEnabled,
  onDeleteEdge,
}: {
  edgeId: string;
  midX: number;
  midY: number;
  isSelected: boolean;
  animationsEnabled: boolean;
  onDeleteEdge: (edgeId: string) => void;
}) {
  const visibilityClass = isSelected
    ? "pointer-events-auto scale-100 opacity-100"
    : "pointer-events-none scale-95 opacity-0 group-hover/edge:pointer-events-auto group-hover/edge:scale-100 group-hover/edge:opacity-100";

  return (
    <foreignObject x={midX - 16} y={midY - 16} width={32} height={32} className="overflow-visible">
      <m.div
        initial={false}
        animate={animationsEnabled && isSelected ? { scale: 1.05 } : { scale: 1 }}
        transition={SPRING_BOUNCE}
        style={{ willChange: isSelected ? "transform" : undefined }}
        className={`flex size-8 items-center justify-center transition-[transform,opacity] duration-150 ease-out ${visibilityClass}`}
      >
        <button
          type="button"
          aria-label="قطع اتصال"
          title="قطع اتصال"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteEdge(edgeId);
          }}
          className="flex size-6 cursor-pointer items-center justify-center rounded-md border border-destructive/60 bg-card-bg-solid text-destructive shadow-lg transition-[transform,background-color,color] duration-150 ease-out hover:scale-110 hover:bg-destructive hover:text-destructive-foreground active:scale-[0.97]"
        >
          {isSelected ? (
            <X className="size-3.5" aria-hidden="true" />
          ) : (
            <Scissors className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </m.div>
    </foreignObject>
  );
}

/**
 * Renders a single Bezier connection wire with static cached signal rails and a hover-cut button.
 * Continuous signal particles run on a GPU-composited sibling overlay layer in `WorkflowWiresSvg`.
 */
export const WorkflowEdgeItem = React.memo(function WorkflowEdgeItem({
  edge,
  source,
  target,
  geometry,
  resolvedPortIdx,
  totalInPorts,
  isActive,
  isSelected,
  animationsEnabled,
  onSelectEdge,
  onDeleteEdge,
  onHoverEdge,
}: WorkflowEdgeItemProps) {
  if (!geometry) return null;

  const { path, midX, midY, startX, startY, endX, endY } = geometry;

  const strokeColor = resolveEdgeStrokeColor(isSelected, isActive);
  const highlighted = isActive || isSelected;
  const endpointFill = isActive ? "var(--success)" : "var(--card-bg-solid)";

  return (
    <g
      className="group/edge pointer-events-auto"
      onPointerEnter={() => onHoverEdge(edge.id)}
      onPointerLeave={() => onHoverEdge(null)}
    >
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

      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={6}
        strokeLinecap="round"
        className={`pointer-events-none transition-opacity duration-150 ${
          highlighted
            ? "opacity-20 group-hover/edge:stroke-destructive group-hover/edge:opacity-25"
            : "opacity-0 group-hover/edge:stroke-destructive group-hover/edge:opacity-25"
        }`}
      />

      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={highlighted ? 2.75 : 2}
        strokeOpacity={highlighted ? 0.96 : 0.72}
        strokeLinecap="round"
        className={`pointer-events-none transition-opacity duration-150 ${
          isSelected ? "" : "group-hover/edge:opacity-0"
        }`}
      />
      {!isSelected && (
        <path
          d={path}
          fill="none"
          stroke="var(--destructive)"
          strokeWidth={highlighted ? 2.75 : 2}
          strokeOpacity={highlighted ? 0.96 : 0.72}
          strokeDasharray="6 4"
          strokeLinecap="round"
          className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/edge:opacity-100"
        />
      )}

      {isActive && (
        <path
          d={path}
          fill="none"
          stroke="color-mix(in oklab, var(--success) 82%, white)"
          strokeWidth={2.25}
          strokeOpacity={0.55}
          strokeDasharray="6 10"
          strokeLinecap="round"
          className="pointer-events-none group-hover/edge:opacity-0"
        />
      )}

      <circle
        cx={startX}
        cy={startY}
        r={3.8}
        fill={endpointFill}
        stroke={strokeColor}
        strokeWidth={2}
        className="pointer-events-none"
      />
      <circle
        cx={endX}
        cy={endY}
        r={3.8}
        fill={endpointFill}
        stroke={strokeColor}
        strokeWidth={2}
        className="pointer-events-none"
      />
      <circle
        cx={startX}
        cy={startY}
        r={3.8}
        fill="none"
        stroke="var(--destructive)"
        strokeWidth={2}
        className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/edge:opacity-100"
      />
      <circle
        cx={endX}
        cy={endY}
        r={3.8}
        fill="none"
        stroke="var(--destructive)"
        strokeWidth={2}
        className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/edge:opacity-100"
      />

      <WorkflowEdgeCutBadge
        edgeId={edge.id}
        midX={midX}
        midY={midY}
        isSelected={isSelected}
        animationsEnabled={animationsEnabled}
        onDeleteEdge={onDeleteEdge}
      />
    </g>
  );
});

interface WorkflowDraftWireProps {
  draftAnchor: { x: number; y: number };
  connectingDraft: ConnectingWireDraft;
}

/**
 * Renders the temporary Bezier draft wire while connecting a node output port to a target input.
 */
export function WorkflowDraftWire({ draftAnchor, connectingDraft }: WorkflowDraftWireProps) {
  const draftBezier = buildWorkflowBezierPath(
    draftAnchor.x,
    draftAnchor.y,
    connectingDraft.pointerWorldX,
    connectingDraft.pointerWorldY,
  );

  const isDraftMagnetic = Boolean(connectingDraft.magneticTargetId);

  return (
    <g className="pointer-events-none">
      {isDraftMagnetic && (
        <path
          d={draftBezier.path}
          fill="none"
          stroke="var(--success)"
          strokeWidth={7}
          strokeOpacity={0.22}
          strokeLinecap="round"
        />
      )}

      <path
        d={draftBezier.path}
        fill="none"
        stroke={isDraftMagnetic ? "var(--success)" : "var(--accent3)"}
        strokeWidth={isDraftMagnetic ? 3 : 2.5}
        strokeDasharray={isDraftMagnetic ? "8 6" : "5 5"}
        strokeLinecap="round"
      />

      <circle
        cx={draftAnchor.x}
        cy={draftAnchor.y}
        r={4.5}
        fill={isDraftMagnetic ? "var(--success)" : "var(--accent3)"}
      />
      <circle
        cx={connectingDraft.pointerWorldX}
        cy={connectingDraft.pointerWorldY}
        r={isDraftMagnetic ? 5.5 : 4}
        fill={isDraftMagnetic ? "var(--success)" : "var(--card-bg-solid)"}
        stroke={
          isDraftMagnetic ? "color-mix(in oklab, var(--success) 45%, white)" : "var(--accent3)"
        }
        strokeWidth={2}
      />
    </g>
  );
}
