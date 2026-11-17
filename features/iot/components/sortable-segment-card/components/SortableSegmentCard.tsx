"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import React from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { getSegmentGridLayout } from "../../workspace/core/gridUtils";
import type { SortableSegmentCardProps } from "../core/types";
import { useSegmentDensity } from "../hooks/useSegmentDensity";
import ActiveCard from "./ActiveCard";
import PlaceholderCard from "./PlaceholderCard";

const SEGMENT_SPAN_CLASS = "sm:[grid-column:span_var(--segment-span,1)/span_var(--segment-span,1)]";

type SegmentCardStyle = React.CSSProperties & { "--segment-span": number };

function getSegmentCardStyle(
  isDragging: boolean,
  isSettingsOpen: boolean,
  segmentSpan: number,
): SegmentCardStyle {
  return {
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
        className={`size-full border-2 border-dashed border-accent3-medium/35 bg-card-bg/40 rounded-2xl transition-colors duration-300 ${
          isUltraCompact ? "min-h-[78px]" : "min-h-[108px]"
        } flex items-center justify-center`}
      >
        <div className="size-5 rounded-full border-2 border-accent3-medium/20 border-t-accent3 animate-spin opacity-40" />
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

  const { ref, handleRef, isDragging } = useSortable({
    id: segment.id,
    index,
    group: segment.group || "Test",
    type: "Segment",
    accept: (source) =>
      source.type === "Segment" && source.data.group === (segment.group || "Test"),
    data: { group: segment.group || "Test" },
    disabled: props.isOverlayItem,
    transition: animationsEnabled
      ? { duration: 350, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      : null,
  });

  const segmentSpan = getSegmentGridLayout(groupItemsCount, groupMaxCols).getItemSpan(index);

  const style = getSegmentCardStyle(isDragging, isSettingsOpen, segmentSpan);

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
          handleRef={undefined}
        />
      </div>
    );
  }

  if (isDragging) {
    return (
      <DraggingSegmentSkeleton
        setNodeRef={ref}
        style={style}
        isSettingsOpen={isSettingsOpen}
        isUltraCompact={isUltraCompact}
      />
    );
  }

  if (segment.type === "placeholder") {
    return (
      <div ref={ref} style={style} className={`touch-none relative h-full ${SEGMENT_SPAN_CLASS}`}>
        <PlaceholderCard
          segment={segment}
          onRemove={props.onRemove}
          onSetupPlaceholder={props.onSetupPlaceholder}
          handleRef={handleRef}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          animationsEnabled={animationsEnabled}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
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
        handleRef={handleRef}
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
