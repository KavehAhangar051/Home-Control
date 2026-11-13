import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { GripVertical } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SegmentData } from "../core/types";
import { useCardHeaderLayout } from "../hooks/useCardHeaderLayout";
import SegmentActions from "./SegmentActions";

interface CardHeaderProps {
  segment: SegmentData;
  isPinOn: boolean;
  isUltraCompact: boolean;
  isCompact: boolean;
  mode: "switch" | "push";
  onRemove: (id: string) => void;
  onUpdateSegmentMode?: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, autoOff: number) => void;
  countdown?: number | null;
  attributes: DraggableAttributes | Record<string, string | number | boolean | undefined>;
  listeners: DraggableSyntheticListeners;
  groupMaxCols?: number;
}

/**
 * Renders the floating top-left utility controls (drag handle and settings trigger)
 * as a sibling of the full-card Toggle button so dragging or opening settings
 * does not trigger the device relay.
 */
export default function CardHeader({
  segment,
  isPinOn,
  isUltraCompact,
  isCompact,
  mode,
  onRemove,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  countdown,
  attributes,
  listeners,
}: CardHeaderProps) {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    showAutoOffMenu,
    setShowAutoOffMenu,
    menuPosition,
    buttonRef,
    menuRef,
    autoOffButtonRef,
    autoOffMenuRef,
  } = useCardHeaderLayout(segment.id);

  const autoOffMenuProps = {
    showAutoOffMenu,
    setShowAutoOffMenu,
    autoOffButtonRef,
    autoOffMenuRef,
  };

  return (
    <div
      className={`absolute z-20 flex items-center gap-1 ${
        isUltraCompact ? "top-2 left-2" : "top-2.5 left-2.5"
      }`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <div
              {...attributes}
              {...listeners}
              className={`flex items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] md:hover:text-[var(--text-primary)] md:hover:bg-[var(--secondary)] md:hover:border-[var(--border-color)] cursor-grab active:cursor-grabbing transition-colors shrink-0 ${
                isUltraCompact ? "w-6 h-6" : "w-7 h-7"
              }`}
            >
              <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
          }
        />
        <TooltipContent>کشیدن برای جابه‌جایی</TooltipContent>
      </Tooltip>

      <SegmentActions
        segment={segment}
        isPinOn={isPinOn}
        isUltraCompact={isUltraCompact}
        isCompact={isCompact}
        onRemove={onRemove}
        onUpdateSegmentMode={onUpdateSegmentMode}
        onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
        mode={mode}
        countdown={countdown}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        menuPosition={menuPosition}
        buttonRef={buttonRef}
        menuRef={menuRef}
        autoOffMenuProps={autoOffMenuProps}
      />
    </div>
  );
}
