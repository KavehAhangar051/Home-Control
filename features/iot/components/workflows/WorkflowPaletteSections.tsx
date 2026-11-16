"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { getSegmentIcon } from "@/features/iot/utils/icons";
import { WorkflowSchematicSymbol } from "./WorkflowSchematicSymbols";
import { type PaletteSymbolEntry, startPaletteDrag } from "./workflowPaletteData";
import type { WorkflowPaletteDragPayload } from "./workflowTypes";

interface PaletteSymbolSectionProps {
  title: string;
  entries: PaletteSymbolEntry[];
  monospaceTitle?: boolean;
  onAddNode: (payload: WorkflowPaletteDragPayload) => void;
}

export function PaletteSymbolSection({
  title,
  entries,
  monospaceTitle = false,
  onAddNode,
}: PaletteSymbolSectionProps) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-1.5">
      <h3 className="px-0.5 text-[10px] font-bold text-[var(--text-secondary)]">{title}</h3>

      <div className="space-y-1.5">
        {entries.map((entry) => (
          <button
            key={entry.payload.kind}
            type="button"
            draggable
            onDragStart={(e) => startPaletteDrag(e, entry.payload)}
            onClick={() => onAddNode(entry.payload)}
            className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/50 px-3 py-2 text-right transition-[border-color,background-color,transform] duration-150 hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)] active:scale-[0.98]"
          >
            <span
              dir={monospaceTitle ? "ltr" : undefined}
              className={`truncate text-xs font-bold text-[var(--text-primary)] ${
                monospaceTitle ? "font-mono" : ""
              }`}
            >
              {entry.title}
            </span>

            <span
              dir="ltr"
              className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] text-[var(--text-primary)] transition-colors group-hover:border-[var(--accent3)]/50 group-hover:text-[var(--accent3)]"
            >
              <WorkflowSchematicSymbol kind={entry.payload.kind} className="h-6 w-11" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

interface PaletteGroupsSectionProps {
  showCustomGroup: boolean;
  filteredGroups: string[];
  groupCounts: Map<string, number>;
  onAddNode: (payload: WorkflowPaletteDragPayload) => void;
}

export function PaletteGroupsSection({
  showCustomGroup,
  filteredGroups,
  groupCounts,
  onAddNode,
}: PaletteGroupsSectionProps) {
  if (!showCustomGroup && filteredGroups.length === 0) return null;

  return (
    <section className="space-y-1.5">
      <h3 className="px-0.5 text-[10px] font-bold text-[var(--text-secondary)]">گروه‌ها</h3>

      <div className="space-y-1.5">
        {showCustomGroup && (
          <button
            type="button"
            draggable
            onDragStart={(e) => startPaletteDrag(e, { kind: "group", isCustomGroup: true })}
            onClick={() => onAddNode({ kind: "group", isCustomGroup: true })}
            className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-main)]/40 px-3 py-2 text-right transition-[border-color,background-color,transform] duration-150 hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)] active:scale-[0.98]"
          >
            <span className="truncate text-xs font-bold text-[var(--text-primary)]">
              گروه سفارشی
            </span>

            <span
              dir="ltr"
              className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--card-bg-solid)] text-[var(--text-secondary)] transition-colors group-hover:border-[var(--accent3)]/50 group-hover:text-[var(--accent3)]"
            >
              <WorkflowSchematicSymbol kind="group" isCustomGroup className="h-6 w-11" />
            </span>
          </button>
        )}

        {filteredGroups.map((groupName) => {
          const count = groupCounts.get(groupName) ?? 0;

          return (
            <button
              key={groupName}
              type="button"
              draggable
              onDragStart={(e) =>
                startPaletteDrag(e, { kind: "group", groupName, isCustomGroup: false })
              }
              onClick={() => onAddNode({ kind: "group", groupName, isCustomGroup: false })}
              className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/50 px-3 py-2 text-right transition-[border-color,background-color,transform] duration-150 hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)] active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[var(--text-primary)]">
                  گروه {groupName}
                </span>
                <span className="block text-[10px] tabular-nums text-[var(--text-muted)]">
                  {count} قطعه
                </span>
              </span>

              <span
                dir="ltr"
                className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] text-[var(--text-primary)] transition-colors group-hover:border-[var(--accent3)]/50 group-hover:text-[var(--accent3)]"
              >
                <WorkflowSchematicSymbol kind="group" className="h-6 w-11" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface PaletteSegmentsSectionProps {
  activeSegments: Segment[];
  query: string;
  normalizedQuery: string;
  onAddNode: (payload: WorkflowPaletteDragPayload) => void;
}

export function PaletteSegmentsSection({
  activeSegments,
  query,
  normalizedQuery,
  onAddNode,
}: PaletteSegmentsSectionProps) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5 text-[10px] text-[var(--text-muted)]">
        <h3 className="font-bold text-[var(--text-secondary)]">قطعات و پایه‌های سخت‌افزاری</h3>
        <span className="tabular-nums">{activeSegments.length} قطعه</span>
      </div>

      {activeSegments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-3 text-center text-[11px] leading-5 text-[var(--text-muted)]">
          {normalizedQuery
            ? `قطعه‌ای با عبارت «${query}» پیدا نشد.`
            : "هنوز قطعه‌ای تعریف نشده است. از بخش «پالایه و ماژول‌ها» قطعه جدید بسازید."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {activeSegments.map((seg) => (
            <button
              key={seg.id}
              type="button"
              draggable
              onDragStart={(e) => startPaletteDrag(e, { kind: "segment", segmentId: seg.id })}
              onClick={() => onAddNode({ kind: "segment", segmentId: seg.id })}
              className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/50 px-3 py-2 text-right transition-[border-color,background-color,transform] duration-150 hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)] active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-[var(--text-primary)]">
                  {seg.title}
                </span>
                <span
                  dir="ltr"
                  className="mt-0.5 inline-block font-mono text-[10px] font-semibold tabular-nums text-[var(--text-muted)] group-hover:text-[var(--accent3)]"
                >
                  GPIO {seg.pin}
                </span>
              </span>

              <span
                dir="ltr"
                className="relative flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--card-bg-solid)] text-[var(--text-primary)] transition-colors group-hover:border-[var(--accent3)]/50 group-hover:text-[var(--accent3)]"
              >
                <WorkflowSchematicSymbol
                  kind="segment"
                  isInputSegment={seg.type === "input"}
                  className="h-6 w-11"
                />
                {React.createElement(getSegmentIcon(seg.icon), {
                  className:
                    "absolute right-1 bottom-1 h-2.5 w-2.5 text-[var(--text-muted)] group-hover:text-[var(--accent3)]",
                  "aria-hidden": true,
                })}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
