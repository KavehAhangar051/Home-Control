"use client";

import { Scissors, X } from "lucide-react";
import * as m from "motion/react-m";
import React from "react";
import { SPRING_BOUNCE } from "@/lib/ease";
import type { ConnectingWireDraft } from "./useWorkflowStudio";
import { buildWorkflowBezierPath, getPortAnchor } from "./workflowEngine";
import type { WorkflowEdge, WorkflowNode } from "./workflowTypes";

interface WorkflowEdgeItemProps {
  edge: WorkflowEdge;
  source: WorkflowNode;
  target: WorkflowNode;
  resolvedPortIdx: number;
  totalInPorts: number;
  isActive: boolean;
  isSelected: boolean;
  animationsEnabled: boolean;
  onSelectEdge: (edgeId: string | null) => void;
  onDeleteEdge: (edgeId: string) => void;
}

function resolveEdgeStrokeColor(isSelected: boolean, isActive: boolean): string {
  if (isSelected) return "var(--accent3)";
  if (isActive) return "#10b981";
  return "var(--border-color)";
}

function WorkflowEdgeSignalParticles({ path }: { path: string }) {
  return (
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
      <circle r={2.5} fill="#a7f3d0" className="pointer-events-none group-hover/edge:opacity-0">
        <animateMotion dur="1.25s" repeatCount="indefinite" path={path} />
      </circle>
    </>
  );
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
 * Renders a single Bezier connection wire with active signal pulses and a hover-cut button.
 */
export const WorkflowEdgeItem = React.memo(function WorkflowEdgeItem({
  edge,
  source,
  target,
  resolvedPortIdx,
  totalInPorts,
  isActive,
  isSelected,
  animationsEnabled,
  onSelectEdge,
  onDeleteEdge,
}: WorkflowEdgeItemProps) {
  const start = getPortAnchor(source, "out");
  const end = getPortAnchor(target, "in", resolvedPortIdx, totalInPorts);
  const { path, midX, midY } = buildWorkflowBezierPath(start.x, start.y, end.x, end.y);

  const strokeColor = resolveEdgeStrokeColor(isSelected, isActive);
  const highlighted = isActive || isSelected;
  const endpointFill = isActive ? "#10b981" : "var(--card-bg-solid)";

  return (
    <g className="group/edge pointer-events-auto">
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
        className={`pointer-events-none transition-[stroke,stroke-opacity] duration-150 ${
          isSelected
            ? ""
            : "group-hover/edge:stroke-destructive group-hover/edge:[stroke-dasharray:6_4]"
        }`}
      />

      {isActive && animationsEnabled && <WorkflowEdgeSignalParticles path={path} />}

      <circle
        cx={start.x}
        cy={start.y}
        r={3.8}
        fill={endpointFill}
        stroke={strokeColor}
        strokeWidth={2}
        className="pointer-events-none transition-colors group-hover/edge:stroke-destructive"
      />
      <circle
        cx={end.x}
        cy={end.y}
        r={3.8}
        fill={endpointFill}
        stroke={strokeColor}
        strokeWidth={2}
        className="pointer-events-none transition-colors group-hover/edge:stroke-destructive"
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
  animationsEnabled: boolean;
}

/**
 * Renders the temporary Bezier draft wire while connecting a node output port to a target input.
 */
export function WorkflowDraftWire({
  draftAnchor,
  connectingDraft,
  animationsEnabled,
}: WorkflowDraftWireProps) {
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
  );
}
