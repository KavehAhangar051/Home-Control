"use client";

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
  handleRef?: React.RefCallback<HTMLElement>;
}

function GroupAvatar({ icon, isDenseHeader }: { icon?: string; isDenseHeader: boolean }) {
  const iconClass = isDenseHeader ? "size-3.5" : "size-4 sm:size-4.5";

  if (!icon) {
    return React.createElement(ICON_MAP.Layers, { className: iconClass });
  }

  if (hasIcon(icon)) {
    return React.createElement(getSegmentIcon(icon), { className: iconClass });
  }

  return (
    <span
      className={`leading-none flex items-center justify-center ${
        isDenseHeader ? "text-sm size-3.5" : "text-base sm:text-lg size-4"
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
  handleRef,
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
      className={`flex items-center justify-between w-full min-w-0 gap-2 relative z-20 border-b border-border-color bg-card-hover-bg rounded-t-[calc(1.25rem-0.375rem)] ${
        isDenseHeader ? "px-2.5 py-2" : "px-3 py-2.5 @md/group:px-4 @md/group:py-3"
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
              <button
                type="button"
                ref={handleRef}
                aria-label={`جابه‌جایی گروه ${id}`}
                className={`flex items-center justify-center rounded-lg text-text-muted md:hover:text-text-primary md:hover:bg-card-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 transition-colors duration-150 cursor-grab active:cursor-grabbing shrink-0 ${
                  isDenseHeader ? "w-6 h-7" : "w-7 h-8"
                }`}
              >
                <GripVertical
                  strokeWidth={1.5}
                  className={isDenseHeader ? "size-4" : "size-4 sm:size-4.5"}
                />
              </button>
            }
          />
          <TooltipContent>کشیدن کل گروه برای جابه‌جایی</TooltipContent>
        </Tooltip>

        <div data-animate-icon-parent className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div
            aria-hidden="true"
            className={`flex items-center justify-center rounded-lg bg-card-bg text-text-secondary border border-border-color shrink-0 ${
              isDenseHeader ? "size-7" : "size-8"
            }`}
          >
            <GroupAvatar icon={icon} isDenseHeader={isDenseHeader} />
          </div>

          <div className="min-w-0 flex-1 text-right leading-tight">
            <div className="flex items-center gap-2 min-w-0">
              <h2
                ref={titleTextRef}
                className={`font-sans font-medium text-text-primary truncate ${
                  isDenseHeader ? "text-xs" : "text-xs @sm/group:text-sm"
                }`}
              >
                {id}
              </h2>
              <span className="inline-flex items-center text-xs font-normal tabular-nums text-text-muted shrink-0">
                · {segmentCount} قطعه
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
