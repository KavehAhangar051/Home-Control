"use client";

import {
  Boxes,
  ClipboardPaste,
  Copy,
  Files,
  Grid,
  Lock,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Undo2,
  Unlock,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface WorkflowFooterControlsProps {
  inPortal: boolean;
  zoom: number;
  snapToGrid: boolean;
  isLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  onZoomBy: (delta: number) => void;
  onFitView: () => void;
  onToggleSnap: () => void;
  onToggleLock: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onToggleSubflowGroup: () => void;
}

export default function WorkflowFooterControls({
  inPortal,
  zoom,
  snapToGrid,
  isLocked,
  canUndo,
  canRedo,
  hasSelection,
  hasClipboard,
  onZoomBy,
  onFitView,
  onToggleSnap,
  onToggleLock,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onToggleSubflowGroup,
}: WorkflowFooterControlsProps) {
  return (
    <div
      dir="rtl"
      onPointerDown={(e) => e.stopPropagation()}
      className={
        inPortal
          ? "pointer-events-auto flex max-w-full items-center justify-center"
          : "pointer-events-none absolute inset-x-0 top-2.5 z-30 flex items-center justify-center px-2"
      }
    >
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-border-color bg-card-bg-solid/95 px-2 py-1 text-xs shadow-lg backdrop-blur-xl">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-l border-border-color pl-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!canUndo || isLocked}
                  onClick={onUndo}
                  aria-label="واگرد (Ctrl+Z)"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Undo2 className="size-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent>واگرد (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!canRedo || isLocked}
                  onClick={onRedo}
                  aria-label="ازنو (Ctrl+Y)"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Redo2 className="size-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent>ازنو (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        {/* Clipboard & Sub-flow Grouping */}
        <div className="flex items-center gap-0.5 border-l border-border-color pl-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!hasSelection}
                  onClick={onCopy}
                  aria-label="کپی گره (Ctrl+C)"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent>کپی گره (Ctrl+C)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!hasClipboard || isLocked}
                  onClick={onPaste}
                  aria-label="چسباندن گره (Ctrl+V)"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ClipboardPaste className="size-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent>چسباندن (Ctrl+V)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!hasSelection || isLocked}
                  onClick={onDuplicate}
                  aria-label="تکثیر گره (Ctrl+D)"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Files className="size-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent>تکثیر گره (Ctrl+D)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={!hasSelection || isLocked}
                  onClick={onToggleSubflowGroup}
                  aria-label="گروه‌بندی در باکس زیرمدار (Ctrl+G)"
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-accent3 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Boxes className="size-3.5" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent>گروه‌بندی زیرمدار (Ctrl+G)</TooltipContent>
          </Tooltip>
        </div>

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => onZoomBy(-0.15)}
                aria-label="کوچک‌نمایی"
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary"
              >
                <Minus className="size-3.5" aria-hidden="true" />
              </button>
            }
          />
          <TooltipContent>کوچک‌نمایی</TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={onFitView}
          aria-label="بازنشانی بزرگ‌نمایی"
          className="inline-flex h-7 min-w-[44px] cursor-pointer items-center justify-center rounded-lg px-1.5 text-[11px] font-bold tabular-nums text-text-primary transition-colors hover:bg-secondary"
        >
          {Math.round(zoom * 100)}%
        </button>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => onZoomBy(0.15)}
                aria-label="بزرگ‌نمایی"
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-secondary hover:text-text-primary"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            }
          />
          <TooltipContent>بزرگ‌نمایی</TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={onFitView}
          aria-label="نمای کلی گره‌ها"
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-secondary px-2 text-[11px] font-semibold text-text-primary transition-colors hover:border-accent3"
        >
          <Maximize className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden md:inline">نمای کلی</span>
        </button>

        <div className="flex items-center gap-0.5 border-r border-border-color pr-1">
          <button
            type="button"
            aria-pressed={snapToGrid}
            onClick={onToggleSnap}
            aria-label="چسبندگی به شبکه"
            className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
              snapToGrid
                ? "bg-accent3-transparent text-accent3"
                : "text-text-muted hover:bg-secondary hover:text-text-primary"
            }`}
          >
            <Grid className="size-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-pressed={isLocked}
            onClick={onToggleLock}
            aria-label={isLocked ? "باز کردن قفل بوم" : "قفل کردن بوم"}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors ${
              isLocked
                ? "bg-warning-soft text-warning"
                : "text-text-muted hover:bg-secondary hover:text-text-primary"
            }`}
          >
            {isLocked ? (
              <Lock className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Unlock className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden lg:inline">{isLocked ? "قفل" : "آزاد"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
