"use client";

import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence } from "motion/react";
import type React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getSegmentGridLayout } from "../../workspace/core/gridUtils";
import type { SortableGroupProps } from "../core/types";
import GroupHeader from "./GroupHeader";

type CustomGridTracksStyle = React.CSSProperties & { "--group-grid-tracks": number };

function GroupGrid({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      className="grid w-full min-w-0 grid-cols-1 gap-3 p-3 text-right relative z-10 sm:grid-cols-[repeat(var(--group-grid-tracks,1),minmax(0,1fr))] sm:gap-3.5 sm:p-4"
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
export default function SortableGroup({
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
      ? transition || "transform 350ms cubic-bezier(0.16, 1, 0.3, 1)"
      : "none",
    zIndex: isDragging ? 0 : "auto",
    opacity: isDragging ? 0.35 : 1,
  };

  const { gridTracks } = getSegmentGridLayout(items.length, maxCols);

  const contentStyle: CustomGridTracksStyle = {
    "--group-grid-tracks": gridTracks,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/group-card w-full mb-6 touch-none flex flex-col"
    >
      <Card className="w-full relative group/body flex-grow !gap-0 !overflow-visible !rounded-2xl !border !border-[var(--border-color)] !bg-[var(--card-bg)] !py-0 !shadow-xs !ring-0 transition-colors duration-200">
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
