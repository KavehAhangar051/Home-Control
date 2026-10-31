"use client";

import React from "react";
import { useSortable, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { SortableGroupProps } from "../core/types";
import GroupHeader from "./GroupHeader";

const GROUP_COLS_STYLE_LUT: Record<number, React.CSSProperties> = {
  1: { "--group-cols": 1 } as React.CSSProperties,
  2: { "--group-cols": 2 } as React.CSSProperties,
  3: { "--group-cols": 3 } as React.CSSProperties,
  4: { "--group-cols": 4 } as React.CSSProperties,
  5: { "--group-cols": 5 } as React.CSSProperties,
  6: { "--group-cols": 6 } as React.CSSProperties,
};

function GroupGrid({ style, children }: { style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      className="grid w-full min-w-0 grid-cols-1 gap-3 p-3 text-right relative z-10 sm:grid-cols-[repeat(var(--group-cols),minmax(0,1fr))] sm:gap-4 sm:p-4"
      style={style}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  );
}

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
    opacity: isDragging ? 0.3 : 1,
  };

  const effectiveCols = Math.min(Math.max(1, items.length), maxCols);
  const contentStyle =
    GROUP_COLS_STYLE_LUT[effectiveCols] ||
    ({ "--group-cols": effectiveCols } as React.CSSProperties);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group/group-card w-full mb-6 touch-none flex flex-col gap-2"
    >
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

      {/* Body Island */}
      <Card className="w-full relative group/body flex-grow !gap-0 !overflow-visible !rounded-2xl !border !border-[var(--border-color)] !bg-[var(--card-bg)] !py-0 !shadow-none !ring-0">
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
