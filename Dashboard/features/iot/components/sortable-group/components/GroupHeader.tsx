"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import React from "react";
import { GripVertical } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/features/iot/hooks/useMediaQuery";
import { getSegmentIcon, hasIcon, ICON_MAP } from "@/features/iot/utils/icons";
import { useGroupHeaderLayout } from "../hooks/useGroupHeaderLayout";
import GroupActions from "./GroupActions";

interface GroupHeaderProps {
  id: string;
  segmentCount: number;
  maxCols: number;
  icon?: string;
  onColsChange: (cols: number) => void;
  onAddPlaceholder: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  parentGroupsCols: number;
  attributes: DraggableAttributes | Record<string, string | number | boolean | undefined>;
  listeners: DraggableSyntheticListeners;
}

function GroupAvatar({ icon, isDenseHeader }: { icon?: string; isDenseHeader: boolean }) {
  const iconClass = isDenseHeader ? "w-3.5 h-3.5" : "w-4 h-4 sm:w-4.5 sm:h-4.5";

  if (!icon) {
    return React.createElement(ICON_MAP.Layers, { className: iconClass });
  }

  if (hasIcon(icon)) {
    return React.createElement(getSegmentIcon(icon), { className: iconClass });
  }

  return (
    <span
      className={`leading-none flex items-center justify-center ${
        isDenseHeader ? "text-sm w-3.5 h-3.5" : "text-base sm:text-lg w-4 h-4"
      }`}
    >
      {icon}
    </span>
  );
}

/**
 * Renders the top header bar of a Smart Home group card, organizing
 * the group drag handle and room identity on the right (RTL start)
 * and layout/segment/settings controls on the left (RTL end).
 */
export default function GroupHeader({
  id,
  segmentCount,
  maxCols,
  icon,
  onColsChange,
  onAddPlaceholder,
  onDeleteGroup,
  parentGroupsCols,
  attributes,
  listeners,
}: GroupHeaderProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");

  const {
    isCompact,
    isSettingsOpen,
    setIsSettingsOpen,
    titleContainerRef,
    titleTextRef,
    buttonRef,
    menuRef,
  } = useGroupHeaderLayout();

  const isDenseHeader = parentGroupsCols === 3;

  return (
    <div
      className={`flex items-center justify-between w-full min-w-0 gap-2 relative z-20 border-b border-[var(--border-color)] bg-[var(--card-hover-bg)] rounded-t-3xl sm:rounded-t-[28px] ${
        isDenseHeader ? "px-2.5 py-2" : "px-3 py-2.5 sm:px-4 sm:py-3"
      }`}
    >
      {/* RTL Right: Drag Handle + Group Icon + Title & Count */}
      <div
        ref={titleContainerRef}
        className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 relative"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                {...attributes}
                {...listeners}
                className={`flex items-center justify-center rounded-lg text-[var(--text-muted)] md:hover:text-[var(--text-primary)] md:hover:bg-[var(--muted)]/80 transition-colors cursor-grab active:cursor-grabbing shrink-0 ${
                  isDenseHeader ? "w-6 h-7" : "w-7 h-8"
                }`}
              >
                <GripVertical
                  strokeWidth={2}
                  className={isDenseHeader ? "w-4 h-4" : "w-4 h-4 sm:w-4.5 sm:h-4.5"}
                />
              </div>
            }
          />
          <TooltipContent>کشیدن کل گروه برای جابه‌جایی</TooltipContent>
        </Tooltip>

        <div data-animate-icon-parent className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div
            aria-hidden="true"
            className={`flex items-center justify-center rounded-xl bg-[var(--accent3-transparent)] text-[var(--accent3)] border border-[var(--accent3)]/20 shrink-0 ${
              isDenseHeader ? "w-7 h-7" : "w-8 h-8 sm:w-9 sm:h-9"
            }`}
          >
            <GroupAvatar icon={icon} isDenseHeader={isDenseHeader} />
          </div>

          <div className="min-w-0 flex-1 text-right leading-tight">
            <div className="flex items-center gap-2 min-w-0">
              <h4
                ref={titleTextRef}
                className={`font-sans font-bold text-slate-900 dark:text-[var(--text-primary)] truncate ${
                  isDenseHeader ? "text-xs" : "text-xs sm:text-sm"
                }`}
              >
                {id}
              </h4>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums bg-[var(--muted)]/70 text-[var(--text-muted)] shrink-0">
                {segmentCount} قطعه
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RTL Left: Quick Add, Column Layout Selector & Settings Menu */}
      <GroupActions
        id={id}
        maxCols={maxCols}
        isCompact={isCompact}
        isMobile={isMobile}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        onColsChange={onColsChange}
        onAddPlaceholder={onAddPlaceholder}
        onDeleteGroup={onDeleteGroup}
        parentGroupsCols={parentGroupsCols}
        buttonRef={buttonRef}
        menuRef={menuRef}
      />
    </div>
  );
}
