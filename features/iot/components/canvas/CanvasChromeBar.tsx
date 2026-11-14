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

export default function CanvasChromeBar({
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
  const [footerSlot, setFooterSlot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setFooterSlot(document.getElementById("dashboard-footer-center"));
  }, []);

  const barContent = (
    <div
      dir="rtl"
      onPointerDown={(e) => e.stopPropagation()}
      className={
        footerSlot
          ? "pointer-events-auto flex max-w-full items-center justify-center"
          : "pointer-events-none absolute inset-x-0 bottom-2.5 z-40 flex items-center justify-center px-2"
      }
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)]/95 px-2 py-1 text-xs shadow-lg backdrop-blur-xl [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {/* Home Dashboard Sub-mode switcher: Group Sheets | Segment Nodes */}
        {workspaceScope === "home" && (
          <fieldset
            aria-label="حالت نمایش شیت بوم"
            className="m-0 inline-flex shrink-0 items-center gap-0.5 rounded-xl border-0 bg-[var(--secondary)] p-0.5"
          >
            <button
              type="button"
              aria-pressed={subMode === "groups"}
              onClick={() => onChangeSubMode("groups")}
              className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                subMode === "groups"
                  ? "bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>گروه‌ها</span>
            </button>

            <button
              type="button"
              aria-pressed={subMode === "segments"}
              onClick={() => onChangeSubMode("segments")}
              className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                subMode === "segments"
                  ? "bg-[var(--accent3)] text-[var(--accent3-foreground)] shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>قطعات</span>
            </button>
          </fieldset>
        )}

        {/* Zoom & Fit Controls */}
        <div
          className={`flex shrink-0 items-center gap-0.5 ${
            workspaceScope === "home" ? "border-r border-[var(--border-color)] pr-1" : ""
          }`}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onZoomOut}
                  aria-label="کوچک‌نمایی شیت"
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent>کوچک‌نمایی</TooltipContent>
          </Tooltip>

          <button
            type="button"
            onClick={onFitView}
            aria-label="تنظیم بزرگ‌نمایی روی نمای کلی"
            className="inline-flex h-7 min-w-[44px] cursor-pointer items-center justify-center rounded-lg px-1.5 text-[11px] font-bold tabular-nums text-[var(--text-primary)] transition-colors hover:bg-[var(--secondary)]"
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
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] px-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent3)]"
                >
                  <Maximize className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden md:inline">نمای کلی</span>
                </button>
              }
            />
            <TooltipContent>جای‌گیری تمام گره‌ها در صفحه</TooltipContent>
          </Tooltip>
        </div>

        {/* Snap, Lock, and Reset Layout */}
        <div className="flex shrink-0 items-center gap-0.5 border-r border-[var(--border-color)] pr-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-pressed={snapToGrid}
                  onClick={onToggleSnap}
                  aria-label="چسبندگی به شبکه شیت"
                  className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                    snapToGrid
                      ? "bg-[var(--accent3-transparent)] text-[var(--accent3)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" aria-hidden="true" />
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
                  aria-label={isLocked ? "باز کردن قفل جابه‌جایی" : "قفل کردن جابه‌جایی و تغییر سایز"}
                  className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors ${
                    isLocked
                      ? "bg-amber-500/15 text-amber-500"
                      : "text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {isLocked ? (
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="hidden lg:inline">{isLocked ? "قفل شده" : "آزاد"}</span>
                </button>
              }
            />
            <TooltipContent>
              {isLocked
                ? "قفل چیدمان فعال است (مناسب کنترل سریع در موبایل)"
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
                  className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden xl:inline">مرتب‌سازی</span>
                </button>
              }
            />
            <TooltipContent>چیدن مجدد و منظم سگمنت‌ها و گروه‌ها روی شیت</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  return footerSlot ? createPortal(barContent, footerSlot) : barContent;
}
