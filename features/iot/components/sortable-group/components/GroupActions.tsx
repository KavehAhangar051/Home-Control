import { AnimatePresence } from "motion/react";
import type React from "react";
import { Plus, Settings } from "@/components/ui/hugeicons";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import GroupSettingsMenu from "./GroupSettingsMenu";
import LayoutSelector from "./LayoutSelector";

interface GroupActionsProps {
  id: string;
  maxCols: number;
  isCompact: boolean;
  isMobile: boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  onColsChange: (cols: number) => void;
  onAddPlaceholder: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  parentGroupsCols: number;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Renders the action cluster for a Smart Home group header:
 * 1. Quick "Add Segment" button
 * 2. Inline column layout selector (on desktop/non-compact widths)
 * 3. Group settings & delete menu trigger
 */
export default function GroupActions({
  id,
  maxCols,
  isCompact,
  isMobile,
  isSettingsOpen,
  setIsSettingsOpen,
  onColsChange,
  onAddPlaceholder,
  onDeleteGroup,
  parentGroupsCols,
  buttonRef,
  menuRef,
}: GroupActionsProps) {
  const isDenseHeader = parentGroupsCols === 3;
  const showAddLabel = !isDenseHeader && !isCompact && !isMobile;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
      {/* Quick Add Segment Button */}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => onAddPlaceholder(id)}
              aria-label={`افزودن قطعه جدید به گروه ${id}`}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--accent3)]/25 bg-[var(--accent3-transparent)] text-[var(--accent3)] md:hover:bg-[var(--accent3)] md:hover:text-[var(--bg-main)] transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] cursor-pointer font-sans font-bold ${
                isDenseHeader ? "h-7 w-7" : showAddLabel ? "h-8 px-2.5 text-xs" : "h-8 w-8"
              }`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
              {showAddLabel && <span>افزودن قطعه</span>}
            </button>
          }
        />
        <TooltipContent>افزودن جایگاه قطعه جدید به این گروه</TooltipContent>
      </Tooltip>

      {/* Inline Column Layout Selector on spacious viewports */}
      {!(isCompact || isMobile) && (
        <LayoutSelector
          maxCols={maxCols}
          onColsChange={onColsChange}
          parentGroupsCols={parentGroupsCols}
        />
      )}

      {/* Group Settings & Delete Menu Trigger */}
      <div className="relative flex items-center">
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                ref={buttonRef}
                variant="outline"
                size="sm"
                pressed={isSettingsOpen}
                onPressedChange={() => setIsSettingsOpen(!isSettingsOpen)}
                aria-expanded={isSettingsOpen}
                aria-label={`تنظیمات و مدیریت گروه ${id}`}
                className={`rounded-lg border-[var(--border-color)] text-[var(--text-secondary)] md:hover:text-[var(--text-primary)] cursor-pointer ${
                  isDenseHeader ? "h-7 w-7 min-w-7 p-0" : "h-8 w-8 min-w-8 p-0"
                } ${
                  isSettingsOpen
                    ? "border-[var(--accent3)] bg-[var(--accent3-transparent)] text-[var(--accent3)] aria-pressed:bg-[var(--accent3-transparent)]"
                    : "bg-[var(--card-bg)]"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
              </Toggle>
            }
          />
          <TooltipContent>تنظیمات و مدیریت گروه</TooltipContent>
        </Tooltip>

        <AnimatePresence>
          <GroupSettingsMenu
            id={id}
            isSettingsOpen={isSettingsOpen}
            isCompact={isCompact}
            isMobile={isMobile}
            maxCols={maxCols}
            onColsChange={onColsChange}
            onAddPlaceholder={onAddPlaceholder}
            onDeleteGroup={onDeleteGroup}
            setIsSettingsOpen={setIsSettingsOpen}
            menuRef={menuRef}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
