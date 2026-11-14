"use client";

import {
  Clock,
  Cpu,
  FolderPlus,
  GitBranch,
  Layers,
  Play,
  Plus,
  Search,
  Timer,
  X,
} from "lucide-react";
import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { getSegmentIcon } from "@/features/iot/utils/icons";
import type { WorkflowPaletteDragPayload } from "./workflowTypes";

export const WORKFLOW_PALETTE_MIME = "application/x-iot-workflow-node";

interface WorkflowPalettePanelProps {
  isOpen: boolean;
  onClose: () => void;
  segments: Segment[];
  groupsOrder: string[];
  onAddNode: (payload: WorkflowPaletteDragPayload) => void;
}

interface PaletteLogicEntry {
  payload: WorkflowPaletteDragPayload;
  title: string;
  subtitle: string;
  badgeText: string;
  toneClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const LOGIC_NODES: readonly PaletteLogicEntry[] = [
  {
    payload: { kind: "trigger_manual" },
    title: "شروع دستی (Trigger)",
    subtitle: "ارسال پالس اجرا به گره‌های بعدی",
    badgeText: "RUN",
    toneClass: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
    Icon: Play,
  },
  {
    payload: { kind: "trigger_schedule" },
    title: "زمان‌بندی (Schedule)",
    subtitle: "اجرا در ساعت و روزهای مشخص",
    badgeText: "CRON",
    toneClass: "text-sky-500 border-sky-500/30 bg-sky-500/10",
    Icon: Clock,
  },
  {
    payload: { kind: "logic_and" },
    title: "بوابه AND (و منطقی)",
    subtitle: "برقرار وقتی همه ورودی‌ها فعال باشند",
    badgeText: "AND",
    toneClass: "text-[var(--accent3)] border-[var(--accent3)]/30 bg-[var(--accent3-transparent)]",
    Icon: GitBranch,
  },
  {
    payload: { kind: "logic_or" },
    title: "بوابه OR (یا منطقی)",
    subtitle: "برقرار وقتی حداقل یک ورودی فعال باشد",
    badgeText: "OR",
    toneClass: "text-amber-500 border-amber-500/30 bg-amber-500/10",
    Icon: GitBranch,
  },
  {
    payload: { kind: "logic_not" },
    title: "بوابه NOT (نقیض)",
    subtitle: "معکوس‌کننده سیگنال ورودی",
    badgeText: "NOT",
    toneClass: "text-rose-500 border-rose-500/30 bg-rose-500/10",
    Icon: GitBranch,
  },
  {
    payload: { kind: "timer" },
    title: "تایمر / تاخیر (Timer)",
    subtitle: "تاخیر یا نگه‌داری زمان‌دار فرمان",
    badgeText: "SEC",
    toneClass: "text-violet-500 border-violet-500/30 bg-violet-500/10",
    Icon: Timer,
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
  onAddNode,
}: WorkflowPalettePanelProps) {
  const [query, setQuery] = React.useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const activeSegments = React.useMemo(() => {
    const list: Segment[] = [];

    for (const seg of segments) {
      if (seg.type === "placeholder") continue;

      if (
        !normalizedQuery ||
        seg.title.toLowerCase().includes(normalizedQuery) ||
        (seg.group || "").toLowerCase().includes(normalizedQuery) ||
        seg.pin.toLowerCase().includes(normalizedQuery)
      ) {
        list.push(seg);
      }
    }

    return list;
  }, [segments, normalizedQuery]);

  const filteredLogic = React.useMemo(() => {
    if (!normalizedQuery) return LOGIC_NODES;

    const matched: PaletteLogicEntry[] = [];

    for (const item of LOGIC_NODES) {
      if (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.subtitle.toLowerCase().includes(normalizedQuery) ||
        item.badgeText.toLowerCase().includes(normalizedQuery)
      ) {
        matched.push(item);
      }
    }

    return matched;
  }, [normalizedQuery]);

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

  const filteredGroups = React.useMemo(() => {
    const list: string[] = [];

    for (const g of groupsOrder) {
      if (!normalizedQuery || g.toLowerCase().includes(normalizedQuery)) {
        list.push(g);
      }
    }

    return list;
  }, [groupsOrder, normalizedQuery]);

  if (!isOpen) return null;

  return (
    <aside
      dir="rtl"
      aria-label="پنل گره‌ها و سگمنت‌های گردش کار"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-12 bottom-0 left-0 z-30 flex w-[272px] max-w-[85vw] flex-col border-r border-[var(--border-color)] bg-[var(--card-bg-solid)]/95 shadow-xl backdrop-blur-xl"
    >
      {/* Header + Search */}
      <div className="shrink-0 space-y-2.5 border-b border-[var(--border-color)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-xs font-bold text-[var(--text-primary)]">
              کتابخانه گره‌ها
            </h2>
            <p className="truncate text-[10px] text-[var(--text-muted)]">
              کلیک کنید یا روی بوم بکشید
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنل گره‌ها"
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] md:hidden"
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
            placeholder="جستجوی سگمنت، گروه، AND..."
            className="h-8 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] pr-8 pl-2.5 text-[11px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent3)]"
          />
        </div>
      </div>

      {/* Scrollable Sections */}
      <div
        data-canvas-scroll-area="true"
        className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3"
      >
        {/* 1. Logic, Triggers & Timers */}
        {filteredLogic.length > 0 && (
          <section className="space-y-1.5">
            <h3 className="px-1 text-[10px] font-bold text-[var(--text-muted)]">
              منطق، شروع‌کننده و تایمر
            </h3>

            <div className="space-y-1">
              {filteredLogic.map((entry) => {
                const Icon = entry.Icon;

                return (
                  <button
                    key={entry.payload.kind}
                    type="button"
                    draggable
                    onDragStart={(e) => startPaletteDrag(e, entry.payload)}
                    onClick={() => onAddNode(entry.payload)}
                    className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border-color)]/70 bg-[var(--bg-main)]/65 p-2 text-right transition-colors hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)]"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${entry.toneClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold text-[var(--text-primary)]">
                        {entry.title}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--text-muted)]">
                        {entry.subtitle}
                      </span>
                    </span>

                    <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-60 group-hover:text-[var(--accent3)] group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. Group Nodes (Empty Custom + Pre-filled from Modules) */}
        <section className="space-y-1.5">
          <h3 className="px-1 text-[10px] font-bold text-[var(--text-muted)]">
            گره‌های گروه (خالی و آماده)
          </h3>

          <div className="space-y-1">
            {(!normalizedQuery || "گروه خالی سفارشی".includes(normalizedQuery)) && (
              <button
                type="button"
                draggable
                onDragStart={(e) => startPaletteDrag(e, { kind: "group", isCustomGroup: true })}
                onClick={() => onAddNode({ kind: "group", isCustomGroup: true })}
                className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-[var(--accent3)]/45 bg-[var(--accent3-transparent)]/50 p-2 text-right transition-colors hover:border-[var(--accent3)] hover:bg-[var(--accent3-transparent)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--accent3)]/30 bg-[var(--card-bg-solid)] text-[var(--accent3)]">
                  <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold text-[var(--text-primary)]">
                    گره گروه خالی (سفارشی)
                  </span>
                  <span className="block truncate text-[10px] text-[var(--text-muted)]">
                    با سگمنت‌های دلخواه داخل بوم پر کنید
                  </span>
                </span>

                <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--accent3)]" />
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
                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border-color)]/70 bg-[var(--bg-main)]/65 p-2 text-right transition-colors hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] text-[var(--accent3)]">
                    <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-[var(--text-primary)]">
                      گروه {groupName}
                    </span>
                    <span className="block truncate text-[10px] tabular-nums text-[var(--text-muted)]">
                      پر شده با {count} سگمنت از پالایه
                    </span>
                  </span>

                  <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-60 group-hover:text-[var(--accent3)] group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Project Segments */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-[var(--text-muted)]">سگمنت‌های پروژه</h3>
            <span className="text-[10px] tabular-nums text-[var(--text-muted)]">
              {activeSegments.length} مورد
            </span>
          </div>

          {activeSegments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border-color)] p-3 text-center text-[11px] leading-5 text-[var(--text-muted)]">
              سگمنتی یافت نشد. از بخش «پالایه و ماژول‌ها» سگمنت اضافه کنید.
            </p>
          ) : (
            <div className="space-y-1">
              {activeSegments.map((seg) => {
                const SegIcon = getSegmentIcon(seg.icon);

                return (
                  <button
                    key={seg.id}
                    type="button"
                    draggable
                    onDragStart={(e) => startPaletteDrag(e, { kind: "segment", segmentId: seg.id })}
                    onClick={() => onAddNode({ kind: "segment", segmentId: seg.id })}
                    className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border-color)]/70 bg-[var(--bg-main)]/65 p-2 text-right transition-colors hover:border-[var(--accent3)] hover:bg-[var(--card-hover-bg)]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] text-[var(--text-secondary)] group-hover:text-[var(--accent3)]">
                      <SegIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold text-[var(--text-primary)]">
                        {seg.title}
                      </span>
                      <span className="flex items-center gap-1 truncate text-[10px] tabular-nums text-[var(--text-muted)]">
                        <Cpu className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {seg.group || "Test"} · پایه {seg.pin}
                        </span>
                      </span>
                    </span>

                    <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-60 group-hover:text-[var(--accent3)] group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
