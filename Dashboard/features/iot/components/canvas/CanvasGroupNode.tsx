"use client";

import { GripHorizontal } from "lucide-react";
import { m } from "motion/react";
import React from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { getSegmentIcon, hasIcon, ICON_MAP } from "@/features/iot/utils/icons";
import { SPRING_MOUSE, SPRING_PANEL } from "@/lib/ease";
import CanvasGroupBody from "./CanvasGroupBody";
import CanvasResizeHandles from "./CanvasResizeHandles";
import type {
  CanvasGroupHandlers,
  CanvasNodeRect,
  CanvasResizeDirection,
  CanvasSubMode,
} from "./canvasTypes";
import NodePerimeterSpark from "./NodePerimeterSpark";

interface CanvasGroupNodeProps extends CanvasGroupHandlers {
  nodeId: string;
  groupName: string;
  groupSegments: Segment[];
  rect: CanvasNodeRect;
  subMode: CanvasSubMode;
  isSelected: boolean;
  isDragging?: boolean;
  dragTiltDeg?: number;
  isLocked: boolean;
  animationsEnabled: boolean;
  onSelect: (nodeId: string) => void;
  onStartDrag: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onStartResize: (
    nodeId: string,
    kind: "group" | "segment",
    direction: CanvasResizeDirection,
    e: React.PointerEvent<HTMLElement>,
  ) => void;
}

function resolveGroupBorderClass(
  isDragging: boolean,
  isSelected: boolean,
  activeCount: number,
): string {
  if (isDragging) return "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/40 shadow-2xl";
  if (isSelected) return "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/35 shadow-xl";
  if (activeCount > 0) return "border-[var(--accent3)]/65 shadow-md";
  return "border-[var(--border-color)] shadow-sm";
}

function renderGroupHeaderIcon(groupIcon?: string) {
  if (!groupIcon) {
    return React.createElement(ICON_MAP.Layers, { className: "h-4 w-4" });
  }

  if (hasIcon(groupIcon)) {
    return React.createElement(getSegmentIcon(groupIcon), { className: "h-4 w-4" });
  }

  return <span className="text-sm leading-none">{groupIcon}</span>;
}

function countGroupSegments(groupSegments: Segment[], pinsState: Record<string, boolean>) {
  let activeCount = 0;
  let controllableCount = 0;

  for (const seg of groupSegments) {
    if (seg.type !== "placeholder" && seg.pin) {
      if (seg.type !== "input") controllableCount += 1;
      if (pinsState[seg.pin]) activeCount += 1;
    }
  }

  return { activeCount, controllableCount };
}

function CanvasGroupGraphPort({
  active,
  animationsEnabled,
}: {
  active: boolean;
  animationsEnabled: boolean;
}) {
  return (
    <>
      <NodePerimeterSpark
        active={active}
        animationsEnabled={animationsEnabled}
        radius={24}
        color="var(--accent3)"
        speed="flow"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -left-2 z-30 h-4 w-4 -translate-y-1/2 rounded-full border-2 transition-colors ${
          active
            ? "border-[var(--accent3)] bg-[var(--accent3)] shadow-[0_0_10px_var(--accent3)]"
            : "border-[var(--border-color)] bg-[var(--card-bg-solid)]"
        }`}
      >
        {active && animationsEnabled && (
          <span
            aria-hidden="true"
            className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-full border border-[var(--accent3)]"
          />
        )}
      </div>
    </>
  );
}

interface CanvasGroupHeaderProps {
  nodeId: string;
  groupName: string;
  groupIcon?: string;
  segmentCount: number;
  activeCount: number;
  isLocked: boolean;
  isCompactContainer: boolean;
  onStartDrag: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onAddPlaceholder: (groupName: string) => void;
  onDeleteGroup: (groupName: string) => void;
}

function CanvasGroupHeader({
  nodeId,
  groupName,
  groupIcon,
  segmentCount,
  activeCount,
  isLocked,
  isCompactContainer,
  onStartDrag,
  onAddPlaceholder,
  onDeleteGroup,
}: CanvasGroupHeaderProps) {
  return (
    <div
      onPointerDown={(e) => {
        if (e.button === 0) onStartDrag(nodeId, e);
      }}
      style={{ touchAction: "none" }}
      className={`flex shrink-0 items-center justify-between gap-2 rounded-t-2xl border-b border-[var(--border-color)] bg-[var(--card-hover-bg)] px-4 py-2.5 ${
        isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <GripHorizontal
          className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
        <div
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-secondary)]"
        >
          {renderGroupHeaderIcon(groupIcon)}
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-sans text-xs font-medium text-[var(--text-primary)] sm:text-sm">
            {groupName}
          </h3>
          <span className="block text-[11px] font-normal tabular-nums text-[var(--text-muted)]">
            {segmentCount} قطعه · {activeCount} فعال
          </span>
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1"
        onPointerDown={(e) => {
          if (e.button !== 2) e.stopPropagation();
        }}
      >
        <button
          type="button"
          onClick={() => onAddPlaceholder(groupName)}
          aria-label={`افزودن قطعه به ${groupName}`}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] px-2 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--accent3)] hover:text-[var(--accent3-foreground)]"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {!isCompactContainer && <span>قطعه</span>}
        </button>

        <DeleteButton
          size="xs"
          left
          resetAfter={0}
          onConfirm={() => onDeleteGroup(groupName)}
          label={`حذف گروه ${groupName}`}
        />
      </div>
    </div>
  );
}

export default React.memo(function CanvasGroupNode({
  nodeId,
  groupName,
  groupSegments,
  rect,
  subMode,
  isSelected,
  isDragging = false,
  dragTiltDeg = 0,
  isLocked,
  animationsEnabled,
  onSelect,
  onStartDrag,
  onStartResize,
  onAddPlaceholder,
  onDeleteGroup,
  onRemoveSegment,
  onTogglePin,
  onSetPinState,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  onSetupPlaceholder,
}: CanvasGroupNodeProps) {
  const groupIcon = useIoTStore((s) => s.groupConfigs[groupName]?.icon);
  const pinsState = useIoTStore((s) => s.pinsState);

  const { activeCount, controllableCount } = countGroupSegments(groupSegments, pinsState);
  const borderClass = resolveGroupBorderClass(isDragging, isSelected, activeCount);
  const zIndex = isDragging ? 950 : isSelected ? 890 : rect.zIndex;

  const animateState = animationsEnabled
    ? {
        opacity: 1,
        scale: isDragging ? 1.016 : 1,
        rotate: isDragging ? dragTiltDeg : 0,
        y: isDragging ? -2 : 0,
      }
    : { opacity: 1, scale: 1, rotate: 0, y: 0 };

  return (
    <div
      data-canvas-node="true"
      dir="rtl"
      onPointerDown={(e) => {
        if (e.button !== 2) onSelect(nodeId);
      }}
      style={{
        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        width: rect.width,
        height: rect.height,
        zIndex,
      }}
      className="absolute top-0 left-0 select-none"
    >
      <m.div
        initial={animationsEnabled ? { opacity: 0, scale: 0.95, y: 8 } : false}
        animate={animateState}
        transition={isDragging ? SPRING_MOUSE : SPRING_PANEL}
        className={`relative flex h-full w-full flex-col rounded-2xl border bg-[var(--card-bg-solid)] text-right transition-[border-color,box-shadow] duration-150 ${borderClass}`}
      >
        {subMode === "graph" && (
          <CanvasGroupGraphPort active={activeCount > 0} animationsEnabled={animationsEnabled} />
        )}

        <CanvasGroupHeader
          nodeId={nodeId}
          groupName={groupName}
          groupIcon={groupIcon}
          segmentCount={groupSegments.length}
          activeCount={activeCount}
          isLocked={isLocked}
          isCompactContainer={rect.width < 320}
          onStartDrag={onStartDrag}
          onAddPlaceholder={onAddPlaceholder}
          onDeleteGroup={onDeleteGroup}
        />

        <CanvasGroupBody
          groupName={groupName}
          groupSegments={groupSegments}
          subMode={subMode}
          activeCount={activeCount}
          controllableCount={controllableCount}
          isCompactContainer={rect.width < 320}
          animationsEnabled={animationsEnabled}
          onAddPlaceholder={onAddPlaceholder}
          onRemoveSegment={onRemoveSegment}
          onTogglePin={onTogglePin}
          onSetPinState={onSetPinState}
          onUpdateSegmentMode={onUpdateSegmentMode}
          onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
          onSetupPlaceholder={onSetupPlaceholder}
        />

        {!isLocked && (
          <CanvasResizeHandles
            nodeId={nodeId}
            kind="group"
            ariaLabel={`تغییر اندازه گروه ${groupName}`}
            isSelected={isSelected}
            cornerRadiusClass="h-4 w-4 rounded-bl-[18px]"
            onStartResize={onStartResize}
          />
        )}
      </m.div>
    </div>
  );
});
