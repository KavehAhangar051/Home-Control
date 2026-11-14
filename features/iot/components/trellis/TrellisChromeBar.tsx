"use client";

import { useWorkspace, useWorkspaceSelector } from "@danfessler/trellis-react";
import { ArrowRight, Eye, Layers, LayoutGrid, RotateCcw, ZoomOut } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrellisLayoutPreset } from "./trellisLayout";

interface TrellisChromeBarProps {
  preset: TrellisLayoutPreset;
  onChangePreset: (preset: TrellisLayoutPreset) => void;
  onResetLayout: () => void;
}

export default function TrellisChromeBar({
  preset,
  onChangePreset,
  onResetLayout,
}: TrellisChromeBarProps) {
  const ws = useWorkspace();
  const framed = useWorkspaceSelector((s) => s.framed);
  const hiddenPanels = useWorkspaceSelector((s) => s.hidden);
  const [showHiddenMenu, setShowHiddenMenu] = React.useState(false);
  const [footerSlot, setFooterSlot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setFooterSlot(document.getElementById("dashboard-footer-center"));
  }, []);

  const barContent = (
    <div
      dir="rtl"
      className={
        footerSlot
          ? "pointer-events-auto flex items-center justify-center"
          : "pointer-events-none absolute inset-x-0 bottom-3 z-50 flex items-center justify-center px-3"
      }
    >
      <div className="pointer-events-auto relative flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)]/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-xl">
        <fieldset
          aria-label="سطح نمایش پنل‌های آزاد"
          className="m-0 inline-flex min-w-0 items-center gap-1 rounded-xl border-0 bg-[var(--secondary)] p-0.5"
        >
          <button
            type="button"
            aria-pressed={preset === "groups"}
            onClick={() => onChangePreset("groups")}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
              preset === "groups"
                ? "bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>نمای گروه‌ها</span>
          </button>

          <button
            type="button"
            aria-pressed={preset === "segments"}
            onClick={() => onChangePreset("segments")}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
              preset === "segments"
                ? "bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>نمای همه قطعات</span>
          </button>
        </fieldset>

        {framed && (
          <div className="flex items-center gap-1 border-r border-[var(--border-color)] pr-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => ws.navigation.stepOut()}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] px-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent3)]"
                  >
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--accent3)]/30 bg-[var(--accent3-transparent)] px-2 text-[11px] font-semibold text-[var(--accent3)] transition-colors hover:bg-[var(--accent3)] hover:text-[var(--accent3-foreground)]"
                  >
                    <ZoomOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>نمای کلی</span>
                  </button>
                }
              />
              <TooltipContent>بازگشت به نمای کلی همه پنل‌ها</TooltipContent>
            </Tooltip>
          </div>
        )}

        {hiddenPanels.length > 0 && (
          <div className="relative border-r border-[var(--border-color)] pr-1.5">
            <button
              type="button"
              onClick={() => setShowHiddenMenu((prev) => !prev)}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] px-2 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent3)]"
            >
              <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--accent3)]" aria-hidden="true" />
              <span>پنهان ({hiddenPanels.length})</span>
            </button>

            {showHiddenMenu && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[180px] rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-solid)] p-1.5 shadow-xl">
                <span className="block px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
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
                      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-right text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--card-hover-bg)]"
                    >
                      <span className="truncate">{firstTitle}</span>
                      <span className="text-[10px] text-[var(--accent3)]">بازگردانی</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onResetLayout}
                aria-label="بازنشانی چیدمان پنجره‌ها"
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-transparent px-2 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">چیدمان پیش‌فرض</span>
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
