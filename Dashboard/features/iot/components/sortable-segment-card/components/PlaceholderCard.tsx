import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { m } from "motion/react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { GripVertical, Plus } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SPRING_LAYOUT, TRANSITION_EXIT_STANDARD } from "@/lib/ease";
import type { SegmentData } from "../core/types";

interface PlaceholderCardProps {
  segment: SegmentData;
  onRemove: (id: string) => void;
  onSetupPlaceholder?: (id: string) => void;
  attributes: DraggableAttributes | Record<string, string | number | boolean | undefined>;
  listeners: DraggableSyntheticListeners;
  isCompact: boolean;
  isUltraCompact: boolean;
  animationsEnabled?: boolean;
}

export default function PlaceholderCard({
  segment,
  onRemove,
  onSetupPlaceholder,
  attributes,
  listeners,
  isCompact,
  isUltraCompact,
  animationsEnabled = true,
}: PlaceholderCardProps) {
  return (
    <m.div
      className="w-full h-full relative"
      layout={animationsEnabled ? "position" : false}
      transition={animationsEnabled ? SPRING_LAYOUT : undefined}
      initial={animationsEnabled ? { opacity: 0, y: 12, scale: 0.97 } : false}
      animate={animationsEnabled ? { opacity: 1, y: 0, scale: 1 } : false}
      exit={
        animationsEnabled
          ? {
              opacity: 0,
              y: -10,
              scale: 0.97,
              transition: TRANSITION_EXIT_STANDARD,
            }
          : undefined
      }
    >
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                {...attributes}
                {...listeners}
                className="w-6 h-6 flex items-center justify-center bg-[var(--secondary)]/80 border border-[var(--border)] md:hover:bg-[var(--accent)] text-[var(--muted-foreground)] md:hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing transition-colors rounded-lg"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            }
          />
          <TooltipContent>کشیدن جایگاه</TooltipContent>
        </Tooltip>

        <DeleteButton
          size="xs"
          resetAfter={0}
          onPointerDown={(e) => e.stopPropagation()}
          onConfirm={() => onRemove(segment.id)}
          label="حذف جایگاه خالی"
        />
      </div>

      <Card className="w-full h-full !gap-0 !overflow-hidden !rounded-xl !border-dashed !border-[var(--border-color)] md:hover:!border-[var(--accent3)] !bg-[var(--card-bg)] !p-0 !ring-0 !shadow-none transition-colors duration-200 group/ph-card">
        <button
          type="button"
          onClick={() => onSetupPlaceholder?.(segment.id)}
          className={`relative w-full h-full border-0 bg-transparent flex flex-col items-center justify-center gap-2 cursor-pointer text-center rounded-xl overflow-hidden ${
            isUltraCompact
              ? "p-2.5 min-h-[78px]"
              : isCompact
                ? "p-3 min-h-[96px]"
                : "p-3.5 sm:p-4 min-h-[108px]"
          }`}
        >
          <div className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--accent3-transparent)] text-[var(--accent3)] border border-[var(--border-color)] md:group-hover/ph-card:bg-[var(--accent3)] md:group-hover/ph-card:text-[var(--accent3-foreground)] transition-colors">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </div>
          {!isUltraCompact && (
            <div className="relative z-10 flex flex-col items-center gap-0.5">
              <span className="block font-sans font-bold text-xs theme-text-primary">
                {isCompact ? "افزودن قطعه" : "تخصیص قطعه هوشمند"}
              </span>
              {!isCompact && (
                <span className="block text-[11px] text-[var(--text-muted)]">
                  کلیک برای انتخاب پایه و نوع قطعه
                </span>
              )}
            </div>
          )}
        </button>
      </Card>
    </m.div>
  );
}
