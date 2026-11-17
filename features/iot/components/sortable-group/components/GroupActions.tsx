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
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-color bg-card-bg text-text-primary md:hover:bg-accent3 md:hover:text-accent3-foreground md:hover:border-accent3 transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] cursor-pointer font-sans font-medium ${
                isDenseHeader ? "size-7" : showAddLabel ? "h-8 px-2.5 text-xs" : "size-8"
              }`}
            >
              <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
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
                className={`rounded-lg border-border-color text-text-muted md:hover:text-text-primary cursor-pointer ${
                  isDenseHeader ? "size-7 min-w-7 p-0" : "size-8 min-w-8 p-0"
                } ${
                  isSettingsOpen
                    ? "border-accent3 bg-accent3-transparent text-accent3 aria-pressed:bg-accent3-transparent"
                    : "bg-card-bg"
                }`}
              >
                <Settings className="size-4 shrink-0" strokeWidth={1.5} />
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
