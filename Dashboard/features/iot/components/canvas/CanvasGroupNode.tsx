"use client";

import { GripHorizontal } from "lucide-react";
import { m } from "motion/react";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
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
import { resolveCanvasNodeMotionState } from "./nodeMotion";

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
  if (isDragging) return "border-accent3 ring-2 ring-accent3/40 shadow-2xl";

  if (isSelected) return "border-accent3 ring-2 ring-accent3/35 shadow-xl";

  if (activeCount > 0) return "border-accent3/65 shadow-sm";

  return "border-border-color shadow-xs";
}

function renderGroupHeaderIcon(groupIcon?: string) {
  if (!groupIcon) {
    return React.createElement(ICON_MAP.Layers, { className: "size-4" });
  }

  if (hasIcon(groupIcon)) {
    return React.createElement(getSegmentIcon(groupIcon), { className: "size-4" });
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
        className={`pointer-events-none absolute top-1/2 -left-2 z-30 size-4 -translate-y-1/2 rounded-full border-2 transition-colors ${
          active
            ? "border-accent3 bg-accent3 shadow-[0_0_10px_var(--accent3)]"
            : "border-border-color bg-card-bg-solid"
        }`}
      >
        {active && animationsEnabled && (
          <span
            aria-hidden="true"
            className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-full border border-accent3"
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
      className={`flex shrink-0 items-center justify-between gap-2 rounded-t-2xl border-b border-border-color bg-card-hover-bg px-4 py-2.5 ${
        isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <GripHorizontal
          className="size-4 shrink-0 text-text-muted"
          aria-hidden="true"
          strokeWidth={1.5}
        />
        <div
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-color bg-card-bg text-text-secondary"
        >
          {renderGroupHeaderIcon(groupIcon)}
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-sans text-xs font-medium text-text-primary sm:text-sm">
            {groupName}
          </h3>
          <span className="block text-[11px] font-normal tabular-nums text-text-muted">
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
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-card-bg px-2 text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-accent3 hover:text-accent3-foreground"
        >
          <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
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

  const { activeCount, controllableCount } = useIoTStore(
    useShallow(
      React.useCallback(
        (state) => countGroupSegments(groupSegments, state.pinsState),
        [groupSegments],
      ),
    ),
  );

  const borderClass = resolveGroupBorderClass(isDragging, isSelected, activeCount);
  const zIndex = isDragging ? 950 : isSelected ? 890 : rect.zIndex;

  const animateState = resolveCanvasNodeMotionState(
    animationsEnabled,
    isDragging,
    dragTiltDeg,
    1.016,
  );

  return (
    <div
      data-canvas-node="true"
      data-canvas-node-id={nodeId}
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
        style={animationsEnabled ? { rotate: "var(--drag-tilt, 0deg)" } : undefined}
        className={`relative flex size-full flex-col rounded-2xl border bg-card-bg-solid text-right transition-[border-color,box-shadow,rotate] duration-150 ${borderClass}`}
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
            cornerRadiusClass="size-4 rounded-bl-[18px]"
            onStartResize={onStartResize}
          />
        )}
      </m.div>
    </div>
  );
});
