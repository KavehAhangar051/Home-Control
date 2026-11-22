"use client";

import {
  Grid,
  Layers,
  LayoutGrid,
  Lock,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  Unlock,
} from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePortalTarget } from "@/lib/hooks/use-portal-target";
import type { CanvasSubMode } from "./canvasTypes";
import type { CanvasWorkspaceScope } from "./useCanvasController";

interface CanvasChromeBarProps {
  workspaceScope?: CanvasWorkspaceScope;
  subMode: CanvasSubMode;
  zoom: number;
  snapToGrid: boolean;
  isLocked: boolean;
  onChangeSubMode: (mode: CanvasSubMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleSnap: () => void;
  onToggleLock: () => void;
  onResetLayout: () => void;
}

export default React.memo(function CanvasChromeBar({
  workspaceScope = "home",
  subMode,
  zoom,
  snapToGrid,
  isLocked,
  onChangeSubMode,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleSnap,
  onToggleLock,
  onResetLayout,
}: CanvasChromeBarProps) {
  const footerSlot = usePortalTarget("dashboard-footer-center");

  const barContent = (
    <>
      <div
        dir="rtl"
        data-canvas-chrome="true"
        onPointerDown={(e) => e.stopPropagation()}
        className={
          footerSlot
            ? "pointer-events-auto flex max-w-full items-center justify-center"
            : "pointer-events-none absolute inset-x-0 top-2 z-30 flex items-center justify-center px-2.5 md:top-2.5 md:px-2"
        }
      >
        <div className="pointer-events-auto inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border-color/90 bg-card-bg-solid/95 px-1.5 py-1 text-xs shadow-md md:rounded-2xl md:px-2 md:shadow-lg [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {/* Home Dashboard Sub-mode switcher: Group Sheets | Segment Nodes */}
          {workspaceScope === "home" && (
            <fieldset
              aria-label="حالت نمایش شیت بوم"
              className="m-0 inline-flex shrink-0 items-center gap-0.5 rounded-full border-0 bg-secondary/90 p-0.5 md:rounded-xl md:bg-secondary"
            >
              <button
                type="button"
                aria-pressed={subMode === "groups"}
                onClick={() => onChangeSubMode("groups")}
                className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition-colors md:rounded-lg md:px-2.5 ${
                  subMode === "groups"
                    ? "bg-accent3 text-accent3-foreground shadow-2xs"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Layers className="size-3.5 shrink-0" aria-hidden="true" />
                <span>گروه‌ها</span>
              </button>

              <button
                type="button"
                aria-pressed={subMode === "segments"}
                onClick={() => onChangeSubMode("segments")}
                className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition-colors md:rounded-lg md:px-2.5 ${
                  subMode === "segments"
                    ? "bg-accent3 text-accent3-foreground shadow-2xs"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <LayoutGrid className="size-3.5 shrink-0" aria-hidden="true" />
                <span>قطعات</span>
              </button>
            </fieldset>
          )}

          {/* Desktop & Tablet Footer Zoom +/-/% + Fit */}
          <div
            className={`flex shrink-0 items-center gap-0.5 ${
              workspaceScope === "home" ? "border-r border-border-color/75 pr-1" : ""
            }`}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onZoomOut}
                    aria-label="کوچک‌نمایی شیت"
                    className="hidden size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary md:inline-flex"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                }
              />
              <TooltipContent>کوچک‌نمایی</TooltipContent>
            </Tooltip>

            <button
              type="button"
              data-sheet-zoom-readout="true"
              onClick={onFitView}
              aria-label="تنظیم بزرگ‌نمایی روی نمای کلی"
              className="hidden h-8 min-w-[44px] cursor-pointer items-center justify-center rounded-lg px-1.5 text-[11px] font-bold tabular-nums text-text-primary transition-colors hover:bg-secondary md:inline-flex"
            >
              {Math.round(zoom * 100)}%
            </button>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onZoomIn}
                    aria-label="بزرگ‌نمایی شیت"
                    className="hidden size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary md:inline-flex"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                }
              />
              <TooltipContent>بزرگ‌نمایی</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onFitView}
                    aria-label="نمای کلی شیت"
                    className="inline-flex size-8 cursor-pointer items-center justify-center gap-1 rounded-full border border-border-color/80 bg-secondary/90 text-[11px] font-semibold text-text-primary transition-colors hover:border-accent3 md:h-8 md:w-auto md:rounded-lg md:bg-secondary md:px-2.5"
                  >
                    <Maximize className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden md:inline">نمای کلی</span>
                  </button>
                }
              />
              <TooltipContent>جای‌گیری تمام گره‌ها در صفحه</TooltipContent>
            </Tooltip>
          </div>

          {/* Snap, Lock, and Reset Layout */}
          <div className="flex shrink-0 items-center gap-0.5 md:border-r md:border-border-color/75 md:pr-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={snapToGrid}
                    onClick={onToggleSnap}
                    aria-label="چسبندگی به شبکه شیت"
                    className={`hidden size-8 cursor-pointer items-center justify-center rounded-lg transition-colors md:inline-flex ${
                      snapToGrid
                        ? "bg-accent3-transparent text-accent3"
                        : "text-text-muted hover:bg-secondary hover:text-text-primary"
                    }`}
                  >
                    <Grid className="size-3.5" aria-hidden="true" />
                  </button>
                }
              />
              <TooltipContent>
                {snapToGrid ? "چسبندگی به شبکه: فعال" : "چسبندگی به شبکه: غیرفعال"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={isLocked}
                    onClick={onToggleLock}
                    aria-label={
                      isLocked ? "باز کردن قفل جابه‌جایی" : "قفل کردن جابه‌جایی و تغییر سایز"
                    }
                    className={`inline-flex size-8 cursor-pointer items-center justify-center gap-1 rounded-full text-[11px] font-semibold transition-colors md:h-8 md:w-auto md:rounded-lg md:px-2.5 ${
                      isLocked
                        ? "border border-warning/35 bg-warning-soft text-warning"
                        : "border border-border-color/80 bg-secondary/90 text-text-muted hover:bg-secondary hover:text-text-primary md:border-transparent md:bg-transparent"
                    }`}
                  >
                    {isLocked ? (
                      <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Unlock className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="hidden lg:inline">{isLocked ? "قفل شده" : "آزاد"}</span>
                  </button>
                }
              />
              <TooltipContent>
                {isLocked
                  ? "قفل چیدمان فعال است (پیمایش لمسی با هر قسمت صفحه)"
                  : "جابه‌جایی و تغییر اندازه گره‌ها فعال است"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onResetLayout}
                    aria-label="چیدمان خودکار شیت"
                    className="inline-flex size-8 cursor-pointer items-center justify-center gap-1 rounded-full border border-border-color/80 bg-secondary/90 text-[11px] font-medium text-text-muted transition-colors hover:bg-secondary hover:text-text-primary md:h-8 md:w-auto md:rounded-lg md:border-transparent md:bg-transparent md:px-2"
                  >
                    <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden xl:inline">مرتب‌سازی</span>
                  </button>
                }
              />
              <TooltipContent>چیدن منظم قطعات و گروه‌ها روی شیت</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Mobile & Portrait Tablet One-Handed Thumb Zoom Pill (above bottom Dock) */}
      {!footerSlot && (
        <div
          dir="ltr"
          data-canvas-chrome="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed bottom-24 left-3 z-30 flex flex-col items-center gap-0.5 rounded-2xl border border-border-color/90 bg-card-bg-solid/95 p-1 shadow-md md:hidden"
        >
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="بزرگ‌نمایی شیت"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-secondary pointer-fine:active:scale-95"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            data-sheet-zoom-readout="true"
            onClick={onFitView}
            aria-label="نمای کلی و بازنشانی بزرگ‌نمایی"
            className="inline-flex h-7 min-w-9 cursor-pointer items-center justify-center rounded-lg px-1 text-[10px] font-bold tabular-nums text-text-secondary transition-colors hover:bg-secondary pointer-fine:active:scale-95"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={onZoomOut}
            aria-label="کوچک‌نمایی شیت"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-xl text-text-primary transition-colors hover:bg-secondary pointer-fine:active:scale-95"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );

  return footerSlot ? createPortal(barContent, footerSlot) : barContent;
});
