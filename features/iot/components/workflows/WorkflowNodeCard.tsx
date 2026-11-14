"use client";

import {
  Clock,
  Cpu,
  FolderPlus,
  GitBranch,
  GripHorizontal,
  Layers,
  Play,
  RefreshCw,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { m } from "motion/react";
import React from "react";
import NodePerimeterSpark from "@/features/iot/components/canvas/NodePerimeterSpark";
import type { Segment } from "@/features/iot/hooks/store/types";
import { getSegmentIcon } from "@/features/iot/utils/icons";
import { SPRING_BOUNCE, SPRING_MOUSE, SPRING_PANEL, SPRING_PRESS } from "@/lib/ease";
import { WORKFLOW_PALETTE_MIME } from "./WorkflowPalettePanel";
import type {
  WorkflowActionMode,
  WorkflowGroupEvalMode,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowPaletteDragPayload,
  WorkflowTimerMode,
} from "./workflowTypes";

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  segments: Segment[];
  pinsState: Record<string, boolean>;
  outputSignal: boolean;
  incomingCount: number;
  timerCountdown: number | null;
  isSelected: boolean;
  isDragging: boolean;
  dragTiltDeg: number;
  isLocked: boolean;
  isConnectingSource: boolean;
  isConnectTargetHighlight: boolean;
  isMagneticTarget: boolean;
  isRecentlyConnected: boolean;
  animationsEnabled: boolean;
  onSelect: (nodeId: string) => void;
  onStartDrag: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onStartResize: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onStartPortConnect: (nodeId: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  onCompletePortConnect: (targetNodeId: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  onTogglePin: (pin: string) => void;
  onTriggerManualPulse: (nodeId: string) => void;
}

const WEEKDAYS_PERSIAN = [
  { day: 6, label: "ش" },
  { day: 0, label: "ی" },
  { day: 1, label: "د" },
  { day: 2, label: "س" },
  { day: 3, label: "چ" },
  { day: 4, label: "پ" },
  { day: 5, label: "ج" },
] as const;

interface NodeKindMeta {
  badge: string;
  accentClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function getKindMeta(kind: WorkflowNodeKind): NodeKindMeta {
  switch (kind) {
    case "trigger_manual":
      return {
        badge: "شروع",
        accentClass: "text-emerald-500",
        Icon: Play,
      };
    case "trigger_schedule":
      return {
        badge: "زمان‌بندی",
        accentClass: "text-sky-500",
        Icon: Clock,
      };
    case "logic_and":
      return {
        badge: "AND",
        accentClass: "text-[var(--accent3)]",
        Icon: GitBranch,
      };
    case "logic_or":
      return {
        badge: "OR",
        accentClass: "text-amber-500",
        Icon: GitBranch,
      };
    case "logic_not":
      return {
        badge: "NOT",
        accentClass: "text-rose-500",
        Icon: GitBranch,
      };
    case "timer":
      return {
        badge: "تایمر",
        accentClass: "text-violet-500",
        Icon: Timer,
      };
    case "group":
      return {
        badge: "گروه",
        accentClass: "text-[var(--accent3)]",
        Icon: Layers,
      };
    case "segment":
      return {
        badge: "سگمنت",
        accentClass: "text-[var(--text-secondary)]",
        Icon: Cpu,
      };
  }
}

export default React.memo(function WorkflowNodeCard({
  node,
  segments,
  pinsState,
  outputSignal,
  incomingCount,
  timerCountdown,
  isSelected,
  isDragging,
  dragTiltDeg,
  isLocked,
  isConnectingSource,
  isConnectTargetHighlight,
  isMagneticTarget,
  isRecentlyConnected,
  animationsEnabled,
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

  const meta = getKindMeta(node.kind);
  const HeaderIcon = meta.Icon;
  const hasInputPort = node.kind !== "trigger_manual" && node.kind !== "trigger_schedule";

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
      if (seg.type !== "placeholder" && (seg.group || "Test") === node.groupName) {
        syncedIds.push(seg.id);
      }
    }

    onUpdateNode(node.id, { memberSegmentIds: syncedIds });
  };

  const handleGroupDrop = (e: React.DragEvent<HTMLElement>) => {
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
    : isMagneticTarget
      ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-xl"
      : isSelected
        ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/35 shadow-lg"
        : isDragOverGroup
          ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/45 shadow-lg"
          : outputSignal
            ? "border-emerald-500/80 shadow-md"
            : "border-[var(--border-color)] shadow-sm";

  const sparkActive = outputSignal || isRecentlyConnected || isMagneticTarget;
  const sparkColor = isMagneticTarget || outputSignal ? "#10b981" : "var(--accent3)";

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
        initial={animationsEnabled ? { opacity: 0, scale: 0.93, y: 8 } : false}
        animate={
          animationsEnabled
            ? {
                opacity: 1,
                scale: isDragging ? 1.022 : isMagneticTarget ? 1.012 : 1,
                rotate: isDragging ? dragTiltDeg : 0,
                y: isDragging ? -2 : 0,
              }
            : { opacity: 1, scale: 1, rotate: 0, y: 0 }
        }
        transition={isDragging ? SPRING_MOUSE : isMagneticTarget ? SPRING_BOUNCE : SPRING_PANEL}
        className={`relative flex h-full w-full flex-col rounded-2xl border bg-[var(--card-bg-solid)] text-right transition-[border-color,box-shadow] duration-150 ${borderClass}`}
      >
        <NodePerimeterSpark
          active={sparkActive}
          animationsEnabled={animationsEnabled}
          radius={16}
          color={sparkColor}
          speed={isRecentlyConnected || isMagneticTarget ? "pulse" : "flow"}
        />

        {/* Left Input Port (in) with Magnetic Wake-Up Ripple */}
        {hasInputPort && (
          <m.button
            type="button"
            data-workflow-port="in"
            data-node-id={node.id}
            aria-label={`پورت ورودی ${node.label}`}
            whileHover={animationsEnabled ? { scale: 1.24 } : undefined}
            whileTap={animationsEnabled ? { scale: 0.92 } : undefined}
            animate={
              animationsEnabled
                ? { scale: isMagneticTarget ? 1.32 : isRecentlyConnected ? 1.18 : 1 }
                : { scale: 1 }
            }
            transition={SPRING_PRESS}
            onPointerDown={(e) => {
              if (e.button !== 2) e.stopPropagation();
            }}
            onClick={(e) => onCompletePortConnect(node.id, e)}
            className={`absolute top-1/2 -left-2.5 z-30 flex h-5 w-5 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-md border-2 ${
              isMagneticTarget
                ? "border-emerald-300 bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.8)]"
                : isConnectTargetHighlight
                  ? "animate-pulse border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-md"
                  : incomingCount > 0
                    ? "border-[var(--accent3)] bg-[var(--card-bg-solid)]"
                    : "border-[var(--border-color)] bg-[var(--card-bg-solid)] hover:border-[var(--accent3)]"
            }`}
          >
            {isMagneticTarget && animationsEnabled && (
              <span
                aria-hidden="true"
                className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-md border-2 border-emerald-400"
              />
            )}
            <span className="h-1.5 w-1.5 rounded-[2px] bg-current opacity-85" />
          </m.button>
        )}

        {/* Right Output Port (out) */}
        <m.button
          type="button"
          data-workflow-port="out"
          data-node-id={node.id}
          aria-label={`پورت خروجی ${node.label}`}
          whileHover={animationsEnabled ? { scale: 1.24 } : undefined}
          whileTap={animationsEnabled ? { scale: 0.92 } : undefined}
          animate={animationsEnabled ? { scale: isConnectingSource ? 1.22 : 1 } : { scale: 1 }}
          transition={SPRING_PRESS}
          onPointerDown={(e) => onStartPortConnect(node.id, e)}
          className={`absolute top-1/2 -right-2.5 z-30 flex h-5 w-5 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-md border-2 ${
            isConnectingSource
              ? "border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-[0_0_12px_var(--accent3)]"
              : outputSignal
                ? "border-emerald-400 bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.55)]"
                : "border-[var(--border-color)] bg-[var(--card-bg-solid)] text-[var(--text-muted)] hover:border-[var(--accent3)]"
          }`}
        >
          {outputSignal && animationsEnabled && (
            <span
              aria-hidden="true"
              className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-md border border-emerald-400/80"
            />
          )}
          <span className="h-1.5 w-1.5 rounded-[2px] bg-current" />
        </m.button>

        {/* Node Header Bar */}
        <div
          onPointerDown={(e) => {
            if (e.button === 0) onStartDrag(node.id, e);
          }}
          style={{ touchAction: "none" }}
          className={`flex h-8 shrink-0 items-center justify-between gap-2 rounded-t-2xl border-b border-[var(--border-color)]/70 bg-[var(--secondary)]/70 px-3.5 ${
            isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          }`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <GripHorizontal
              className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <HeaderIcon className={`h-3.5 w-3.5 shrink-0 ${meta.accentClass}`} aria-hidden="true" />
            <span className="truncate text-[11px] font-bold text-[var(--text-primary)]">
              {node.label}
            </span>
          </div>

          <div
            className="flex shrink-0 items-center gap-1.5"
            onPointerDown={(e) => {
              if (e.button !== 2) e.stopPropagation();
            }}
          >
            <span
              className={`text-[10px] font-bold tabular-nums ${
                outputSignal ? "text-emerald-500" : "text-[var(--text-muted)]"
              }`}
            >
              {outputSignal ? "برقرار" : "قطع"}
            </span>

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
              outputSignal={outputSignal}
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
            <div className="flex flex-1 flex-col justify-between gap-2">
              <p className="text-[11px] leading-5 text-[var(--text-secondary)]">
                با زدن دکمه زیر، سیگنال لحظه‌ای به گره‌های متصل ارسال می‌شود.
              </p>
              <button
                type="button"
                onClick={() => onTriggerManualPulse(node.id)}
                className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-500 active:scale-[0.98]"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>اجرای این شاخه</span>
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

interface SegmentNodeBodyProps {
  node: WorkflowNode;
  linkedSegment: Segment | undefined;
  isPinOn: boolean;
  onTogglePin: (pin: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}

function SegmentNodeBody({
  node,
  linkedSegment,
  isPinOn,
  onTogglePin,
  onUpdateNode,
}: SegmentNodeBodyProps) {
  if (!linkedSegment) {
    return (
      <div className="flex flex-1 items-center justify-center text-center text-[11px] text-[var(--text-muted)]">
        این سگمنت از پالایه حذف شده است.
      </div>
    );
  }

  const SegIcon = getSegmentIcon(linkedSegment.icon);
  const actionMode = node.actionMode ?? "turn_on";

  return (
    <div className="flex flex-1 flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              isPinOn
                ? "border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)]"
                : "border-[var(--border-color)] bg-[var(--secondary)] text-[var(--text-secondary)]"
            }`}
          >
            <SegIcon className="h-4 w-4" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-[var(--text-primary)]">
              {linkedSegment.title}
            </div>
            <div className="truncate text-[10px] tabular-nums text-[var(--text-muted)]">
              {linkedSegment.group || "Test"} · پایه {linkedSegment.pin}
            </div>
          </div>
        </div>

        {linkedSegment.type !== "input" && (
          <button
            type="button"
            onClick={() => onTogglePin(linkedSegment.pin)}
            aria-label={`تغییر وضعیت ${linkedSegment.title}`}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-start rounded-[7px] p-0.5 transition-colors ${
              isPinOn
                ? "border border-transparent bg-[var(--accent3)]"
                : "border border-[var(--border-color)] bg-[var(--input)]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-[14px] w-[14px] rounded-[4px] bg-white shadow-xs transition-transform duration-200 ${
                isPinOn ? "translate-x-0" : "-translate-x-4"
              }`}
            />
          </button>
        )}
      </div>

      {linkedSegment.type === "input" ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
          ورودی سنسور · وضعیت فعلی: {isPinOn ? "فعال (۱)" : "غیرفعال (۰)"}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">فرمان ورودی:</span>
          <select
            aria-label="عملکرد سگمنت هنگام دریافت سیگنال"
            value={actionMode}
            onChange={(e) => {
              // SAFETY: select options correspond strictly to WorkflowActionMode
              const val = e.target.value as WorkflowActionMode;
              onUpdateNode(node.id, { actionMode: val });
            }}
            className="h-7 min-w-0 flex-1 cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-[10px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
          >
            <option value="turn_on">روشن کردن (ON)</option>
            <option value="turn_off">خاموش کردن (OFF)</option>
            <option value="toggle">تغییر وضعیت (Toggle)</option>
            <option value="condition_only">فقط شرط / ورودی</option>
          </select>
        </div>
      )}
    </div>
  );
}

interface GroupNodeBodyProps {
  node: WorkflowNode;
  memberSegments: Segment[];
  availableSegments: Segment[];
  pinsState: Record<string, boolean>;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onAddSegment: (segmentId: string) => void;
  onRemoveSegment: (segmentId: string) => void;
  onSyncFromModules: () => void;
  onTogglePin: (pin: string) => void;
}

function GroupNodeBody({
  node,
  memberSegments,
  availableSegments,
  pinsState,
  onUpdateNode,
  onAddSegment,
  onRemoveSegment,
  onSyncFromModules,
  onTogglePin,
}: GroupNodeBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Custom Group Name or Module Group Sync */}
      <div className="flex items-center justify-between gap-1.5">
        {node.isCustomGroup ? (
          <input
            type="text"
            value={node.label}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
            aria-label="نام گروه سفارشی"
            placeholder="نام گروه..."
            className="h-7 min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border border-[var(--border-color)]/70 bg-[var(--bg-main)]/70 px-2 py-1">
            <span className="truncate text-[10px] font-semibold text-[var(--text-secondary)]">
              گروه پالایه: {node.groupName} ({memberSegments.length})
            </span>
            <button
              type="button"
              onClick={onSyncFromModules}
              title="همگام‌سازی با پالایه و ماژول‌ها"
              aria-label="همگام‌سازی سگمنت‌ها از پالایه"
              className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--accent3)]"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Member Segments List inside Group */}
      <div
        data-canvas-scroll-area="true"
        className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-color)]/70 bg-[var(--bg-main)]/45 p-1.5"
      >
        {memberSegments.length === 0 ? (
          <div className="flex h-full min-h-[64px] flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-[var(--text-muted)]">
            <FolderPlus className="h-4 w-4 opacity-60" aria-hidden="true" />
            <span>خالی است · سگمنت اضافه کنید یا از پنل بکشید</span>
          </div>
        ) : (
          memberSegments.map((seg) => {
            const SegIcon = getSegmentIcon(seg.icon);
            const isOn = Boolean(seg.pin && pinsState[seg.pin]);

            return (
              <div
                key={seg.id}
                className="flex items-center justify-between gap-1.5 rounded-md border border-[var(--border-color)]/60 bg-[var(--card-bg-solid)] px-2 py-1"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <SegIcon
                    className={`h-3.5 w-3.5 shrink-0 ${isOn ? "text-[var(--accent3)]" : "text-[var(--text-muted)]"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
                    {seg.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {seg.type !== "input" && (
                    <button
                      type="button"
                      onClick={() => onTogglePin(seg.pin)}
                      aria-label={`تغییر ${seg.title}`}
                      className={`cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                        isOn
                          ? "bg-[var(--accent3)] text-[var(--accent3-foreground)]"
                          : "bg-[var(--secondary)] text-[var(--text-muted)]"
                      }`}
                    >
                      {isOn ? "روشن" : "خاموش"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveSegment(seg.id)}
                    aria-label={`حذف ${seg.title} از گروه`}
                    className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-red-500/15 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Segment Picker + Evaluation / Action Selectors */}
      <div className="shrink-0 space-y-1.5">
        {availableSegments.length > 0 && (
          <select
            aria-label="افزودن سگمنت به گروه"
            value=""
            onChange={(e) => onAddSegment(e.target.value)}
            className="h-7 w-full cursor-pointer rounded-lg border border-dashed border-[var(--accent3)]/50 bg-[var(--bg-main)] px-2 text-[10px] font-semibold text-[var(--accent3)] outline-none focus:border-[var(--accent3)]"
          >
            <option value="">+ افزودن سگمنت به این گروه...</option>
            {availableSegments.map((seg) => (
              <option key={seg.id} value={seg.id}>
                {seg.title} (پایه {seg.pin})
              </option>
            ))}
          </select>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <select
            aria-label="شرط خروجی گروه"
            value={node.groupEvalMode ?? "any_on"}
            onChange={(e) => {
              // SAFETY: options are strictly WorkflowGroupEvalMode
              const val = e.target.value as WorkflowGroupEvalMode;
              onUpdateNode(node.id, { groupEvalMode: val });
            }}
            className="h-6 cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
          >
            <option value="any_on">شرط: حداقل یکی روشن</option>
            <option value="all_on">شرط: همه روشن</option>
          </select>

          <select
            aria-label="فرمان ورودی گروه"
            value={node.actionMode ?? "turn_on"}
            onChange={(e) => {
              // SAFETY: options are strictly WorkflowActionMode
              const val = e.target.value as WorkflowActionMode;
              onUpdateNode(node.id, { actionMode: val });
            }}
            className="h-6 cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
          >
            <option value="turn_on">فرمان: روشن همه</option>
            <option value="turn_off">فرمان: خاموش همه</option>
            <option value="condition_only">فقط شرط گروه</option>
          </select>
        </div>
      </div>
    </div>
  );
}

interface LogicNodeBodyProps {
  kind: "logic_and" | "logic_or" | "logic_not";
  incomingCount: number;
  outputSignal: boolean;
}

function LogicNodeBody({ kind, incomingCount, outputSignal }: LogicNodeBodyProps) {
  const symbol = kind === "logic_and" ? "AND" : kind === "logic_or" ? "OR" : "NOT";

  const ruleText =
    kind === "logic_and"
      ? "وقتی همه ورودی‌ها برقرار باشند"
      : kind === "logic_or"
        ? "وقتی حداقل یک ورودی برقرار باشد"
        : "خروجی را برعکس می‌کند";

  return (
    <div className="flex flex-1 flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span
          dir="ltr"
          className="inline-flex h-8 items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 font-mono text-xs font-bold text-[var(--text-primary)]"
        >
          {symbol}
        </span>

        <span className="text-[11px] font-semibold tabular-nums text-[var(--text-secondary)]">
          {incomingCount} ورودی متصل
        </span>
      </div>

      <p className="text-[10px] leading-4 text-[var(--text-muted)]">
        {ruleText} · نتیجه: {outputSignal ? "فعال (۱)" : "غیرفعال (۰)"}
      </p>
    </div>
  );
}

interface TimerNodeBodyProps {
  node: WorkflowNode;
  timerCountdown: number | null;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}

function TimerNodeBody({ node, timerCountdown, onUpdateNode }: TimerNodeBodyProps) {
  const seconds = node.timerSeconds ?? 5;
  const mode = node.timerMode ?? "delay";

  return (
    <div className="flex flex-1 flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">مدت (ثانیه):</span>
        <input
          type="number"
          min={1}
          max={3600}
          value={seconds}
          onChange={(e) => {
            const val = Math.max(1, Math.min(3600, Number(e.target.value) || 1));
            onUpdateNode(node.id, { timerSeconds: val });
          }}
          dir="ltr"
          aria-label="مدت زمان تایمر به ثانیه"
          className="h-7 w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-center font-mono text-xs font-bold tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
        />
      </div>

      <div className="grid grid-cols-4 gap-1" dir="ltr">
        {[5, 10, 30, 60].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onUpdateNode(node.id, { timerSeconds: preset })}
            className={`h-6 cursor-pointer rounded-md border text-[10px] font-bold tabular-nums transition-colors ${
              seconds === preset
                ? "border-[var(--accent3)] bg-[var(--accent3-transparent)] text-[var(--accent3)]"
                : "border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {preset}s
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <select
          aria-label="حالت تایمر"
          value={mode}
          onChange={(e) => {
            // SAFETY: options are strictly WorkflowTimerMode
            const val = e.target.value as WorkflowTimerMode;
            onUpdateNode(node.id, { timerMode: val });
          }}
          className="h-7 min-w-0 flex-1 cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 text-[10px] font-semibold text-[var(--text-primary)] outline-none"
        >
          <option value="delay">تاخیر قبل از ارسال</option>
          <option value="hold">نگه‌داشتن زمان‌دار</option>
        </select>

        {timerCountdown !== null && (
          <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-violet-500">
            {timerCountdown}s
          </span>
        )}
      </div>
    </div>
  );
}

interface ScheduleNodeBodyProps {
  node: WorkflowNode;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}

function ScheduleNodeBody({ node, onUpdateNode }: ScheduleNodeBodyProps) {
  const days = node.scheduleDays ?? [];

  const toggleDay = (dayVal: number) => {
    const exists = days.includes(dayVal);
    const next: number[] = [];

    if (exists) {
      for (const d of days) {
        if (d !== dayVal) next.push(d);
      }
    } else {
      next.push(...days, dayVal);
    }

    onUpdateNode(node.id, { scheduleDays: next });
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">ساعت اجرا:</span>
        <input
          type="time"
          value={node.scheduleTime ?? "08:00"}
          onChange={(e) => onUpdateNode(node.id, { scheduleTime: e.target.value })}
          dir="ltr"
          aria-label="ساعت اجرای زمان‌بندی"
          className="h-7 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 font-mono text-xs font-bold tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
        />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_PERSIAN.map((item) => {
          const isOn = days.includes(item.day);

          return (
            <button
              key={item.day}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggleDay(item.day)}
              className={`h-6 cursor-pointer rounded-md border text-[10px] font-bold transition-colors ${
                isOn
                  ? "border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)]"
                  : "border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
