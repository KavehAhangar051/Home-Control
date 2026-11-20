"use client";

import { Play } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import React from "react";
import NodePerimeterSpark from "@/features/iot/components/canvas/NodePerimeterSpark";
import { resolveCanvasNodeMotionState } from "@/features/iot/components/canvas/nodeMotion";
import type { Segment } from "@/features/iot/hooks/store/types";
import { SPRING_MOUSE, SPRING_PANEL } from "@/lib/ease";
import {
  GroupNodeBody,
  LogicNodeBody,
  ScheduleNodeBody,
  SegmentNodeBody,
  TimerNodeBody,
} from "./WorkflowNodeBodies";
import WorkflowNodeHeader from "./WorkflowNodeHeader";
import WorkflowNodePorts, { type WorkflowInputPortSlot } from "./WorkflowNodePorts";
import {
  collectGroupMemberSegmentIds,
  getInputPortOffsetY,
  getNodeInputCount,
  getNodeMinInputCount,
  isTriggerWorkflowNodeKind,
} from "./workflowEngine";
import { WORKFLOW_PALETTE_MIME } from "./workflowPaletteData";
import type { WorkflowNode, WorkflowPaletteDragPayload } from "./workflowTypes";

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  segments: Segment[];
  pinsState: Record<string, boolean>;
  outputSignal: boolean;
  incomingCount: number;
  timerCountdown: number | null;
  isSelected: boolean;
  isDragging?: boolean;
  isLocked: boolean;
  animationsEnabled?: boolean;
  isConnectingSource: boolean;
  isMagneticTarget?: boolean;
  isConnectTargetHighlight: boolean;
  onSelect: (nodeId: string) => void;
  onStartDrag: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onStartResize: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onStartPortConnect: (nodeId: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  onCompletePortConnect: (
    targetNodeId: string,
    e: React.MouseEvent<HTMLButtonElement>,
    targetPortIndex?: number,
  ) => void;
  onTogglePin: (pin: string) => void;
  onTriggerManualPulse: (nodeId: string) => void;
  subflowChildCount?: number;
  onToggleSubflowGroup?: (nodeId: string) => void;
}

function resolveNodeBorderClass(
  isDragging: boolean,
  isSelected: boolean,
  isHighlighted: boolean,
  outputSignal: boolean,
): string {
  if (isDragging) return "border-accent3 ring-2 ring-accent3/40 shadow-2xl";

  if (isSelected) return "border-accent3 ring-2 ring-accent3/35 shadow-lg";

  if (isHighlighted) return "border-success ring-2 ring-success/40 shadow-lg";

  if (outputSignal) return "border-success/80 shadow-sm";

  return "border-border-color shadow-xs";
}

function resolveNodeMeta(node: WorkflowNode) {
  const hasInputPort = !isTriggerWorkflowNodeKind(node.kind);

  const isLogicGate =
    node.kind === "logic_and" || node.kind === "logic_or" || node.kind === "logic_not";

  return {
    hasInputPort,
    isLogicGate,
    minInputCount: getNodeMinInputCount(node.kind),
    inputCount: getNodeInputCount(node),
  };
}

function buildInputPortSlots(
  hasInputPort: boolean,
  inputCount: number,
  nodeId: string,
  nodeHeight: number,
): WorkflowInputPortSlot[] {
  if (!hasInputPort) return [];
  const slots: WorkflowInputPortSlot[] = [];

  for (let i = 0; i < inputCount; i += 1) {
    slots.push({
      key: `${nodeId}:in:${i}`,
      index: i,
      offsetY: getInputPortOffsetY(nodeHeight, i, inputCount),
    });
  }

  return slots;
}

function parseGroupSegmentDropId(raw: string): string | null {
  try {
    // SAFETY: Drag payload is serialized from WorkflowPaletteDragPayload
    const payload = JSON.parse(raw) as WorkflowPaletteDragPayload;

    return payload.kind === "segment" && payload.segmentId ? payload.segmentId : null;
  } catch {
    return null;
  }
}

interface WorkflowNodeBodyRouterProps {
  node: WorkflowNode;
  linkedSegment?: Segment;
  groupMemberSegments: Segment[];
  availableSegmentsForGroup: Segment[];
  pinsState: Record<string, boolean>;
  incomingCount: number;
  inputCount: number;
  minInputCount: number;
  outputSignal: boolean;
  timerCountdown: number | null;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onAddSegmentToGroup: (segmentId: string) => void;
  onRemoveSegmentFromGroup: (segmentId: string) => void;
  onSyncGroupFromModules: () => void;
  onTogglePin: (pin: string) => void;
  onChangeInputCount: (delta: number) => void;
  onTriggerManualPulse: (nodeId: string) => void;
}

function WorkflowNodeBodyRouter({
  node,
  linkedSegment,
  groupMemberSegments,
  availableSegmentsForGroup,
  pinsState,
  incomingCount,
  inputCount,
  minInputCount,
  outputSignal,
  timerCountdown,
  onUpdateNode,
  onAddSegmentToGroup,
  onRemoveSegmentFromGroup,
  onSyncGroupFromModules,
  onTogglePin,
  onChangeInputCount,
  onTriggerManualPulse,
}: WorkflowNodeBodyRouterProps) {
  switch (node.kind) {
    case "segment":
      return (
        <SegmentNodeBody
          node={node}
          linkedSegment={linkedSegment}
          isPinOn={Boolean(linkedSegment?.pin && pinsState[linkedSegment.pin])}
          onTogglePin={onTogglePin}
          onUpdateNode={onUpdateNode}
        />
      );
    case "group":
      return (
        <GroupNodeBody
          node={node}
          memberSegments={groupMemberSegments}
          availableSegments={availableSegmentsForGroup}
          pinsState={pinsState}
          onUpdateNode={onUpdateNode}
          onAddSegment={onAddSegmentToGroup}
          onRemoveSegment={onRemoveSegmentFromGroup}
          onSyncFromModules={onSyncGroupFromModules}
          onTogglePin={onTogglePin}
        />
      );
    case "logic_and":
    case "logic_or":
    case "logic_not":
      return (
        <LogicNodeBody
          kind={node.kind}
          incomingCount={incomingCount}
          inputCount={inputCount}
          minInputCount={minInputCount}
          outputSignal={outputSignal}
          onChangeInputCount={onChangeInputCount}
        />
      );
    case "timer":
      return (
        <TimerNodeBody node={node} timerCountdown={timerCountdown} onUpdateNode={onUpdateNode} />
      );
    case "trigger_manual":
      return (
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => onTriggerManualPulse(node.id)}
            className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-success px-3 text-xs font-bold text-success-foreground transition-colors hover:bg-success/90 active:scale-[0.98]"
          >
            <Play className="size-3.5" aria-hidden="true" />
            <span>ارسال پالس</span>
          </button>
        </div>
      );
    case "trigger_schedule":
      return <ScheduleNodeBody node={node} onUpdateNode={onUpdateNode} />;
  }
}

function WorkflowNodeResizeGrip({
  nodeId,
  label,
  isSelected,
  onStartResize,
}: {
  nodeId: string;
  label: string;
  isSelected: boolean;
  onStartResize: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`تغییر اندازه ${label}`}
      onPointerDown={(e) => {
        if (e.button === 0) onStartResize(nodeId, e);
      }}
      style={{ touchAction: "none" }}
      className="group/resize absolute -bottom-1 -left-1 z-30 size-7 cursor-nesw-resize"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-[6px] left-[6px] size-3.5 rounded-bl-[10px] border-b-2 border-l-2 transition-colors ${
          isSelected ? "border-accent3" : "border-text-muted/45 group-hover/resize:border-accent3"
        }`}
      />
    </button>
  );
}

function useWorkflowNodeSegments(
  segments: Segment[],
  node: WorkflowNode,
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void,
) {
  const segmentMap = React.useMemo(() => {
    const map = new Map<string, Segment>();

    for (const seg of segments) map.set(seg.id, seg);

    return map;
  }, [segments]);

  const memberIds = node.memberSegmentIds;

  const groupMemberSegments = React.useMemo(() => {
    const list: Segment[] = [];

    for (const id of memberIds ?? []) {
      const seg = segmentMap.get(id);

      if (seg && seg.type !== "placeholder") list.push(seg);
    }

    return list;
  }, [memberIds, segmentMap]);

  const availableSegmentsForGroup = React.useMemo(() => {
    const existingSet = new Set(memberIds ?? []);

    return segments.filter((seg) => seg.type !== "placeholder" && !existingSet.has(seg.id));
  }, [memberIds, segments]);

  const addSegmentToGroup = (segmentId: string) => {
    if (!segmentId) return;
    const current = memberIds ?? [];

    if (!current.includes(segmentId)) {
      onUpdateNode(node.id, { memberSegmentIds: [...current, segmentId] });
    }
  };

  const removeSegmentFromGroup = (segmentId: string) => {
    onUpdateNode(node.id, {
      memberSegmentIds: (memberIds ?? []).filter((id) => id !== segmentId),
    });
  };

  const syncGroupFromModules = () => {
    if (!node.groupName) return;
    onUpdateNode(node.id, {
      memberSegmentIds: collectGroupMemberSegmentIds(segments, node.groupName),
    });
  };

  return {
    linkedSegment: node.segmentId ? segmentMap.get(node.segmentId) : undefined,
    groupMemberSegments,
    availableSegmentsForGroup,
    addSegmentToGroup,
    removeSegmentFromGroup,
    syncGroupFromModules,
  };
}

export default React.memo(function WorkflowNodeCard({
  node,
  segments,
  pinsState,
  outputSignal,
  incomingCount,
  timerCountdown,
  isSelected,
  isDragging = false,
  isLocked,
  animationsEnabled = true,
  isConnectingSource,
  isMagneticTarget = false,
  isConnectTargetHighlight,
  onSelect,
  onStartDrag,
  onStartResize,
  onDeleteNode,
  onUpdateNode,
  onStartPortConnect,
  onCompletePortConnect,
  onTogglePin,
  onTriggerManualPulse,
}: WorkflowNodeCardProps) {
  const [isDragOverGroup, setIsDragOverGroup] = React.useState(false);
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimateMotion = animationsEnabled && !prefersReducedMotion;
  const { hasInputPort, isLogicGate, minInputCount, inputCount } = resolveNodeMeta(node);

  const {
    linkedSegment,
    groupMemberSegments,
    availableSegmentsForGroup,
    addSegmentToGroup,
    removeSegmentFromGroup,
    syncGroupFromModules,
  } = useWorkflowNodeSegments(segments, node, onUpdateNode);

  const handleChangeInputCount = (delta: number) => {
    const next = Math.max(minInputCount, Math.min(8, inputCount + delta));
    onUpdateNode(node.id, { inputCount: next });
  };

  const handleGroupDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (node.kind !== "group") return;
    const raw = e.dataTransfer.getData(WORKFLOW_PALETTE_MIME);

    if (!raw) return;

    const droppedSegmentId = parseGroupSegmentDropId(raw);
    setIsDragOverGroup(false);

    if (droppedSegmentId) {
      e.preventDefault();
      e.stopPropagation();
      addSegmentToGroup(droppedSegmentId);
    }
  };

  const borderClass = resolveNodeBorderClass(
    isDragging,
    isSelected,
    isDragOverGroup || isMagneticTarget,
    outputSignal,
  );

  const inputPortSlots = React.useMemo(
    () => buildInputPortSlots(hasInputPort, inputCount, node.id, node.height),
    [hasInputPort, inputCount, node.height, node.id],
  );

  return (
    <section
      aria-label={node.label}
      data-canvas-node="true"
      data-canvas-node-id={node.id}
      dir="rtl"
      onPointerDown={(e) => {
        if (e.button !== 2) onSelect(node.id);
      }}
      onDragOver={(e) => {
        if (node.kind === "group") {
          e.preventDefault();
          setIsDragOverGroup(true);
        }
      }}
      onDragLeave={() => setIsDragOverGroup(false)}
      onDrop={handleGroupDrop}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
        width: node.width,
        height: node.height,
        zIndex: isDragging ? 950 : isSelected ? 900 : node.zIndex,
        willChange: isDragging ? "transform" : undefined,
        transition:
          shouldAnimateMotion && !isDragging
            ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), width 220ms cubic-bezier(0.22, 1, 0.36, 1), height 220ms cubic-bezier(0.22, 1, 0.36, 1)"
            : undefined,
      }}
      className="absolute top-0 left-0 select-none"
    >
      <m.div
        data-canvas-node-motion="true"
        initial={shouldAnimateMotion ? { opacity: 0, scale: 0.95, y: 6 } : false}
        animate={resolveCanvasNodeMotionState(shouldAnimateMotion, isDragging, 0, 1.018)}
        transition={isDragging ? SPRING_MOUSE : SPRING_PANEL}
        className={`relative flex size-full flex-col rounded-2xl border bg-card-bg-solid text-right transition-[border-color,box-shadow] duration-150 ease-out ${borderClass}`}
      >
        <NodePerimeterSpark
          active={outputSignal}
          animationsEnabled={shouldAnimateMotion}
          radius={16}
          color="var(--success)"
          speed="flow"
        />

        <WorkflowNodePorts
          nodeId={node.id}
          nodeLabel={node.label}
          inputPortSlots={inputPortSlots}
          incomingCount={incomingCount}
          outputSignal={outputSignal}
          isConnectingSource={isConnectingSource}
          isMagneticTarget={isMagneticTarget}
          isConnectTargetHighlight={isConnectTargetHighlight}
          shouldAnimateMotion={shouldAnimateMotion}
          onStartPortConnect={onStartPortConnect}
          onCompletePortConnect={onCompletePortConnect}
        />

        <WorkflowNodeHeader
          node={node}
          isLocked={isLocked}
          isLogicGate={isLogicGate}
          hasInputPort={hasInputPort}
          isInputSegment={linkedSegment?.type === "input"}
          outputSignal={outputSignal}
          inputCount={inputCount}
          minInputCount={minInputCount}
          onStartDrag={onStartDrag}
          onChangeInputCount={handleChangeInputCount}
          onDeleteNode={onDeleteNode}
        />

        <div
          className="flex min-h-0 flex-1 flex-col justify-between gap-2 p-3 text-xs"
          onPointerDown={(e) => {
            if (e.button !== 2) e.stopPropagation();
          }}
        >
          <WorkflowNodeBodyRouter
            node={node}
            linkedSegment={linkedSegment}
            groupMemberSegments={groupMemberSegments}
            availableSegmentsForGroup={availableSegmentsForGroup}
            pinsState={pinsState}
            incomingCount={incomingCount}
            inputCount={inputCount}
            minInputCount={minInputCount}
            outputSignal={outputSignal}
            timerCountdown={timerCountdown}
            onUpdateNode={onUpdateNode}
            onAddSegmentToGroup={addSegmentToGroup}
            onRemoveSegmentFromGroup={removeSegmentFromGroup}
            onSyncGroupFromModules={syncGroupFromModules}
            onTogglePin={onTogglePin}
            onChangeInputCount={handleChangeInputCount}
            onTriggerManualPulse={onTriggerManualPulse}
          />
        </div>

        {!isLocked && (
          <WorkflowNodeResizeGrip
            nodeId={node.id}
            label={node.label}
            isSelected={isSelected}
            onStartResize={onStartResize}
          />
        )}
      </m.div>
    </section>
  );
});
