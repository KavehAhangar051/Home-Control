"use client";

import { GripHorizontal } from "lucide-react";
import { m } from "motion/react";
import React from "react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import CardBody from "@/features/iot/components/sortable-segment-card/components/CardBody";
import SegmentActions from "@/features/iot/components/sortable-segment-card/components/SegmentActions";
import { useAutoOffTimer } from "@/features/iot/components/sortable-segment-card/hooks/useAutoOffTimer";
import {
  type SegmentMenuPosition,
  useCardHeaderLayout,
} from "@/features/iot/components/sortable-segment-card/hooks/useCardHeaderLayout";
import useSegmentButtonProps from "@/features/iot/components/sortable-segment-card/hooks/useSegmentButtonProps";
import type { TrellisSegmentHandlers } from "@/features/iot/components/trellis/TrellisSegmentTile";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { SPRING_MOUSE, SPRING_PANEL } from "@/lib/ease";
import CanvasResizeHandles from "./CanvasResizeHandles";
import type { CanvasNodeRect, CanvasResizeDirection } from "./canvasTypes";
import NodePerimeterSpark from "./NodePerimeterSpark";
import { resolveCanvasNodeMotionState } from "./nodeMotion";

interface CanvasSegmentNodeProps extends TrellisSegmentHandlers {
  nodeId: string;
  segment: Segment;
  rect: CanvasNodeRect;
  isSelected: boolean;
  isDragging?: boolean;
  dragTiltDeg?: number;
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

function resolveSegmentBorderClass(
  isDragging: boolean,
  isSelected: boolean,
  isPinOn: boolean,
): string {
  if (isDragging) return "border-accent3 ring-2 ring-accent3/40 shadow-2xl";

  if (isSelected) return "border-accent3 ring-2 ring-accent3/35 shadow-lg";

  if (!isPinOn) return "border-border-color shadow-xs";

  return "border-accent3 shadow-sm";
}

function resolveSegmentPortClass(isPinOn: boolean): string {
  if (!isPinOn) return "border-border-color bg-card-bg-solid";

  return "border-accent3 bg-accent3 shadow-[0_0_8px_var(--accent3)]";
}

function resolveSegmentZIndex(
  isSettingsOpen: boolean,
  isDragging: boolean,
  isSelected: boolean,
  baseZIndex: number,
): number {
  if (isSettingsOpen) return 999;

  if (isDragging) return 950;

  if (isSelected) return 900;

  return baseZIndex;
}

function CanvasSegmentGraphOverlay({
  isPinOn,
  animationsEnabled,
}: {
  isPinOn: boolean;
  animationsEnabled: boolean;
}) {
  return (
    <>
      <NodePerimeterSpark
        active={isPinOn}
        animationsEnabled={animationsEnabled}
        radius={16}
        color="var(--accent3)"
        speed="flow"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -right-2 z-30 size-3.5 -translate-y-1/2 rounded-full border-2 transition-colors ${resolveSegmentPortClass(
          isPinOn,
        )}`}
      />
    </>
  );
}

function CanvasPlaceholderBody({
  segmentId,
  isUltraCompact,
  onSetupPlaceholder,
}: {
  segmentId: string;
  isUltraCompact: boolean;
  onSetupPlaceholder?: (segmentId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSetupPlaceholder?.(segmentId)}
      className="flex size-full cursor-pointer flex-col items-center justify-center gap-1.5 border-0 bg-transparent p-2 text-center"
    >
      <div className="flex size-8 items-center justify-center rounded-xl border border-border-color bg-accent3-transparent text-accent3">
        <Plus className="size-4" strokeWidth={2.5} />
      </div>
      {!isUltraCompact && (
        <span className="font-sans text-xs font-bold text-text-primary">تخصیص قطعه هوشمند</span>
      )}
    </button>
  );
}

interface CanvasSegmentHeaderProps {
  nodeId: string;
  segment: Segment;
  isLocked: boolean;
  isPlaceholder: boolean;
  isPinOn: boolean;
  isUltraCompact: boolean;
  isCompact: boolean;
  mode: "switch" | "push";
  countdown: number | null;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (val: boolean) => void;
  menuPosition: SegmentMenuPosition | null;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  autoOffMenuProps: {
    showAutoOffMenu: boolean;
    setShowAutoOffMenu: (val: boolean) => void;
    autoOffButtonRef: React.RefObject<HTMLButtonElement | null>;
    autoOffMenuRef: React.RefObject<HTMLDivElement | null>;
  };
  onStartDrag: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onRemoveSegment: (id: string) => void;
  onUpdateSegmentMode?: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, sec: number) => void;
}

function CanvasSegmentHeader({
  nodeId,
  segment,
  isLocked,
  isPlaceholder,
  isPinOn,
  isUltraCompact,
  isCompact,
  mode,
  countdown,
  isSettingsOpen,
  setIsSettingsOpen,
  menuPosition,
  buttonRef,
  menuRef,
  autoOffMenuProps,
  onStartDrag,
  onRemoveSegment,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
}: CanvasSegmentHeaderProps) {
  return (
    <div
      onPointerDown={(e) => {
        if (e.button === 0) onStartDrag(nodeId, e);
      }}
      className={`flex h-8 shrink-0 items-center justify-between gap-2 rounded-t-2xl border-b border-border-color/60 bg-secondary/65 px-3.5 text-[11px] ${
        isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
      style={{ touchAction: "none" }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <GripHorizontal className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
        <span className="truncate font-semibold text-text-muted">{segment.group || "Test"}</span>
      </div>

      <div
        className="flex shrink-0 items-center gap-1"
        onPointerDown={(e) => {
          if (e.button !== 2) e.stopPropagation();
        }}
      >
        {isPlaceholder ? (
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
  );
}

export default React.memo(function CanvasSegmentNode({
  nodeId,
  segment,
  rect,
  isSelected,
  isDragging = false,
  dragTiltDeg = 0,
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
  const isPlaceholder = segment.type === "placeholder";
  const surfaceBorderClass = resolveSegmentBorderClass(isDragging, isSelected, isPinOn);
  const zIndex = resolveSegmentZIndex(isSettingsOpen, isDragging, isSelected, rect.zIndex);

  const animateState = resolveCanvasNodeMotionState(
    animationsEnabled,
    isDragging,
    dragTiltDeg,
    1.022,
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
      className="absolute top-0 left-0 flex flex-col select-none"
    >
      <m.div
        initial={animationsEnabled ? { opacity: 0, scale: 0.94, y: 8 } : false}
        animate={animateState}
        transition={isDragging ? SPRING_MOUSE : SPRING_PANEL}
        style={animationsEnabled ? { rotate: "var(--drag-tilt, 0deg)" } : undefined}
        className="relative size-full transition-[rotate] duration-150 ease-out"
      >
        {showPort && (
          <CanvasSegmentGraphOverlay isPinOn={isPinOn} animationsEnabled={animationsEnabled} />
        )}

        <Card
          className={`relative flex size-full flex-col justify-between !gap-0 !overflow-visible !rounded-2xl !bg-card-bg-solid !p-0 !ring-0 border transition-[border-color,box-shadow] duration-150 ${surfaceBorderClass}`}
          style={CARD_SPACING_STYLE}
        >
          <CanvasSegmentHeader
            nodeId={nodeId}
            segment={segment}
            isLocked={isLocked}
            isPlaceholder={isPlaceholder}
            isPinOn={isPinOn}
            isUltraCompact={isUltraCompact}
            isCompact={isCompact}
            mode={mode}
            countdown={countdown}
            isSettingsOpen={isSettingsOpen}
            setIsSettingsOpen={setIsSettingsOpen}
            menuPosition={menuPosition}
            buttonRef={buttonRef}
            menuRef={menuRef}
            autoOffMenuProps={{
              showAutoOffMenu,
              setShowAutoOffMenu,
              autoOffButtonRef,
              autoOffMenuRef,
            }}
            onStartDrag={onStartDrag}
            onRemoveSegment={onRemoveSegment}
            onUpdateSegmentMode={onUpdateSegmentMode}
            onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[15px]">
            {isPlaceholder ? (
              <CanvasPlaceholderBody
                segmentId={segment.id}
                isUltraCompact={isUltraCompact}
                onSetupPlaceholder={onSetupPlaceholder}
              />
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

          {!isLocked && (
            <CanvasResizeHandles
              nodeId={nodeId}
              kind="segment"
              ariaLabel={`تغییر اندازه ${segment.title}`}
              isSelected={isSelected}
              onStartResize={onStartResize}
            />
          )}
        </Card>
      </m.div>
    </div>
  );
});
