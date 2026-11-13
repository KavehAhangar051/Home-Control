import { m } from "motion/react";
import React from "react";
import { createPortal } from "react-dom";
import { DeleteButton } from "@/components/ui/delete-button";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import type { SegmentData } from "../core/types";
import type { SegmentMenuPosition } from "../hooks/useCardHeaderLayout";
import SegmentControls from "./SegmentControls";

interface SegmentSettingsMenuProps {
  segment: SegmentData;
  isSettingsOpen: boolean;
  onCloseMenu: () => void;
  menuPosition: SegmentMenuPosition | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  showIconInMenu: boolean;
  isPinOn: boolean;
  isUltraCompact: boolean;
  onRemove: (id: string) => void;
  onUpdateSegmentMode?: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, autoOff: number) => void;
  mode: "switch" | "push";
  countdown?: number | null;
  autoOffMenuProps: {
    showAutoOffMenu: boolean;
    setShowAutoOffMenu: (val: boolean) => void;
    autoOffButtonRef: React.RefObject<HTMLButtonElement | null>;
    autoOffMenuRef: React.RefObject<HTMLDivElement | null>;
  };
}

/**
 * Popover settings panel for an individual Smart Home device segment.
 * Portaled to document.body so it always stacks above all segment cards,
 * group containers, and Trellis panels without clipping.
 */
export default function SegmentSettingsMenu({
  segment,
  isSettingsOpen,
  onCloseMenu,
  menuPosition,
  menuRef,
  isPinOn,
  onRemove,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  mode,
  countdown,
  autoOffMenuProps,
}: SegmentSettingsMenuProps) {
  if (!isSettingsOpen || typeof document === "undefined") return null;

  const isPositioned = menuPosition !== null;
  const initialOffsetY = menuPosition?.placement === "top" ? 4 : -4;

  const menuNode = (
    <m.div
      ref={menuRef}
      dir="rtl"
      className="fixed z-[180]"
      style={{
        top: menuPosition ? `${menuPosition.top}px` : "-9999px",
        left: menuPosition ? `${menuPosition.left}px` : "-9999px",
        visibility: isPositioned ? "visible" : "hidden",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.96, y: initialOffsetY }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: initialOffsetY }}
      transition={{ duration: 0.16, ease: "easeOut" }}
    >
      <div className="relative w-[256px] sm:w-[280px] bg-[var(--card-bg-solid)] backdrop-blur-xl border border-[var(--border-color)] rounded-2xl shadow-xl p-3.5 flex flex-col gap-3 cursor-default text-right">
        {/* Segment Identity & Pin Metadata */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isPinOn
                  ? "bg-[var(--accent3-transparent)] text-[var(--accent3)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
              aria-hidden="true"
            >
              {segment.icon && !hasIcon(segment.icon) ? (
                <span className="text-xs leading-none flex items-center justify-center w-4 h-4">
                  {segment.icon}
                </span>
              ) : (
                React.createElement(getSegmentIcon(segment.icon), { className: "w-4 h-4" })
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-sans font-bold theme-text-primary text-xs truncate">
                {segment.title}
              </span>
              <span className="block text-[10px] tabular-nums text-[var(--text-muted)]">
                پایه {segment.pin} · {isPinOn ? "روشن" : "خاموش"}
              </span>
            </div>
          </div>
        </div>

        {/* Mode & Auto-Off Timer Controls */}
        {onUpdateSegmentMode && segment.type !== "input" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              حالت کلید و تایمر خودکار
            </span>
            <div className="flex items-center justify-between bg-[var(--secondary)] rounded-xl p-2 border border-[var(--border-color)]">
              <SegmentControls
                segment={segment}
                mode={mode}
                onUpdateSegmentMode={onUpdateSegmentMode}
                onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
                countdown={countdown}
                {...autoOffMenuProps}
              />
            </div>
          </div>
        )}

        {/* Destructive Action */}
        <div className="pt-1.5 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[var(--secondary)]">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 truncate">
              حذف این قطعه از داشبورد
            </span>
            <DeleteButton
              size="sm"
              resetAfter={0}
              onConfirm={() => {
                onCloseMenu();
                onRemove(segment.id);
              }}
              label={`حذف قطعه ${segment.title}`}
            />
          </div>
        </div>
      </div>
    </m.div>
  );

  return createPortal(menuNode, document.body);
}
