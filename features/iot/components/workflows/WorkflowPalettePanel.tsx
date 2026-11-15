"use client";

import { Search, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { getSegmentIcon } from "@/features/iot/utils/icons";
import { DURATION, EASE_DRAWER, EASE_IN, EXIT_DURATION, SPRING_LAYOUT } from "@/lib/ease";
import { WorkflowSchematicSymbol } from "./WorkflowSchematicSymbols";
import type { WorkflowPaletteDragPayload } from "./workflowTypes";

export const WORKFLOW_PALETTE_MIME = "application/x-iot-workflow-node";

interface WorkflowPalettePanelProps {
  isOpen: boolean;
  onClose: () => void;
  segments: Segment[];
  groupsOrder: string[];
  animationsEnabled?: boolean;
  onAddNode: (payload: WorkflowPaletteDragPayload) => void;
}

type PaletteCategoryFilter = "all" | "logic" | "groups" | "segments";

interface PaletteSymbolEntry {
  payload: WorkflowPaletteDragPayload;
  title: string;
  searchKeywords: string[];
}

const LOGIC_GATE_ENTRIES: readonly PaletteSymbolEntry[] = [
  {
    payload: { kind: "logic_and" },
    title: "AND",
    searchKeywords: ["and", "گیت", "منطق", "و"],
  },
  {
    payload: { kind: "logic_or" },
    title: "OR",
    searchKeywords: ["or", "گیت", "منطق", "یا"],
  },
  {
    payload: { kind: "logic_not" },
    title: "NOT",
    searchKeywords: ["not", "گیت", "وارونگر", "معکوس"],
  },
];

const CONTROL_ENTRIES: readonly PaletteSymbolEntry[] = [
  {
    payload: { kind: "trigger_manual" },
    title: "شستی دستی",
    searchKeywords: ["شستی", "دستی", "پالس", "manual"],
  },
  {
    payload: { kind: "trigger_schedule" },
    title: "زمان‌بندی",
    searchKeywords: ["زمان‌بندی", "ساعت", "schedule", "clock"],
  },
  {
    payload: { kind: "timer" },
    title: "تایمر",
    searchKeywords: ["تایمر", "تاخیر", "timer", "delay"],
  },
];

function startPaletteDrag(
  e: React.DragEvent<HTMLElement>,
  payload: WorkflowPaletteDragPayload,
): void {
  e.dataTransfer.setData(WORKFLOW_PALETTE_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "copy";
}

export default function WorkflowPalettePanel({
  isOpen,
  onClose,
  segments,
  groupsOrder,
  animationsEnabled = true,
  onAddNode,
}: WorkflowPalettePanelProps) {
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<PaletteCategoryFilter>("all");
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimateMotion = animationsEnabled && !prefersReducedMotion;
  const normalizedQuery = query.trim().toLowerCase();

  const matchesSearch = React.useCallback(
    (fields: string[]) => {
      if (!normalizedQuery) return true;

      for (const f of fields) {
        if (f.toLowerCase().includes(normalizedQuery)) return true;
      }

      return false;
    },
    [normalizedQuery],
  );

  const filteredGates = React.useMemo(
    () => LOGIC_GATE_ENTRIES.filter((item) => matchesSearch([item.title, ...item.searchKeywords])),
    [matchesSearch],
  );

  const filteredControls = React.useMemo(
    () => CONTROL_ENTRIES.filter((item) => matchesSearch([item.title, ...item.searchKeywords])),
    [matchesSearch],
  );

  const activeSegments = React.useMemo(() => {
    const list: Segment[] = [];

    for (const seg of segments) {
      if (seg.type === "placeholder") continue;

      if (matchesSearch([seg.title, seg.group || "Test", seg.pin, `gpio ${seg.pin}`])) {
        list.push(seg);
      }
    }

    return list;
  }, [segments, matchesSearch]);

  const groupCounts = React.useMemo(() => {
    const map = new Map<string, number>();

    for (const groupName of groupsOrder) {
      map.set(groupName, 0);
    }

    for (const seg of segments) {
      if (seg.type === "placeholder") continue;

      const key = seg.group || "Test";
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return map;
  }, [groupsOrder, segments]);

  const filteredGroups = React.useMemo(
    () => groupsOrder.filter((g) => matchesSearch([g, `گروه ${g}`, "group"])),
    [groupsOrder, matchesSearch],
  );

  const showCustomGroup = matchesSearch(["گروه سفارشی", "group"]);

  const showLogicSection = categoryFilter === "all" || categoryFilter === "logic";
  const showGroupsSection = categoryFilter === "all" || categoryFilter === "groups";
  const showSegmentsSection = categoryFilter === "all" || categoryFilter === "segments";

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <m.aside
          key="workflow-palette-drawer"
          dir="rtl"
          aria-label="کتابخانه شماتیک گره‌ها"
          initial={animationsEnabled ? { opacity: 0, x: shouldAnimateMotion ? "-100%" : 0 } : false}
          animate={{
            opacity: 1,
            x: 0,
            transition: {
              duration: animationsEnabled ? DURATION.standard : 0,
              ease: EASE_DRAWER,
            },
          }}
          exit={
            animationsEnabled
              ? {
                  opacity: 0,
                  x: shouldAnimateMotion ? "-100%" : 0,
                  transition: {
                    duration: EXIT_DURATION.standard,
                    ease: EASE_IN,
                  },
                }
              : undefined
          }
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          className="absolute top-12 bottom-0 left-0 z-30 flex w-[288px] max-w-[86vw] flex-col border-r border-[var(--border-color)] bg-[var(--card-bg-solid)]/95 shadow-xl backdrop-blur-xl"
        >
          {/* Header + Search + Category Tabs */}
          <div className="shrink-0 space-y-2.5 border-b border-[var(--border-color)] p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-xs font-bold text-[var(--text-primary)]">
                کتابخانه قطعات و گیت‌ها
              </h2>

              <button
                type="button"
                onClick={onClose}
                aria-label="بستن کتابخانه گره‌ها"
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--text-muted)] transition-[color,background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] active:scale-[0.97] md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="جستجو در کتابخانه گره‌ها"
                placeholder="جستجو..."
                className="h-8 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] pr-8 pl-2.5 text-[11px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent3)]"
              />
            </div>

            {/* Clean Segmented Filter Control with Shared-Layout Pill */}
            <div
              role="tablist"
              aria-label="دسته‌بندی گره‌ها"
              className="grid grid-cols-4 gap-1 rounded-lg bg-[var(--bg-main)] p-1"
            >
              {(
                [
                  { id: "all", label: "همه" },
                  { id: "logic", label: "گیت و منطق" },
                  { id: "groups", label: "گروه‌ها" },
                  { id: "segments", label: "قطعات" },
                ] as const
              ).map((tab) => {
                const active = categoryFilter === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`relative h-6 cursor-pointer truncate rounded-md px-1.5 text-[10px] font-semibold whitespace-nowrap transition-[color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.97] ${
                      active
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {active && (
                      <m.span
                        layoutId={
                          shouldAnimateMotion ? "workflow-palette-category-pill" : undefined
                        }
                        transition={SPRING_LAYOUT}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md bg-[var(--card-bg-solid)] shadow-xs"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Schematic Library List */}
          <div
            data-canvas-scroll-area="true"
            className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3"
          >
            {/* 1. Logic Gates */}
            {showLogicSection && filteredGates.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="px-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  گیت‌های منطقی
                </h3>

                <div className="space-y-1.5">
                  {filteredGates.map((entry) => (
                    <button
                      key={entry.payload.kind}
                      type="button"
                      draggable
                      onDragStart={(e) => startPaletteDrag(e, entry.payload)}
                      onClick={() => onAddNode(entry.payload)}
                      className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/50 px-3 py-2 text-right transition-[border-color,background-color,transform] duration-150 hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)] active:scale-[0.98]"
                    >
                      <span
                        dir="ltr"
                        className="truncate font-mono text-xs font-bold text-[var(--text-primary)]"
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
            )}

            {/* 2. Triggers & Timing */}
            {showLogicSection && filteredControls.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="px-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  محرک‌ها و زمان‌بندی
                </h3>

                <div className="space-y-1.5">
                  {filteredControls.map((entry) => (
                    <button
                      key={entry.payload.kind}
                      type="button"
                      draggable
                      onDragStart={(e) => startPaletteDrag(e, entry.payload)}
                      onClick={() => onAddNode(entry.payload)}
                      className="group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/50 px-3 py-2 text-right transition-[border-color,background-color,transform] duration-150 hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)] active:scale-[0.98]"
                    >
                      <span className="truncate text-xs font-bold text-[var(--text-primary)]">
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
            )}

            {/* 3. Subcircuit Group Blocks */}
            {showGroupsSection && (showCustomGroup || filteredGroups.length > 0) && (
              <section className="space-y-1.5">
                <h3 className="px-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  گروه‌ها
                </h3>

                <div className="space-y-1.5">
                  {showCustomGroup && (
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) =>
                        startPaletteDrag(e, { kind: "group", isCustomGroup: true })
                      }
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
                        onClick={() =>
                          onAddNode({ kind: "group", groupName, isCustomGroup: false })
                        }
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
            )}

            {/* 4. Hardware Segments & GPIO Terminals */}
            {showSegmentsSection && (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5 text-[10px] text-[var(--text-muted)]">
                  <h3 className="font-bold text-[var(--text-secondary)]">
                    قطعات و پایه‌های سخت‌افزاری
                  </h3>
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
                    {activeSegments.map((seg) => {
                      const SegIcon = getSegmentIcon(seg.icon);
                      const isInput = seg.type === "input";

                      return (
                        <button
                          key={seg.id}
                          type="button"
                          draggable
                          onDragStart={(e) =>
                            startPaletteDrag(e, { kind: "segment", segmentId: seg.id })
                          }
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
                              isInputSegment={isInput}
                              className="h-6 w-11"
                            />
                            <SegIcon
                              className="absolute right-1 bottom-1 h-2.5 w-2.5 text-[var(--text-muted)] group-hover:text-[var(--accent3)]"
                              aria-hidden="true"
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
