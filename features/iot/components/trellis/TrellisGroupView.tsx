"use client";

import { useView, useViewBadge, useViewTitle, useWorkspace } from "@danfessler/trellis-react";
import React from "react";
import { useShallow } from "zustand/react/shallow";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
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

  const activeCount = useIoTStore(
    React.useCallback(
      (state) => {
        let count = 0;

        for (const seg of groupSegments) {
          if (seg.type !== "placeholder" && seg.pin && state.pinsState[seg.pin]) {
            count += 1;
          }
        }

        return count;
      },
      [groupSegments],
    ),
  );

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
    <div
      dir="rtl"
      className="@container/trellis-group flex size-full flex-col overflow-hidden text-right"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-color bg-card-hover-bg/60 px-2.5 py-2 @sm/trellis-group:px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <div
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-color bg-card-bg text-text-secondary"
          >
            {groupIcon ? (
              hasIcon(groupIcon) ? (
                React.createElement(getSegmentIcon(groupIcon), {
                  className: "size-4",
                  strokeWidth: 1.5,
                })
              ) : (
                <span className="text-sm leading-none">{groupIcon}</span>
              )
            ) : (
              React.createElement(ICON_MAP.Layers, { className: "size-4", strokeWidth: 1.5 })
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-sans text-xs font-medium text-text-primary @sm/trellis-group:text-sm">
              {groupName}
            </h3>
            <span className="block text-[11px] font-normal tabular-nums text-text-muted">
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
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-card-bg px-2 text-xs font-medium text-text-primary transition-colors duration-150 md:hover:bg-accent3 md:hover:text-accent3-foreground"
                >
                  <Plus className="size-3.5 shrink-0" strokeWidth={1.75} />
                  <span className="hidden @xs/trellis-group:inline">قطعه</span>
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

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2.5 @sm/trellis-group:p-3">
        {groupSegments.length === 0 ? (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-color p-4 text-center text-xs text-text-muted">
            <span>هنوز قطعه‌ای در این گروه نیست</span>
            <button
              type="button"
              onClick={() => onAddPlaceholder(groupName)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-secondary px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent3"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              افزودن اولین قطعه
            </button>
          </div>
        ) : (
          <div className="grid auto-rows-fr content-start grid-cols-1 gap-2.5 @md/trellis-group:grid-cols-2 @md/trellis-group:gap-3 @3xl/trellis-group:grid-cols-3 @5xl/trellis-group:grid-cols-4">
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
