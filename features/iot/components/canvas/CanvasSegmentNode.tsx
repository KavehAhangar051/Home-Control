"use client";

import { GripHorizontal } from "lucide-react";
import { m } from "motion/react";
import React from "react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons";
import CardBody from "@/features/iot/components/sortable-segment-card/components/CardBody";
import SegmentActions from "@/features/iot/components/sortable-segment-card/components/SegmentActions";
import { useAutoOffTimer } from "@/features/iot/components/sortable-segment-card/hooks/useAutoOffTimer";
import { useCardHeaderLayout } from "@/features/iot/components/sortable-segment-card/hooks/useCardHeaderLayout";
import useSegmentButtonProps from "@/features/iot/components/sortable-segment-card/hooks/useSegmentButtonProps";
import type { TrellisSegmentHandlers } from "@/features/iot/components/trellis/TrellisSegmentTile";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { SPRING_MOUSE, SPRING_PANEL } from "@/lib/ease";
import NodePerimeterSpark from "./NodePerimeterSpark";
import type { CanvasNodeRect, CanvasResizeDirection } from "./canvasTypes";

interface CanvasSegmentNodeProps extends TrellisSegmentHandlers {
  nodeId: string;
  segment: Segment;
  rect: CanvasNodeRect;
  isSelected: boolean;
  isDragging: boolean;
  dragTiltDeg: number;
  isLocked: boolean;
  showPort: boolean;
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

// SAFETY: React CSSProperties supports CSS custom properties
const CARD_SPACING_STYLE: React.CSSProperties = { "--card-spacing": "0px" } as React.CSSProperties;

export default React.memo(function CanvasSegmentNode({
  nodeId,
  segment,
  rect,
  isSelected,
  isDragging,
  dragTiltDeg,
  isLocked,
  showPort,
  animationsEnabled,
  onSelect,
  onStartDrag,
  onStartResize,
  onRemoveSegment,
  onTogglePin,
  onSetPinState,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  onSetupPlaceholder,
}: CanvasSegmentNodeProps) {
  const isPinOn = useIoTStore((s) => Boolean(s.pinsState[segment.pin]));

  const {
    isSettingsOpen,
    setIsSettingsOpen,
    showAutoOffMenu,
    setShowAutoOffMenu,
    menuPosition,
    buttonRef,
    menuRef,
    autoOffButtonRef,
    autoOffMenuRef,
  } = useCardHeaderLayout(segment.id);

  const mode = segment.mode || "switch";

  const buttonProps = useSegmentButtonProps({
    mode,
    pin: segment.pin,
    onTogglePin,
    onSetPinState,
  });

  const { countdown } = useAutoOffTimer({
    isPinOn,
    autoOff: segment.auto_off,
    mode,
    pin: segment.pin,
    onSetPinState,
  });

  const isUltraCompact = rect.width < 185 || rect.height < 118;
  const isCompact = rect.width < 235 || rect.height < 142;
  const isInput = segment.type === "input";

  const surfaceBorderClass = isDragging
    ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/40 shadow-2xl"
    : isSelected
      ? "border-[var(--accent3)] ring-2 ring-[var(--accent3)]/35 shadow-lg"
      : isPinOn
        ? isInput
          ? "border-emerald-500 shadow-sm"
          : "border-[var(--accent3)] shadow-sm"
        : "border-[var(--border-color)] shadow-xs";

  const autoOffMenuProps = {
    showAutoOffMenu,
    setShowAutoOffMenu,
    autoOffButtonRef,
    autoOffMenuRef,
  };

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
        zIndex: isSettingsOpen ? 999 : isDragging ? 950 : isSelected ? 900 : rect.zIndex,
      }}
      className="absolute top-0 left-0 flex flex-col select-none"
    >
      <m.div
        initial={animationsEnabled ? { opacity: 0, scale: 0.94, y: 8 } : false}
        animate={
          animationsEnabled
            ? {
                opacity: 1,
                scale: isDragging ? 1.022 : 1,
                rotate: isDragging ? dragTiltDeg : 0,
                y: isDragging ? -2 : 0,
              }
            : { opacity: 1, scale: 1, rotate: 0, y: 0 }
        }
        transition={isDragging ? SPRING_MOUSE : SPRING_PANEL}
        className="relative h-full w-full"
      >
        <NodePerimeterSpark
          active={isPinOn}
          animationsEnabled={animationsEnabled}
          radius={16}
          color={isInput ? "#10b981" : "var(--accent3)"}
          speed="flow"
        />

        {/* n8n connection port indicator */}
        {showPort && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 -right-2 z-30 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 transition-colors ${
              isPinOn
                ? isInput
                  ? "border-emerald-400 bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  : "border-[var(--accent3)] bg-[var(--accent3)] shadow-[0_0_8px_var(--accent3)]"
                : "border-[var(--border-color)] bg-[var(--card-bg-solid)]"
            }`}
          />
        )}

        <Card
          className={`relative flex h-full w-full flex-col justify-between !gap-0 !overflow-visible !rounded-2xl !bg-[var(--card-bg-solid)] !p-0 !ring-0 border transition-[border-color,box-shadow] duration-150 ${surfaceBorderClass}`}
          style={CARD_SPACING_STYLE}
        >
          {/* Top n8n Node Drag Header Bar */}
          <div
            onPointerDown={(e) => {
              if (e.button === 0) onStartDrag(nodeId, e);
            }}
            className={`flex h-8 shrink-0 items-center justify-between gap-2 rounded-t-2xl border-b border-[var(--border-color)]/60 bg-[var(--secondary)]/65 px-3.5 text-[11px] ${
              isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
            }`}
            style={{ touchAction: "none" }}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <GripHorizontal
                className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <span className="truncate font-semibold text-[var(--text-muted)]">
                {segment.group || "Test"}
              </span>
            </div>

            <div
              className="flex shrink-0 items-center gap-1"
              onPointerDown={(e) => {
                if (e.button !== 2) e.stopPropagation();
              }}
            >
              {segment.type === "placeholder" ? (
                <DeleteButton
                  size="xs"
                  resetAfter={0}
                  onConfirm={() => onRemoveSegment(segment.id)}
                  label="حذف جایگاه خالی"
                />
              ) : (
                <SegmentActions
                  segment={segment}
                  isPinOn={isPinOn}
                  isUltraCompact={isUltraCompact}
                  isCompact={isCompact}
                  inHeaderBar
                  onRemove={onRemoveSegment}
                  onUpdateSegmentMode={onUpdateSegmentMode}
                  onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
                  mode={mode}
                  countdown={countdown}
                  isSettingsOpen={isSettingsOpen}
                  setIsSettingsOpen={setIsSettingsOpen}
                  menuPosition={menuPosition}
                  buttonRef={buttonRef}
                  menuRef={menuRef}
                  autoOffMenuProps={autoOffMenuProps}
                />
              )}
            </div>
          </div>

          {/* Node Body */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[15px]">
            {segment.type === "placeholder" ? (
              <button
                type="button"
                onClick={() => onSetupPlaceholder?.(segment.id)}
                className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 border-0 bg-transparent p-2 text-center"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--accent3-transparent)] text-[var(--accent3)]">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </div>
                {!isUltraCompact && (
                  <span className="font-sans text-xs font-bold text-[var(--text-primary)]">
                    تخصیص قطعه هوشمند
                  </span>
                )}
              </button>
            ) : (
              <CardBody
                segment={segment}
                isPinOn={isPinOn}
                isCompact={isCompact}
                isUltraCompact={isUltraCompact}
                hasExternalHeader
                mode={mode}
                buttonProps={buttonProps}
                animationsEnabled={animationsEnabled}
                countdown={countdown}
              />
            )}
          </div>

          {/* Touch-friendly Resize Handles */}
          {!isLocked && (
            <>
              {/* Bottom-left resize grip (primary in RTL) */}
              <button
                type="button"
                tabIndex={-1}
                aria-label={`تغییر اندازه ${segment.title}`}
                onPointerDown={(e) => {
                  if (e.button === 0) onStartResize(nodeId, "segment", "sw", e);
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

              {/* Bottom-right resize grip */}
              <div
                onPointerDown={(e) => {
                  if (e.button === 0) onStartResize(nodeId, "segment", "se", e);
                }}
                style={{ touchAction: "none" }}
                className="absolute -right-1.5 -bottom-1.5 z-30 h-6 w-6 cursor-nwse-resize"
              />

              {/* Bottom edge resize strip */}
              <div
                onPointerDown={(e) => {
                  if (e.button === 0) onStartResize(nodeId, "segment", "s", e);
                }}
                style={{ touchAction: "none" }}
                className="absolute inset-x-5 -bottom-1 z-20 h-2.5 cursor-ns-resize"
              />
            </>
          )}
        </Card>
      </m.div>
    </div>
  );
});
