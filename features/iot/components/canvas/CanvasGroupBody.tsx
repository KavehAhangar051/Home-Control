"use client";

import { Power, PowerOff } from "lucide-react";
import { Plus } from "@/components/ui/hugeicons";
import TrellisSegmentTile from "@/features/iot/components/trellis/TrellisSegmentTile";
import type { Segment } from "@/features/iot/hooks/store/types";
import type { CanvasGroupHandlers, CanvasSubMode } from "./canvasTypes";

interface CanvasGroupBodyProps extends Omit<CanvasGroupHandlers, "onDeleteGroup"> {
  groupName: string;
  groupSegments: Segment[];
  subMode: CanvasSubMode;
  activeCount: number;
  controllableCount: number;
  isCompactContainer: boolean;
  animationsEnabled: boolean;
}

/**
 * Renders either the n8n hub batch power controls ("graph" mode) or the scrollable
 * segment tile grid ("groups" mode) inside a canvas group node.
 */
export default function CanvasGroupBody({
  groupName,
  groupSegments,
  subMode,
  activeCount,
  controllableCount,
  isCompactContainer,
  animationsEnabled,
  onAddPlaceholder,
  onRemoveSegment,
  onTogglePin,
  onSetPinState,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  onSetupPlaceholder,
}: CanvasGroupBodyProps) {
  const handleBatchGroupPower = (turnOn: boolean) => {
    for (const seg of groupSegments) {
      if (seg.type !== "placeholder" && seg.type !== "input" && seg.pin) {
        onSetPinState(seg.pin, turnOn);
      }
    }
  };

  if (subMode === "graph") {
    return (
      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span>گره مرکزی گروه (n8n)</span>
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-accent3">
            {activeCount} / {groupSegments.length} روشن
          </span>
        </div>

        {controllableCount > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleBatchGroupPower(true)}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-accent3/30 bg-accent3-transparent px-2.5 text-xs font-bold text-accent3 transition-colors hover:bg-accent3 hover:text-accent3-foreground"
            >
              <Power className="size-3.5" aria-hidden="true" />
              <span>روشن همه</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchGroupPower(false)}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-secondary px-2.5 text-xs font-semibold text-text-secondary transition-colors hover:border-accent3 hover:text-text-primary"
            >
              <PowerOff className="size-3.5" aria-hidden="true" />
              <span>خاموش همه</span>
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">
            قطعات این گروه روی شیت به این گره متصل هستند.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      data-canvas-scroll-area="true"
      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3"
    >
      {groupSegments.length === 0 ? (
        <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-color p-3 text-center text-xs text-text-muted">
          <span>قطعه‌ای در این گروه نیست.</span>
          <button
            type="button"
            onClick={() => onAddPlaceholder(groupName)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-secondary px-2.5 py-1 text-xs font-semibold text-text-primary"
          >
            <Plus className="size-3.5" />
            افزودن قطعه
          </button>
        </div>
      ) : (
        <div
          className="grid min-h-full auto-rows-fr gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          {groupSegments.map((seg) => (
            <TrellisSegmentTile
              key={seg.id}
              segment={seg}
              compact={isCompactContainer}
              animationsEnabled={animationsEnabled}
              onRemoveSegment={onRemoveSegment}
              onTogglePin={onTogglePin}
              onSetPinState={onSetPinState}
              onUpdateSegmentMode={onUpdateSegmentMode}
              onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
              onSetupPlaceholder={onSetupPlaceholder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
