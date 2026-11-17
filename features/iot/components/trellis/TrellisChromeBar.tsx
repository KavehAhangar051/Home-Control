"use client";

import { useWorkspace, useWorkspaceSelector } from "@danfessler/trellis-react";
import { ArrowRight, Eye, Layers, LayoutGrid, RotateCcw, ZoomOut } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePortalTarget } from "@/lib/hooks/use-portal-target";
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
  const footerSlot = usePortalTarget("dashboard-footer-center");

  const barContent = (
    <div
      dir="rtl"
      className={
        footerSlot
          ? "pointer-events-auto flex items-center justify-center"
          : "pointer-events-none absolute inset-x-0 bottom-3 z-50 flex items-center justify-center px-3"
      }
    >
      <div className="pointer-events-auto relative flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border-color bg-card-bg-solid px-2.5 py-1.5 text-xs shadow-lg">
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
            aria-pressed={preset === "segments"}
            onClick={() => onChangePreset("segments")}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
              preset === "segments"
                ? "bg-accent3 text-accent3-foreground shadow-2xs"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <LayoutGrid className="size-3.5 shrink-0" aria-hidden="true" />
            <span>نمای همه قطعات</span>
          </button>
        </fieldset>

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
              onClick={() => setShowHiddenMenu((prev) => !prev)}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-secondary px-2 text-[11px] font-semibold text-text-primary hover:border-accent3"
            >
              <Eye className="size-3.5 shrink-0 text-accent3" aria-hidden="true" />
              <span>پنهان ({hiddenPanels.length})</span>
            </button>

            {showHiddenMenu && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[180px] rounded-xl border border-border-color bg-card-bg-solid p-1.5 shadow-xl">
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
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-transparent px-2 text-[11px] font-medium text-text-muted transition-colors hover:border-border-color hover:bg-secondary hover:text-text-primary"
              >
                <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
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
