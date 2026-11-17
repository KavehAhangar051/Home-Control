"use client";

import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence } from "motion/react";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getSegmentGridLayout } from "../../workspace/core/gridUtils";
import type { SortableGroupProps } from "../core/types";
import GroupHeader from "./GroupHeader";

type CustomGridTracksStyle = React.CSSProperties & { "--group-grid-tracks": number };

function GroupGrid({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      className="grid auto-rows-fr w-full min-w-0 grid-cols-1 gap-3 p-3 text-right relative z-10 sm:grid-cols-[repeat(var(--group-grid-tracks,1),minmax(0,1fr))] sm:gap-4 sm:p-4"
      style={style}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  );
}

/**
 * Displays a Smart Home zone/room group container with a unified header toolbar
 * and responsive sortable grid of device segments.
 */
function SortableGroup({
  id,
  items,
  segmentCount,
  maxCols,
  onColsChange,
  onAddPlaceholder,
  onDeleteGroup,
  parentGroupsCols = 1,
  animationsEnabled = true,
  icon,
  children,
  isOverlayItem,
}: SortableGroupProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group-${id}`,
    data: {
      type: "Group",
      group: id,
    },
    disabled: isOverlayItem,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(isDragging ? null : transform),
    transition: animationsEnabled
      ? transition || "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "none",
    zIndex: isDragging ? 0 : "auto",
    opacity: isDragging ? 0.35 : 1,
  };

  const { gridTracks } = getSegmentGridLayout(items.length, maxCols);

  const contentStyle = React.useMemo<CustomGridTracksStyle>(
    () => ({ "--group-grid-tracks": gridTracks }),
    [gridTracks],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="@container/group relative group/group-card w-full touch-none flex flex-col bezel-shell"
    >
      <Card className="w-full relative group/body flex-grow !gap-0 !overflow-visible !rounded-[calc(1.25rem-0.375rem)] !border !border-border-color !bg-card-bg !py-0 !shadow-[inset_0_1px_1px_0_oklch(1_0_0/0.09)] !ring-0 transition-colors duration-200 ease-out">
        <GroupHeader
          id={id}
          segmentCount={segmentCount}
          maxCols={maxCols}
          icon={icon}
          onColsChange={onColsChange}
          onAddPlaceholder={onAddPlaceholder}
          onDeleteGroup={onDeleteGroup}
          parentGroupsCols={parentGroupsCols}
          attributes={attributes}
          listeners={listeners}
        />

        <CardContent className="!px-0 !py-0">
          {isOverlayItem ? (
            <GroupGrid style={contentStyle}>{children}</GroupGrid>
          ) : (
            <SortableContext id={id} items={items} strategy={rectSortingStrategy}>
              <GroupGrid style={contentStyle}>{children}</GroupGrid>
            </SortableContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default React.memo(SortableGroup);
