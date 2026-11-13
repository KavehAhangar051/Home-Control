"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { getSegmentGridLayout } from "../../workspace/core/gridUtils";
import type { SortableSegmentCardProps } from "../core/types";
import { useSegmentDensity } from "../hooks/useSegmentDensity";
import ActiveCard from "./ActiveCard";
import PlaceholderCard from "./PlaceholderCard";

const DEFAULT_CARD_TRANSITION = "transform 350ms cubic-bezier(0.16, 1, 0.3, 1)";
const EMPTY_RECORD = Object.freeze({});
const SEGMENT_SPAN_CLASS = "sm:[grid-column:span_var(--segment-span,1)/span_var(--segment-span,1)]";

type SegmentCardStyle = React.CSSProperties & { "--segment-span": number };

function getSegmentCardStyle(
  transform: ReturnType<typeof useSortable>["transform"],
  transition: string | undefined,
  animationsEnabled: boolean,
  isDragging: boolean,
  isSettingsOpen: boolean,
  segmentSpan: number,
): SegmentCardStyle {
  return {
    transform: CSS.Transform.toString(transform),
    transition: animationsEnabled ? transition || DEFAULT_CARD_TRANSITION : "none",
    zIndex: isDragging ? 50 : isSettingsOpen ? 40 : "auto",
    opacity: isDragging ? 0.35 : 1,
    scale: isDragging ? 0.96 : 1,
    "--segment-span": segmentSpan,
  };
}

function DraggingSegmentSkeleton({
  setNodeRef,
  style,
  isSettingsOpen,
  isUltraCompact,
}: {
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  isSettingsOpen: boolean;
  isUltraCompact: boolean;
}) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`touch-none relative h-full ${SEGMENT_SPAN_CLASS} ${isSettingsOpen ? "!basis-full !max-w-full" : ""}`}
    >
      <div
        className={`w-full border-2 border-dashed border-[var(--accent3-medium)]/35 bg-[var(--card-bg)]/20 backdrop-blur-md rounded-2xl transition-colors duration-300 ${
          isUltraCompact ? "min-h-[90px]" : "min-h-[140px]"
        } flex items-center justify-center`}
      >
        <div className="w-5 h-5 rounded-full border-2 border-[var(--accent3-medium)]/20 border-t-[var(--accent3)] animate-spin opacity-40" />
      </div>
    </div>
  );
}

function SortableSegmentCard(props: SortableSegmentCardProps) {
  const {
    segment,
    parentGroupsCols = 1,
    groupMaxCols = 3,
    groupItemsCount = 1,
    index = 0,
    animationsEnabled = true,
  } = props;

  const isSettingsOpen = useIoTStore((s) => s.openSegmentMenuId === segment.id);
  const isPinOn = useIoTStore((s) => !!s.pinsState[segment.pin]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
    data: {
      type: "Segment",
      group: segment.group || "Test",
    },
    disabled: props.isOverlayItem,
  });

  const segmentSpan = getSegmentGridLayout(groupItemsCount, groupMaxCols).getItemSpan(index);

  const style = getSegmentCardStyle(
    transform,
    transition,
    animationsEnabled,
    isDragging,
    isSettingsOpen,
    segmentSpan,
  );

  const { densityFactor, isUltraCompact, isCompact, isMobileTwoCol } = useSegmentDensity({
    groupMaxCols,
    groupItemsCount,
    index,
    parentGroupsCols,
    isMobilePortrait: Boolean(props.isMobilePortrait),
  });

  if (props.isOverlayItem) {
    return (
      <div className="relative h-full">
        <ActiveCard
          {...props}
          isPinOn={isPinOn}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          isMobileTwoCol={isMobileTwoCol}
          densityFactor={densityFactor}
          attributes={EMPTY_RECORD}
          listeners={EMPTY_RECORD}
        />
      </div>
    );
  }

  if (isDragging) {
    return (
      <DraggingSegmentSkeleton
        setNodeRef={setNodeRef}
        style={style}
        isSettingsOpen={isSettingsOpen}
        isUltraCompact={isUltraCompact}
      />
    );
  }

  if (segment.type === "placeholder") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`touch-none relative h-full ${SEGMENT_SPAN_CLASS}`}
      >
        <PlaceholderCard
          segment={segment}
          onRemove={props.onRemove}
          onSetupPlaceholder={props.onSetupPlaceholder}
          attributes={attributes}
          listeners={listeners}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          animationsEnabled={animationsEnabled}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`touch-none relative h-full transition-opacity duration-300 ${SEGMENT_SPAN_CLASS} ${isSettingsOpen ? "z-40" : ""}`}
    >
      <ActiveCard
        {...props}
        isPinOn={isPinOn}
        isCompact={isCompact}
        isUltraCompact={isUltraCompact}
        isMobileTwoCol={isMobileTwoCol}
        densityFactor={densityFactor}
        attributes={attributes}
        listeners={listeners}
      />
    </div>
  );
}

export default React.memo(SortableSegmentCard, (prevProps, nextProps) => {
  return (
    prevProps.segment === nextProps.segment &&
    prevProps.isLoadingIoT === nextProps.isLoadingIoT &&
    prevProps.parentGroupsCols === nextProps.parentGroupsCols &&
    prevProps.groupMaxCols === nextProps.groupMaxCols &&
    prevProps.groupItemsCount === nextProps.groupItemsCount &&
    prevProps.index === nextProps.index &&
    prevProps.animationsEnabled === nextProps.animationsEnabled &&
    prevProps.isOverlayItem === nextProps.isOverlayItem &&
    prevProps.isMobilePortrait === nextProps.isMobilePortrait
  );
});
