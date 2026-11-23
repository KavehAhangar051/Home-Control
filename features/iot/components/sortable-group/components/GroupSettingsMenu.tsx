import { Pencil } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { AuxNodeConfig } from "@/features/iot/services/config/types";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import LayoutSelector from "./LayoutSelector";

interface GroupSettingsMenuProps {
  id: string;
  isCompact: boolean;
  isMobile: boolean;
  maxCols: number;
  onColsChange: (cols: number) => void;
  onAddPlaceholder: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  setIsSettingsOpen: (open: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  auxNode?: AuxNodeConfig;
  onEditAuxNode?: () => void;
}

/**
 * Dropdown menu for managing a Smart Home group:
 * allows changing segment grid columns, adding a new segment slot,
 * or safely deleting the entire group.
 */
export default function GroupSettingsMenu({
  id,
  maxCols,
  onColsChange,
  onAddPlaceholder,
  onDeleteGroup,
  setIsSettingsOpen,
  menuRef,
  auxNode,
  onEditAuxNode,
}: GroupSettingsMenuProps) {
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);

  return (
    <m.div
      ref={menuRef}
      className="absolute top-[calc(100%+8px)] left-0 z-[100] origin-top-left"
      onPointerDown={(e) => e.stopPropagation()}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, scale: 0.96, y: -4, transition: TRANSITION_EXIT_QUICK }
      }
      transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_QUICK}
    >
      <div className="relative w-56 sm:w-64 transform-gpu bg-card-bg-solid border border-border-color rounded-2xl shadow-xl p-3.5 flex flex-col gap-3 cursor-default text-right">
        <div className="flex items-center justify-between border-b border-border-color pb-2.5">
          <span className="text-[11px] font-medium text-text-muted">تنظیمات گروه</span>
          <span className="font-sans font-bold text-text-primary text-xs sm:text-sm truncate max-w-[140px]">
            {id}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          <span className="text-[11px] font-semibold text-text-secondary">
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

        <div className="flex flex-col gap-1.5 pt-2 border-t border-border-color">
          {auxNode && onEditAuxNode && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setIsSettingsOpen(false);
                onEditAuxNode();
              }}
              className="flex items-center justify-start gap-2 px-3 py-2 text-xs font-bold text-accent3 bg-accent3/12 rounded-xl md:hover:bg-accent3/20 transition-colors w-full cursor-pointer"
            >
              <Pencil className="size-3.5 shrink-0" />
              <span>ویرایش برد کمکی (ESP)</span>
            </Button>
          )}

          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              onAddPlaceholder(id);
              setIsSettingsOpen(false);
            }}
            className="flex items-center justify-start gap-2 px-3 py-2 text-xs font-bold text-success bg-success-soft rounded-xl md:hover:bg-success/20 transition-colors w-full cursor-pointer"
          >
            <Plus className="size-4 shrink-0" />
            <span>افزودن جایگاه قطعه</span>
          </Button>

          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-secondary">
            <span className="text-xs font-bold text-destructive truncate">
              {auxNode ? "حذف برد کمکی و سگمنت‌ها" : "حذف کامل این گروه"}
            </span>
            <DeleteButton
              size="sm"
              resetAfter={0}
              onConfirm={() => {
                setIsSettingsOpen(false);
                onDeleteGroup(id);
              }}
              label={auxNode ? `حذف برد کمکی ${id}` : `حذف کامل گروه ${id}`}
            />
          </div>
        </div>
      </div>
    </m.div>
  );
}
