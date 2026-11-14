"use client";

import { useView, useViewBadge, useViewTitle, useWorkspace } from "@danfessler/trellis-react";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { getSegmentIcon, hasIcon, ICON_MAP } from "@/features/iot/utils/icons";
import TrellisSegmentTile, { type TrellisSegmentHandlers } from "./TrellisSegmentTile";
import { segmentViewId } from "./trellisLayout";

export interface TrellisGroupViewParams {
  groupName: string;
}

interface TrellisGroupViewProps extends TrellisSegmentHandlers {
  animationsEnabled: boolean;
  onAddPlaceholder: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export default function TrellisGroupView({
  animationsEnabled,
  onAddPlaceholder,
  onDeleteGroup,
  onRemoveSegment,
  onTogglePin,
  onSetPinState,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  onSetupPlaceholder,
}: TrellisGroupViewProps) {
  const view = useView<TrellisGroupViewParams>();
  const ws = useWorkspace();
  const groupName = view.params.groupName;

  const groupSegments = useIoTStore(
    useShallow(
      React.useCallback(
        (state) => {
          const items: Segment[] = [];

          for (const seg of state.segments) {
            if ((seg.group || "Test") === groupName) {
              items.push(seg);
            }
          }

          return items;
        },
        [groupName],
      ),
    ),
  );

  const groupIcon = useIoTStore((s) => s.groupConfigs[groupName]?.icon);
  const pinsState = useIoTStore((s) => s.pinsState);

  let activeCount = 0;

  for (const seg of groupSegments) {
    if (seg.type !== "placeholder" && seg.pin && pinsState[seg.pin]) {
      activeCount += 1;
    }
  }

  useViewTitle(groupName);
  useViewBadge(activeCount > 0 ? activeCount : null);

  const handlePopOutSegment = React.useCallback(
    (seg: Segment) => {
      ws.open("segment", {
        id: segmentViewId(seg.id),
        params: { segmentId: seg.id },
        title: seg.type === "placeholder" ? `جایگاه خالی (${groupName})` : seg.title,
        placement: "float",
        reuse: "params",
      });
    },
    [ws, groupName],
  );

  const isCompactPanel = view.size.width < 320;

  return (
    <div dir="rtl" className="flex h-full w-full flex-col overflow-hidden text-right">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--card-hover-bg)]/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--accent3)]/20 bg-[var(--accent3-transparent)] text-[var(--accent3)]"
          >
            {groupIcon ? (
              hasIcon(groupIcon) ? (
                React.createElement(getSegmentIcon(groupIcon), { className: "h-4 w-4" })
              ) : (
                <span className="text-sm leading-none">{groupIcon}</span>
              )
            ) : (
              React.createElement(ICON_MAP.Layers, { className: "h-4 w-4" })
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-sans text-xs font-bold text-[var(--text-primary)] sm:text-sm">
              {groupName}
            </h3>
            <span className="block text-[10px] font-medium tabular-nums text-[var(--text-muted)]">
              {groupSegments.length} قطعه · {activeCount} فعال
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onAddPlaceholder(groupName)}
                  aria-label={`افزودن قطعه جدید به گروه ${groupName}`}
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--accent3)]/25 bg-[var(--accent3-transparent)] px-2 text-[11px] font-bold text-[var(--accent3)] transition-colors md:hover:bg-[var(--accent3)] md:hover:text-[var(--accent3-foreground)]"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  {!isCompactPanel && <span>قطعه</span>}
                </button>
              }
            />
            <TooltipContent>افزودن جایگاه قطعه جدید</TooltipContent>
          </Tooltip>

          <DeleteButton
            size="xs"
            left
            resetAfter={0}
            onConfirm={() => onDeleteGroup(groupName)}
            label={`حذف گروه ${groupName}`}
          />
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {groupSegments.length === 0 ? (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-color)] p-4 text-center text-xs text-[var(--text-muted)]">
            <span>هنوز قطعه‌ای در این گروه نیست.</span>
            <button
              type="button"
              onClick={() => onAddPlaceholder(groupName)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent3)]"
            >
              <Plus className="h-3.5 w-3.5" />
              افزودن اولین قطعه
            </button>
          </div>
        ) : (
          <div
            className="grid min-h-full auto-rows-fr gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            {groupSegments.map((segment) => (
              <TrellisSegmentTile
                key={segment.id}
                segment={segment}
                compact={isCompactPanel}
                animationsEnabled={animationsEnabled}
                onRemoveSegment={onRemoveSegment}
                onTogglePin={onTogglePin}
                onSetPinState={onSetPinState}
                onUpdateSegmentMode={onUpdateSegmentMode}
                onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
                onSetupPlaceholder={onSetupPlaceholder}
                onPopOutSegment={handlePopOutSegment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
