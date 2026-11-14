"use client";

import { GripHorizontal, Power, PowerOff } from "lucide-react";
import { m } from "motion/react";
import React from "react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons";
import TrellisSegmentTile from "@/features/iot/components/trellis/TrellisSegmentTile";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { getSegmentIcon, hasIcon, ICON_MAP } from "@/features/iot/utils/icons";
import { SPRING_MOUSE, SPRING_PANEL } from "@/lib/ease";
import NodePerimeterSpark from "./NodePerimeterSpark";
import type {
  CanvasGroupHandlers,
  CanvasNodeRect,
  CanvasResizeDirection,
  CanvasSubMode,
} from "./canvasTypes";

interface CanvasGroupNodeProps extends CanvasGroupHandlers {
  nodeId: string;
  groupName: string;
  groupSegments: Segment[];
  rect: CanvasNodeRect;
  subMode: CanvasSubMode;
  isSelected: boolean;
  isDragging: boolean;
  dragTiltDeg: number;
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

export default React.memo(function CanvasGroupNode({
  nodeId,
  groupName,
  groupSegments,
  rect,
  subMode,
  isSelected,
  isDragging,
  dragTiltDeg,
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

  let activeCount = 0;
  let controllableCount = 0;

  for (const seg of groupSegments) {
    if (seg.type !== "placeholder" && seg.pin) {
      if (seg.type !== "input") controllableCount += 1;

      if (pinsState[seg.pin]) activeCount += 1;
    }
  }

  const handleBatchGroupPower = (turnOn: boolean) => {
    for (const seg of groupSegments) {
      if (seg.type !== "placeholder" && seg.type !== "input" && seg.pin) {
        onSetPinState(seg.pin, turnOn);
      }
    }
  };

  const borderClass = isDragging
    ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/40 shadow-2xl"
    : isSelected
      ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/35 shadow-xl"
      : activeCount > 0
        ? "border-[var(--accent3)]/65 shadow-md"
        : "border-[var(--border-color)] shadow-sm";

  const isCompactContainer = rect.width < 320;

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
        zIndex: isDragging ? 950 : isSelected ? 890 : rect.zIndex,
      }}
      className="absolute top-0 left-0 select-none"
    >
      <m.div
        initial={animationsEnabled ? { opacity: 0, scale: 0.95, y: 8 } : false}
        animate={
          animationsEnabled
            ? {
                opacity: 1,
                scale: isDragging ? 1.016 : 1,
                rotate: isDragging ? dragTiltDeg : 0,
                y: isDragging ? -2 : 0,
              }
            : { opacity: 1, scale: 1, rotate: 0, y: 0 }
        }
        transition={isDragging ? SPRING_MOUSE : SPRING_PANEL}
        className={`relative flex h-full w-full flex-col rounded-3xl border bg-[var(--card-bg-solid)] text-right transition-[border-color,box-shadow] duration-150 ${borderClass}`}
      >
        <NodePerimeterSpark
          active={activeCount > 0}
          animationsEnabled={animationsEnabled}
          radius={24}
          color="var(--accent3)"
          speed="flow"
        />

        {/* n8n output port in graph mode */}
        {subMode === "graph" && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 -left-2 z-30 h-4 w-4 -translate-y-1/2 rounded-full border-2 transition-colors ${
              activeCount > 0
                ? "border-[var(--accent3)] bg-[var(--accent3)] shadow-[0_0_10px_var(--accent3)]"
                : "border-[var(--border-color)] bg-[var(--card-bg-solid)]"
            }`}
          >
            {activeCount > 0 && animationsEnabled && (
              <span
                aria-hidden="true"
                className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-full border border-[var(--accent3)]"
              />
            )}
          </div>
        )}

        {/* Drag Header */}
        <div
          onPointerDown={(e) => {
            if (e.button === 0) onStartDrag(nodeId, e);
          }}
          style={{ touchAction: "none" }}
          className={`flex shrink-0 items-center justify-between gap-2 rounded-t-3xl border-b border-[var(--border-color)] bg-[var(--card-hover-bg)]/65 px-4 py-2 ${
            isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <GripHorizontal
              className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <div
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--accent3)]/25 bg-[var(--accent3-transparent)] text-[var(--accent3)]"
            >
              {groupIcon ? (
                hasIcon(groupIcon) ? (
                  React.createElement(getSegmentIcon(groupIcon), { className: "h-4 w-4" })
                ) : (
                  <span className="text-sm leading-none">{groupIcon}</span>
                )
              ) : (
                React.createElement(ICON_MAP.Layers, { className: "h-4 w-4" })
              )}
            </div>

            <div className="min-w-0">
              <h3 className="truncate font-sans text-xs font-bold text-[var(--text-primary)] sm:text-sm">
                {groupName}
              </h3>
              <span className="block text-[10px] font-medium tabular-nums text-[var(--text-muted)]">
                {groupSegments.length} قطعه · {activeCount} فعال
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
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--accent3)]/25 bg-[var(--accent3-transparent)] px-2 text-[11px] font-bold text-[var(--accent3)] transition-colors hover:bg-[var(--accent3)] hover:text-[var(--accent3-foreground)]"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
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

        {/* Body: Either n8n Hub Controls ("graph") or Resizable Segment Grid ("groups") */}
        {subMode === "graph" ? (
          <div className="flex flex-1 flex-col justify-between gap-2 p-3">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
              <span>گره مرکزی گروه (n8n)</span>
              <span className="rounded-md bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--accent3)]">
                {activeCount} / {groupSegments.length} روشن
              </span>
            </div>

            {controllableCount > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleBatchGroupPower(true)}
                  className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--accent3)]/30 bg-[var(--accent3-transparent)] px-2.5 text-xs font-bold text-[var(--accent3)] transition-colors hover:bg-[var(--accent3)] hover:text-[var(--accent3-foreground)]"
                >
                  <Power className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>روشن همه</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBatchGroupPower(false)}
                  className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--secondary)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent3)] hover:text-[var(--text-primary)]"
                >
                  <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>خاموش همه</span>
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)]">
                قطعات این گروه روی شیت به این گره متصل هستند.
              </p>
            )}
          </div>
        ) : (
          <div
            data-canvas-scroll-area="true"
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3"
          >
            {groupSegments.length === 0 ? (
              <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] p-3 text-center text-xs text-[var(--text-muted)]">
                <span>قطعه‌ای در این گروه نیست.</span>
                <button
                  type="button"
                  onClick={() => onAddPlaceholder(groupName)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  افزودن قطعه
                </button>
              </div>
            ) : (
              <div
                className="grid min-h-full auto-rows-fr gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                }}
              >
                {groupSegments.map((seg) => (
                  <TrellisSegmentTile
                    key={seg.id}
                    segment={seg}
                    compact={isCompactContainer}
                    animationsEnabled={animationsEnabled}
                    onRemoveSegment={onRemoveSegment}
                    onTogglePin={onTogglePin}
                    onSetPinState={onSetPinState}
                    onUpdateSegmentMode={onUpdateSegmentMode}
                    onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
                    onSetupPlaceholder={onSetupPlaceholder}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resize Handles */}
        {!isLocked && (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label={`تغییر اندازه گروه ${groupName}`}
              onPointerDown={(e) => {
                if (e.button === 0) onStartResize(nodeId, "group", "sw", e);
              }}
              style={{ touchAction: "none" }}
              className="group/resize absolute -bottom-1 -left-1 z-30 h-7 w-7 cursor-nesw-resize"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-[6px] left-[6px] h-4 w-4 rounded-bl-[18px] border-b-2 border-l-2 transition-colors ${
                  isSelected
                    ? "border-[var(--accent3)]"
                    : "border-[var(--text-muted)]/45 group-hover/resize:border-[var(--accent3)]"
                }`}
              />
            </button>

            <div
              onPointerDown={(e) => {
                if (e.button === 0) onStartResize(nodeId, "group", "se", e);
              }}
              style={{ touchAction: "none" }}
              className="absolute -right-1.5 -bottom-1.5 z-30 h-6 w-6 cursor-nwse-resize"
            />

            <div
              onPointerDown={(e) => {
                if (e.button === 0) onStartResize(nodeId, "group", "s", e);
              }}
              style={{ touchAction: "none" }}
              className="absolute inset-x-5 -bottom-1 z-20 h-2.5 cursor-ns-resize"
            />
          </>
        )}
      </m.div>
    </div>
  );
});
