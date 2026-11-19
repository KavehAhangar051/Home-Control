"use client";

import { useWorkspace, useWorkspaceSelector } from "@danfessler/trellis-react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Eye,
  Layers,
  LayoutGrid,
  RotateCcw,
  Save,
  Tablet,
  Trash2,
  ZoomOut,
} from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type React from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { SavedTrellisLayout } from "@/features/iot/hooks/usePreferencesStore";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import { usePortalTarget } from "@/lib/hooks/use-portal-target";
import type { TrellisLayoutPreset } from "./trellisLayout";

interface TrellisChromeBarProps {
  preset: TrellisLayoutPreset;
  savedLayouts: SavedTrellisLayout[];
  activeSavedLayoutId: string | null;
  onChangePreset: (preset: TrellisLayoutPreset) => void;
  onResetLayout: () => void;
  onSaveCurrentLayout: (name: string) => void;
  onApplySavedLayout: (id: string) => void;
  onDeleteSavedLayout: (id: string) => void;
}

const PRESET_LABELS: Record<TrellisLayoutPreset, string> = {
  groups: "گروه‌ها",
  segments: "قطعات",
  "wall-panel": "دیواری",
};

export default function TrellisChromeBar({
  preset,
  savedLayouts,
  activeSavedLayoutId,
  onChangePreset,
  onResetLayout,
  onSaveCurrentLayout,
  onApplySavedLayout,
  onDeleteSavedLayout,
}: TrellisChromeBarProps) {
  const ws = useWorkspace();
  const framed = useWorkspaceSelector((s) => s.framed);
  const hiddenPanels = useWorkspaceSelector((s) => s.hidden);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);
  const [showHiddenMenu, setShowHiddenMenu] = useState(false);
  const [showLayoutsMenu, setShowLayoutsMenu] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const footerSlot = usePortalTarget("dashboard-footer-center");

  const onClosePopovers = useEffectEvent(() => {
    setShowHiddenMenu(false);
    setShowLayoutsMenu(false);
  });

  useEffect(() => {
    if (!showHiddenMenu && !showLayoutsMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        onClosePopovers();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClosePopovers();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showHiddenMenu, showLayoutsMenu]);

  const handleSaveSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const fallbackName = `چیدمان ${savedLayouts.length + 1}`;
    onSaveCurrentLayout(layoutName.trim() || fallbackName);
    setLayoutName("");
  };

  const popoverAnchorClass = footerSlot
    ? "bottom-[calc(100%+8px)] origin-bottom-left"
    : "top-[calc(100%+8px)] origin-top-left";
  const popoverOffsetY = footerSlot ? 4 : -4;

  const barContent = (
    <div
      dir="rtl"
      className={
        footerSlot
          ? "pointer-events-auto flex items-center justify-center"
          : "pointer-events-none absolute inset-x-0 top-2.5 z-30 flex items-center justify-center px-2"
      }
    >
      <div
        ref={barRef}
        className="pointer-events-auto relative flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border-color bg-card-bg-solid px-2.5 py-1.5 text-xs shadow-lg"
      >
        <fieldset
          aria-label="سطح نمایش پنل‌های آزاد"
          className="m-0 inline-flex min-w-0 items-center gap-1 rounded-xl border-0 bg-secondary p-0.5"
        >
          <button
            type="button"
            aria-pressed={preset === "groups"}
            onClick={() => onChangePreset("groups")}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
              preset === "groups"
                ? "bg-accent3 text-accent3-foreground shadow-2xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Layers className="size-3.5 shrink-0" aria-hidden="true" />
            <span>نمای گروه‌ها</span>
          </button>

          <button
            type="button"
            aria-pressed={preset === "wall-panel"}
            onClick={() => onChangePreset("wall-panel")}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
              preset === "wall-panel"
                ? "bg-accent3 text-accent3-foreground shadow-2xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Tablet className="size-3.5 shrink-0" aria-hidden="true" />
            <span>پنل دیواری</span>
          </button>

          <button
            type="button"
            aria-pressed={preset === "segments"}
            onClick={() => onChangePreset("segments")}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
              preset === "segments"
                ? "bg-accent3 text-accent3-foreground shadow-2xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <LayoutGrid className="size-3.5 shrink-0" aria-hidden="true" />
            <span>همه قطعات</span>
          </button>
        </fieldset>

        {/* Saved Trellis Layout Presets Popover */}
        <div className="relative border-r border-border-color pr-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-expanded={showLayoutsMenu}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setShowHiddenMenu(false);
                    setShowLayoutsMenu((prev) => !prev);
                  }}
                  className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                    showLayoutsMenu || activeSavedLayoutId
                      ? "border-accent3 bg-accent3/15 text-text-primary"
                      : "border-border-color bg-secondary text-text-secondary hover:border-accent3/70 hover:text-text-primary"
                  }`}
                >
                  <Bookmark className="size-3.5 shrink-0 text-accent3" aria-hidden="true" />
                  <span>چیدمان‌ها</span>
                  {savedLayouts.length > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-card-bg-solid px-1 font-mono text-[10px] tabular-nums text-text-secondary">
                      {savedLayouts.length}
                    </span>
                  )}
                </button>
              }
            />
            <TooltipContent>ذخیره و بارگذاری چیدمان‌های سفارشی پنل‌ها</TooltipContent>
          </Tooltip>

          <AnimatePresence>
            {showLayoutsMenu && (
              <m.div
                key="trellis-layouts-menu"
                role="dialog"
                aria-label="مدیریت چیدمان‌های ذخیره‌شده"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: popoverOffsetY }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: 0 } }
                    : {
                        opacity: 0,
                        scale: 0.96,
                        y: popoverOffsetY,
                        transition: TRANSITION_EXIT_QUICK,
                      }
                }
                transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_QUICK}
                className={`absolute left-0 z-50 w-64 rounded-2xl border border-border-color bg-card-bg-solid p-2.5 text-right shadow-xl ${popoverAnchorClass}`}
              >
                <form onSubmit={handleSaveSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={layoutName}
                    onChange={(e) => setLayoutName(e.target.value)}
                    placeholder="نام چیدمان فعلی (مثلاً شبانه)"
                    maxLength={32}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border-color bg-bg-main px-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent3 focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="ذخیره چیدمان فعلی"
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-accent3 px-2.5 text-[11px] font-semibold text-accent3-foreground transition-opacity hover:opacity-90"
                  >
                    <Save className="size-3.5" aria-hidden="true" />
                    <span>ذخیره</span>
                  </button>
                </form>

                <div className="mt-2.5 border-t border-border-color/70 pt-2">
                  {savedLayouts.length === 0 ? (
                    <p className="px-1 py-2 text-center text-[11px] text-text-muted">
                      پنل‌ها را دلخواه بچینید و با یک نام ذخیره کنید
                    </p>
                  ) : (
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                      {savedLayouts.map((entry) => {
                        const isActive = activeSavedLayoutId === entry.id;

                        return (
                          <div
                            key={entry.id}
                            className={`flex items-center justify-between gap-1.5 rounded-xl px-2 py-1.5 transition-colors ${
                              isActive ? "bg-accent3/15" : "hover:bg-card-hover-bg"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onApplySavedLayout(entry.id);
                                setShowLayoutsMenu(false);
                              }}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-right"
                            >
                              {isActive ? (
                                <Check
                                  className="size-3.5 shrink-0 text-accent3"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Bookmark
                                  className="size-3.5 shrink-0 text-text-muted"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">
                                {entry.name}
                              </span>
                              <span className="shrink-0 rounded border border-border-color bg-secondary px-1.5 py-0.5 text-[10px] text-text-muted">
                                {PRESET_LABELS[entry.preset]}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteSavedLayout(entry.id)}
                              aria-label={`حذف چیدمان ${entry.name}`}
                              className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {framed && (
          <div className="flex items-center gap-1 border-r border-border-color pr-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => ws.navigation.stepOut()}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-secondary px-2 text-[11px] font-semibold text-text-primary transition-colors hover:border-accent3"
                  >
                    <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>یک سطح عقب</span>
                  </button>
                }
              />
              <TooltipContent>خروج یک مرحله از بزرگ‌نمایی (Esc)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => ws.navigation.overview()}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-accent3/30 bg-accent3-transparent px-2 text-[11px] font-semibold text-accent3 transition-colors hover:bg-accent3 hover:text-accent3-foreground"
                  >
                    <ZoomOut className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>نمای کلی</span>
                  </button>
                }
              />
              <TooltipContent>بازگشت به نمای کلی همه پنل‌ها</TooltipContent>
            </Tooltip>
          </div>
        )}

        {hiddenPanels.length > 0 && (
          <div className="relative border-r border-border-color pr-1.5">
            <button
              type="button"
              onClick={() => {
                setShowLayoutsMenu(false);
                setShowHiddenMenu((prev) => !prev);
              }}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-secondary px-2 text-[11px] font-semibold text-text-primary hover:border-accent3"
            >
              <Eye className="size-3.5 shrink-0 text-accent3" aria-hidden="true" />
              <span>پنهان ({hiddenPanels.length})</span>
            </button>

            <AnimatePresence>
              {showHiddenMenu && (
                <m.div
                  key="trellis-hidden-menu"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: popoverOffsetY }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0 } }
                      : {
                          opacity: 0,
                          scale: 0.96,
                          y: popoverOffsetY,
                          transition: TRANSITION_EXIT_QUICK,
                        }
                  }
                  transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_QUICK}
                  className={`absolute left-0 min-w-[180px] rounded-xl border border-border-color bg-card-bg-solid p-1.5 shadow-xl ${popoverAnchorClass}`}
                >
                  <span className="block px-2 py-1 text-[10px] font-semibold text-text-muted">
                    بازگردانی پنل‌های پنهان
                  </span>
                  {hiddenPanels.map((entry) => {
                    const firstTitle = entry.views[0]?.title || entry.panelId;

                    return (
                      <button
                        key={entry.panelId}
                        type="button"
                        onClick={() => {
                          ws.restore(entry.panelId);
                          setShowHiddenMenu(false);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-right text-xs font-medium text-text-primary hover:bg-card-hover-bg"
                      >
                        <span className="truncate">{firstTitle}</span>
                        <span className="text-[10px] text-accent3">بازگردانی</span>
                      </button>
                    );
                  })}
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onResetLayout}
                aria-label="بازنشانی چیدمان پنجره‌ها"
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-transparent px-2 text-[11px] font-medium text-text-muted transition-colors hover:border-border-color hover:bg-secondary hover:text-text-primary"
              >
                <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">پیش‌فرض</span>
              </button>
            }
          />
          <TooltipContent>چیدن مجدد پنل‌ها به حالت اولیه</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );

  return footerSlot ? createPortal(barContent, footerSlot) : barContent;
}
