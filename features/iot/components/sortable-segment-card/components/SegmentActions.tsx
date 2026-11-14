import { AnimatePresence } from "motion/react";
import type React from "react";
import { Settings } from "@/components/ui/hugeicons";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SegmentData } from "../core/types";
import type { SegmentMenuPosition } from "../hooks/useCardHeaderLayout";
import SegmentSettingsMenu from "./SegmentSettingsMenu";

interface SegmentActionsProps {
  segment: SegmentData;
  isPinOn: boolean;
  isUltraCompact: boolean;
  isCompact: boolean;
  inHeaderBar?: boolean;
  onRemove: (id: string) => void;
  onUpdateSegmentMode?: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, autoOff: number) => void;
  mode: "switch" | "push";
  countdown?: number | null;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (val: boolean) => void;
  menuPosition: SegmentMenuPosition | null;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  autoOffMenuProps: {
    showAutoOffMenu: boolean;
    setShowAutoOffMenu: (val: boolean) => void;
    autoOffButtonRef: React.RefObject<HTMLButtonElement | null>;
    autoOffMenuRef: React.RefObject<HTMLDivElement | null>;
  };
}

/**
 * Renders the secondary utility trigger (settings & delete popover) on the
 * top-left corner of a segment card tile.
 */
export default function SegmentActions({
  segment,
  isPinOn,
  isUltraCompact,
  inHeaderBar = false,
  onRemove,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  mode,
  countdown,
  isSettingsOpen,
  setIsSettingsOpen,
  menuPosition,
  buttonRef,
  menuRef,
  autoOffMenuProps,
}: SegmentActionsProps) {
  const buttonSizeClass =
    inHeaderBar || isUltraCompact ? "h-6 w-6 min-w-6 p-0 px-0" : "h-7 w-7 min-w-7 p-0 px-0";

  return (
    <div className="relative flex items-center gap-1 shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              ref={buttonRef}
              variant="outline"
              size="sm"
              pressed={isSettingsOpen}
              onPressedChange={() => setIsSettingsOpen(!isSettingsOpen)}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              aria-label={`تنظیمات قطعه ${segment.title}`}
              aria-expanded={isSettingsOpen}
              className={`${inHeaderBar ? "rounded-md" : "rounded-lg"} transition-colors cursor-pointer ${buttonSizeClass} ${
                isSettingsOpen
                  ? "border-[var(--accent3)] text-[var(--accent3)] bg-[var(--accent3-transparent)] aria-pressed:bg-[var(--accent3-transparent)]"
                  : "border-transparent bg-transparent text-[var(--text-muted)] md:hover:text-[var(--text-primary)] md:hover:bg-[var(--secondary)] md:hover:border-[var(--border-color)]"
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
            </Toggle>
          }
        />
        <TooltipContent>تنظیمات و مدیریت قطعه</TooltipContent>
      </Tooltip>

      <AnimatePresence>
        {isSettingsOpen && (
          <SegmentSettingsMenu
            segment={segment}
            isSettingsOpen={isSettingsOpen}
            onCloseMenu={() => setIsSettingsOpen(false)}
            menuPosition={menuPosition}
            menuRef={menuRef}
            showIconInMenu={true}
            isPinOn={isPinOn}
            isUltraCompact={isUltraCompact}
            onRemove={onRemove}
            onUpdateSegmentMode={onUpdateSegmentMode}
            onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
            mode={mode}
            countdown={countdown}
            autoOffMenuProps={autoOffMenuProps}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
