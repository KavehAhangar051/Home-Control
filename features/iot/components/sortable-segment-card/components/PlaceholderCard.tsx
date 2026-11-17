import type { RefCallback } from "react";
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
  handleRef?: RefCallback<HTMLElement>;
  isCompact: boolean;
  isUltraCompact: boolean;
  animationsEnabled?: boolean;
}

export default function PlaceholderCard({
  segment,
  onRemove,
  onSetupPlaceholder,
  handleRef,
  isCompact,
  isUltraCompact,
  animationsEnabled = true,
}: PlaceholderCardProps) {
  return (
    <m.div
      className="size-full relative"
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
      <div className="absolute top-2 end-2 z-20 flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                ref={handleRef}
                className="size-6 flex items-center justify-center bg-secondary/80 border border-border md:hover:bg-accent text-muted-foreground md:hover:text-foreground cursor-grab active:cursor-grabbing transition-colors rounded-lg"
              >
                <GripVertical className="size-3.5" />
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

      <Card className="@container/segment size-full !gap-0 !overflow-hidden !rounded-xl !border-dashed !border-border-color md:hover:!border-accent3 !bg-card-bg !p-0 !ring-0 !shadow-none transition-colors duration-200 group/ph-card">
        <button
          type="button"
          onClick={() => onSetupPlaceholder?.(segment.id)}
          className={`relative size-full border-0 bg-transparent flex flex-col items-center justify-center gap-2 cursor-pointer text-center rounded-xl overflow-hidden ${
            isUltraCompact
              ? "p-2.5 min-h-[78px]"
              : isCompact
                ? "p-3 min-h-[96px]"
                : "p-3.5 sm:p-4 min-h-[108px]"
          }`}
        >
          <div className="relative z-10 size-9 rounded-lg flex items-center justify-center bg-secondary text-text-secondary border border-border-color md:group-hover/ph-card:bg-accent3 md:group-hover/ph-card:text-accent3-foreground transition-colors duration-150">
            <Plus className="size-4" strokeWidth={1.5} />
          </div>
          {!isUltraCompact && (
            <div className="relative z-10 flex flex-col items-center gap-0.5">
              <span className="block font-sans font-medium text-xs text-text-primary">
                {isCompact ? "افزودن قطعه" : "تخصیص قطعه هوشمند"}
              </span>
              {!isCompact && (
                <span className="block text-xs text-text-muted">انتخاب پایه و نوع قطعه</span>
              )}
            </div>
          )}
        </button>
      </Card>
    </m.div>
  );
}
