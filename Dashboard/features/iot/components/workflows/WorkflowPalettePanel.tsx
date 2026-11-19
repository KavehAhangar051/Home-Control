"use client";

import { Search, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { DURATION, EASE_DRAWER, EASE_IN, EXIT_DURATION, SPRING_LAYOUT } from "@/lib/ease";
import {
  PaletteGroupsSection,
  PaletteSegmentsSection,
  PaletteSymbolSection,
} from "./WorkflowPaletteSections";
import {
  CONTROL_ENTRIES,
  LOGIC_GATE_ENTRIES,
  type PaletteCategoryFilter,
} from "./workflowPaletteData";
import type { WorkflowPaletteDragPayload } from "./workflowTypes";

interface WorkflowPalettePanelProps {
  isOpen: boolean;
  onClose: () => void;
  segments: Segment[];
  groupsOrder: string[];
  animationsEnabled?: boolean;
  onAddNode: (payload: WorkflowPaletteDragPayload) => void;
}

const PALETTE_TABS: ReadonlyArray<{ id: PaletteCategoryFilter; label: string }> = [
  { id: "all", label: "همه" },
  { id: "logic", label: "گیت و منطق" },
  { id: "groups", label: "گروه‌ها" },
  { id: "segments", label: "قطعات" },
];

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

      return fields.some((f) => f.toLowerCase().includes(normalizedQuery));
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

  const activeSegments = React.useMemo(
    () =>
      segments.filter(
        (seg) =>
          seg.type !== "placeholder" &&
          matchesSearch([seg.title, seg.group || "Test", seg.pin, `gpio ${seg.pin}`]),
      ),
    [segments, matchesSearch],
  );

  const groupCounts = React.useMemo(() => {
    const map = new Map<string, number>();

    for (const groupName of groupsOrder) map.set(groupName, 0);

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
          className="absolute top-12 bottom-0 left-0 z-30 flex w-[288px] max-w-[86vw] flex-col border-r border-border-color bg-card-bg-solid/95 shadow-xl backdrop-blur-xl"
        >
          <div className="shrink-0 space-y-2.5 border-b border-border-color p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate text-xs font-bold text-text-primary">
                کتابخانه قطعات و گیت‌ها
              </h2>

              <button
                type="button"
                onClick={onClose}
                aria-label="بستن کتابخانه گره‌ها"
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-[color,background-color,transform] duration-150 ease-out hover:bg-secondary hover:text-text-primary active:scale-[0.97] md:hidden"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="جستجو در کتابخانه گره‌ها"
                placeholder="جستجو..."
                className="h-8 w-full rounded-lg border border-border-color bg-bg-main pr-8 pl-2.5 text-[11px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent3"
              />
            </div>

            <div
              role="tablist"
              aria-label="دسته‌بندی گره‌ها"
              className="grid grid-cols-4 gap-1 rounded-lg bg-bg-main p-1"
            >
              {PALETTE_TABS.map((tab) => {
                const active = categoryFilter === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`relative h-6 cursor-pointer truncate rounded-md px-1.5 text-[10px] font-semibold whitespace-nowrap transition-[color,transform] duration-150 ease-out active:scale-[0.97] ${
                      active ? "text-text-primary" : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {active && (
                      <m.span
                        layoutId={
                          shouldAnimateMotion ? "workflow-palette-category-pill" : undefined
                        }
                        transition={SPRING_LAYOUT}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-md bg-card-bg-solid shadow-xs"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            data-canvas-scroll-area="true"
            className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3"
          >
            {showLogicSection && (
              <>
                <PaletteSymbolSection
                  title="گیت‌های منطقی"
                  entries={filteredGates}
                  monospaceTitle
                  onAddNode={onAddNode}
                />
                <PaletteSymbolSection
                  title="محرک‌ها و زمان‌بندی"
                  entries={filteredControls}
                  onAddNode={onAddNode}
                />
              </>
            )}

            {showGroupsSection && (
              <PaletteGroupsSection
                showCustomGroup={showCustomGroup}
                filteredGroups={filteredGroups}
                groupCounts={groupCounts}
                onAddNode={onAddNode}
              />
            )}

            {showSegmentsSection && (
              <PaletteSegmentsSection
                activeSegments={activeSegments}
                query={query}
                normalizedQuery={normalizedQuery}
                onAddNode={onAddNode}
              />
            )}
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
