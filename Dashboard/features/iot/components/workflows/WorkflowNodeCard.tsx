"use client";

import { GripHorizontal, Minus, Play, Plus, Trash2 } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import React from "react";
import NodePerimeterSpark from "@/features/iot/components/canvas/NodePerimeterSpark";
import type { Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import { SPRING_MOUSE, SPRING_PANEL } from "@/lib/ease";
import {
  GroupNodeBody,
  LogicNodeBody,
  ScheduleNodeBody,
  SegmentNodeBody,
  TimerNodeBody,
} from "./WorkflowNodeBodies";
import { WORKFLOW_PALETTE_MIME } from "./WorkflowPalettePanel";
import { WorkflowSchematicSymbol } from "./WorkflowSchematicSymbols";
import { getInputPortOffsetY, getNodeInputCount, getNodeMinInputCount } from "./workflowEngine";
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
  dragTiltDeg?: number;
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
  dragTiltDeg = 0,
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

  const hasInputPort = node.kind !== "trigger_manual" && node.kind !== "trigger_schedule";

  const isLogicGate =
    node.kind === "logic_and" || node.kind === "logic_or" || node.kind === "logic_not";

  const minInputCount = getNodeMinInputCount(node.kind);
  const inputCount = getNodeInputCount(node);

  const handleChangeInputCount = (delta: number) => {
    const next = Math.max(minInputCount, Math.min(8, inputCount + delta));
    onUpdateNode(node.id, { inputCount: next });
  };

  const segmentMap = React.useMemo(() => {
    const map = new Map<string, Segment>();

    for (const seg of segments) {
      map.set(seg.id, seg);
    }

    return map;
  }, [segments]);

  const linkedSegment = node.segmentId ? segmentMap.get(node.segmentId) : undefined;

  const groupMemberSegments = React.useMemo(() => {
    const list: Segment[] = [];

    for (const id of node.memberSegmentIds ?? []) {
      const seg = segmentMap.get(id);

      if (seg && seg.type !== "placeholder") {
        list.push(seg);
      }
    }

    return list;
  }, [node.memberSegmentIds, segmentMap]);

  const availableSegmentsForGroup = React.useMemo(() => {
    const existingSet = new Set(node.memberSegmentIds ?? []);
    const list: Segment[] = [];

    for (const seg of segments) {
      if (seg.type !== "placeholder" && !existingSet.has(seg.id)) {
        list.push(seg);
      }
    }

    return list;
  }, [node.memberSegmentIds, segments]);

  const handleAddSegmentToGroup = (segmentId: string) => {
    if (!segmentId) return;

    const current = node.memberSegmentIds ?? [];

    if (current.includes(segmentId)) return;

    onUpdateNode(node.id, { memberSegmentIds: [...current, segmentId] });
  };

  const handleRemoveSegmentFromGroup = (segmentId: string) => {
    const next: string[] = [];

    for (const id of node.memberSegmentIds ?? []) {
      if (id !== segmentId) next.push(id);
    }

    onUpdateNode(node.id, { memberSegmentIds: next });
  };

  const handleSyncGroupFromModules = () => {
    if (!node.groupName) return;

    const syncedIds: string[] = [];

    for (const seg of segments) {
      if (seg.type !== "placeholder" && resolveSegmentGroup(seg.group) === node.groupName) {
        syncedIds.push(seg.id);
      }
    }

    onUpdateNode(node.id, { memberSegmentIds: syncedIds });
  };

  const handleGroupDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (node.kind !== "group") return;

    const raw = e.dataTransfer.getData(WORKFLOW_PALETTE_MIME);

    if (!raw) return;

    try {
      // SAFETY: Drag payload is serialized from WorkflowPaletteDragPayload
      const payload = JSON.parse(raw) as WorkflowPaletteDragPayload;

      if (payload.kind === "segment" && payload.segmentId) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverGroup(false);
        handleAddSegmentToGroup(payload.segmentId);
      }
    } catch {
      setIsDragOverGroup(false);
    }
  };

  const borderClass = isDragging
    ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/40 shadow-2xl"
    : isSelected
      ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/35 shadow-lg"
      : isDragOverGroup || isMagneticTarget
        ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg"
        : outputSignal
          ? "border-emerald-500/80 shadow-md"
          : "border-[var(--border-color)] shadow-sm";

  const inputPortSlots = React.useMemo(() => {
    if (!hasInputPort) return [];

    const slots: Array<{ key: string; index: number; offsetY: number }> = [];

    for (let i = 0; i < inputCount; i += 1) {
      slots.push({
        key: `${node.id}:in:${i}`,
        index: i,
        offsetY: getInputPortOffsetY(node.height, i, inputCount),
      });
    }

    return slots;
  }, [hasInputPort, inputCount, node.height, node.id]);

  return (
    <section
      aria-label={node.label}
      data-canvas-node="true"
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
      }}
      className="absolute top-0 left-0 select-none"
    >
      <m.div
        initial={shouldAnimateMotion ? { opacity: 0, scale: 0.95, y: 6 } : false}
        animate={
          shouldAnimateMotion
            ? {
                opacity: 1,
                scale: isDragging ? 1.018 : 1,
                rotate: isDragging ? dragTiltDeg : 0,
                y: isDragging ? -2 : 0,
              }
            : { opacity: 1, scale: 1, rotate: 0, y: 0 }
        }
        transition={isDragging ? SPRING_MOUSE : SPRING_PANEL}
        className={`relative flex h-full w-full flex-col rounded-2xl border bg-[var(--card-bg-solid)] text-right transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)] ${borderClass}`}
      >
        <NodePerimeterSpark
          active={outputSignal}
          animationsEnabled={shouldAnimateMotion}
          radius={16}
          color="#10b981"
          speed="flow"
        />

        {/* Left Input Ports (in) */}
        {inputPortSlots.map((slot) => {
          const isPortConnected = slot.index < incomingCount;

          return (
            <button
              key={slot.key}
              type="button"
              data-workflow-port="in"
              data-node-id={node.id}
              data-port-index={slot.index}
              aria-label={`پورت ورودی ${slot.index + 1} ${node.label}`}
              onPointerDown={(e) => {
                if (e.button !== 2) e.stopPropagation();
              }}
              onClick={(e) => onCompletePortConnect(node.id, e, slot.index)}
              style={{ top: `${slot.offsetY}px` }}
              className={`absolute -left-2.5 z-30 flex h-4.5 w-4.5 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-md border-2 transition-[transform,border-color,background-color] duration-150 ease-[var(--ease-out)] hover:scale-115 active:scale-95 ${
                isMagneticTarget
                  ? "scale-120 border-emerald-400 bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.65)]"
                  : isConnectTargetHighlight
                    ? "animate-pulse border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-md"
                    : isPortConnected
                      ? "border-[var(--accent3)] bg-[var(--card-bg-solid)]"
                      : "border-[var(--border-color)] bg-[var(--card-bg-solid)] hover:border-[var(--accent3)]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-[2px] bg-current opacity-80" />
              {isMagneticTarget && shouldAnimateMotion && (
                <span
                  aria-hidden="true"
                  className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-md border border-emerald-400"
                />
              )}
            </button>
          );
        })}

        {/* Right Output Port (out) */}
        <button
          type="button"
          data-workflow-port="out"
          data-node-id={node.id}
          aria-label={`پورت خروجی ${node.label}`}
          onPointerDown={(e) => onStartPortConnect(node.id, e)}
          className={`absolute top-1/2 -right-2.5 z-30 flex h-5 w-5 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-md border-2 transition-[transform,border-color,background-color] duration-150 ease-[var(--ease-out)] hover:scale-115 active:scale-95 ${
            isConnectingSource
              ? "scale-115 border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-md"
              : outputSignal
                ? "border-emerald-400 bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "border-[var(--border-color)] bg-[var(--card-bg-solid)] text-[var(--text-muted)] hover:border-[var(--accent3)]"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-[2px] bg-current" />
          {outputSignal && shouldAnimateMotion && (
            <span
              aria-hidden="true"
              className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-md border border-emerald-400"
            />
          )}
        </button>

        {/* Node Header Bar */}
        <div
          onPointerDown={(e) => {
            if (e.button === 0) onStartDrag(node.id, e);
          }}
          style={{ touchAction: "none" }}
          className={`flex h-8 shrink-0 items-center justify-between gap-2 rounded-t-2xl border-b border-[var(--border-color)]/70 bg-[var(--secondary)]/70 px-3 ${
            isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          }`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <GripHorizontal
              className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            {!isLogicGate && (
              <span
                dir="ltr"
                className={`inline-flex shrink-0 items-center ${
                  outputSignal ? "text-emerald-500" : "text-[var(--text-secondary)]"
                }`}
              >
                <WorkflowSchematicSymbol
                  kind={node.kind}
                  isCustomGroup={node.isCustomGroup}
                  isInputSegment={linkedSegment?.type === "input"}
                  className="h-4 w-7"
                />
              </span>
            )}
            <span
              dir={isLogicGate ? "ltr" : undefined}
              className={`truncate text-[11px] font-bold text-[var(--text-primary)] ${
                isLogicGate ? "font-mono" : ""
              }`}
            >
              {node.label}
            </span>
          </div>

          <div
            className="flex shrink-0 items-center gap-1"
            onPointerDown={(e) => {
              if (e.button !== 2) e.stopPropagation();
            }}
          >
            {hasInputPort && !isLogicGate && (
              <div
                dir="ltr"
                className="flex items-center gap-0.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-1 py-0.5 text-[10px]"
                title="تعداد ورودی‌ها"
              >
                <button
                  type="button"
                  disabled={inputCount <= minInputCount}
                  onClick={() => handleChangeInputCount(-1)}
                  aria-label="کاهش تعداد ورودی"
                  className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
                <span className="min-w-[14px] text-center font-mono text-[10px] font-bold tabular-nums text-[var(--text-primary)]">
                  {inputCount}
                </span>
                <button
                  type="button"
                  disabled={inputCount >= 8}
                  onClick={() => handleChangeInputCount(1)}
                  aria-label="افزایش تعداد ورودی"
                  className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Plus className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => onDeleteNode(node.id)}
              aria-label={`حذف گره ${node.label}`}
              className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-red-500/15 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Node Body by Kind */}
        <div
          className="flex min-h-0 flex-1 flex-col justify-between gap-2 p-3 text-xs"
          onPointerDown={(e) => {
            if (e.button !== 2) e.stopPropagation();
          }}
        >
          {node.kind === "segment" && (
            <SegmentNodeBody
              node={node}
              linkedSegment={linkedSegment}
              isPinOn={Boolean(linkedSegment?.pin && pinsState[linkedSegment.pin])}
              onTogglePin={onTogglePin}
              onUpdateNode={onUpdateNode}
            />
          )}

          {node.kind === "group" && (
            <GroupNodeBody
              node={node}
              memberSegments={groupMemberSegments}
              availableSegments={availableSegmentsForGroup}
              pinsState={pinsState}
              onUpdateNode={onUpdateNode}
              onAddSegment={handleAddSegmentToGroup}
              onRemoveSegment={handleRemoveSegmentFromGroup}
              onSyncFromModules={handleSyncGroupFromModules}
              onTogglePin={onTogglePin}
            />
          )}

          {(node.kind === "logic_and" || node.kind === "logic_or" || node.kind === "logic_not") && (
            <LogicNodeBody
              kind={node.kind}
              incomingCount={incomingCount}
              inputCount={inputCount}
              minInputCount={minInputCount}
              outputSignal={outputSignal}
              onChangeInputCount={handleChangeInputCount}
            />
          )}

          {node.kind === "timer" && (
            <TimerNodeBody
              node={node}
              timerCountdown={timerCountdown}
              onUpdateNode={onUpdateNode}
            />
          )}

          {node.kind === "trigger_manual" && (
            <div className="flex flex-1 items-center justify-center">
              <button
                type="button"
                onClick={() => onTriggerManualPulse(node.id)}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-500 active:scale-[0.98]"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>ارسال پالس</span>
              </button>
            </div>
          )}

          {node.kind === "trigger_schedule" && (
            <ScheduleNodeBody node={node} onUpdateNode={onUpdateNode} />
          )}
        </div>

        {/* Concentric Bottom-Left Resize Grip */}
        {!isLocked && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`تغییر اندازه ${node.label}`}
            onPointerDown={(e) => {
              if (e.button === 0) onStartResize(node.id, e);
            }}
            style={{ touchAction: "none" }}
            className="group/resize absolute -bottom-1 -left-1 z-30 h-7 w-7 cursor-nesw-resize"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute bottom-[6px] left-[6px] h-3.5 w-3.5 rounded-bl-[10px] border-b-2 border-l-2 transition-colors ${
                isSelected
                  ? "border-[var(--accent3)]"
                  : "border-[var(--text-muted)]/45 group-hover/resize:border-[var(--accent3)]"
              }`}
            />
          </button>
        )}
      </m.div>
    </section>
  );
});
