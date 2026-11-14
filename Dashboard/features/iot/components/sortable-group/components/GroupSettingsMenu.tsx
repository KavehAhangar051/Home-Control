import { m } from "motion/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import LayoutSelector from "./LayoutSelector";

interface GroupSettingsMenuProps {
  id: string;
  isSettingsOpen: boolean;
  isCompact: boolean;
  isMobile: boolean;
  maxCols: number;
  onColsChange: (cols: number) => void;
  onAddPlaceholder: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  setIsSettingsOpen: (open: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Dropdown menu for managing a Smart Home group:
 * allows changing segment grid columns, adding a new segment slot,
 * or safely deleting the entire group.
 */
export default function GroupSettingsMenu({
  id,
  isSettingsOpen,
  maxCols,
  onColsChange,
  onAddPlaceholder,
  onDeleteGroup,
  setIsSettingsOpen,
  menuRef,
}: GroupSettingsMenuProps) {
  if (!isSettingsOpen) return null;

  return (
    <m.div
      ref={menuRef}
      className="absolute top-[calc(100%+8px)] left-0 z-[100]"
      onPointerDown={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4, transition: TRANSITION_EXIT_QUICK }}
      transition={TRANSITION_ENTER_QUICK}
    >
      <div className="relative w-56 sm:w-64 bg-[var(--card-bg-solid)] backdrop-blur-xl border border-[var(--border-color)] rounded-2xl shadow-xl p-3.5 flex flex-col gap-3 cursor-default text-right">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2.5">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">تنظیمات گروه</span>
          <span className="font-sans font-bold theme-text-primary text-xs sm:text-sm truncate max-w-[140px]">
            {id}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            چیدمان ستون‌های قطعات
          </span>
          <LayoutSelector
            maxCols={maxCols}
            onColsChange={(cols) => {
              onColsChange(cols);
              setIsSettingsOpen(false);
            }}
            parentGroupsCols={3}
            fullWidth={true}
          />
        </div>

        <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-color)]">
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              onAddPlaceholder(id);
              setIsSettingsOpen(false);
            }}
            className="flex items-center justify-start gap-2 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl md:hover:bg-emerald-500/20 transition-colors w-full cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>افزودن جایگاه قطعه</span>
          </Button>

          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[var(--secondary)]">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 truncate">
              حذف کامل این گروه
            </span>
            <DeleteButton
              size="sm"
              resetAfter={0}
              onConfirm={() => {
                setIsSettingsOpen(false);
                onDeleteGroup(id);
              }}
              label={`حذف کامل گروه ${id}`}
            />
          </div>
        </div>
      </div>
    </m.div>
  );
}
