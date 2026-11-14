"use client";

import { Check, Edit3, PanelLeft, Play, Plus, Trash2, X } from "lucide-react";
import React from "react";
import type { WorkflowDefinition } from "./workflowTypes";

interface WorkflowHeaderBarProps {
  workflows: WorkflowDefinition[];
  activeWorkflow: WorkflowDefinition;
  isPaletteOpen: boolean;
  isConnecting: boolean;
  onTogglePalette: () => void;
  onSelectWorkflow: (id: string) => void;
  onCreateWorkflow: () => void;
  onRenameWorkflow: (id: string, name: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onRunTest: () => void;
  onCancelConnect: () => void;
}

export default function WorkflowHeaderBar({
  workflows,
  activeWorkflow,
  isPaletteOpen,
  isConnecting,
  onTogglePalette,
  onSelectWorkflow,
  onCreateWorkflow,
  onRenameWorkflow,
  onDeleteWorkflow,
  onToggleEnabled,
  onRunTest,
  onCancelConnect,
}: WorkflowHeaderBarProps) {
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [draftName, setDraftName] = React.useState(activeWorkflow.name);

  React.useEffect(() => {
    setDraftName(activeWorkflow.name);
    setIsEditingName(false);
  }, [activeWorkflow.id, activeWorkflow.name]);

  const commitRename = () => {
    const trimmed = draftName.trim();

    if (trimmed) {
      onRenameWorkflow(activeWorkflow.id, trimmed);
    }

    setIsEditingName(false);
  };

  return (
    <div
      dir="rtl"
      onPointerDown={(e) => e.stopPropagation()}
      className="custom-scrollbar relative z-40 flex h-12 w-full shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-[var(--border-color)] bg-[var(--card-bg-solid)]/95 px-2.5 backdrop-blur-md sm:px-3"
    >
      {/* Right side in RTL: Workflow Selector + CRUD + Run + Active Toggle */}
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();

                if (e.key === "Escape") {
                  setDraftName(activeWorkflow.name);
                  setIsEditingName(false);
                }
              }}
              aria-label="نام گردش کار"
              className="h-8 w-36 rounded-lg border border-[var(--accent3)] bg-[var(--bg-main)] px-2 text-xs font-bold text-[var(--text-primary)] outline-none sm:w-44"
            />
            <button
              type="button"
              onClick={commitRename}
              aria-label="ثبت نام گردش کار"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[var(--accent3)] text-[var(--accent3-foreground)]"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            <select
              aria-label="انتخاب گردش کار"
              value={activeWorkflow.id}
              onChange={(e) => onSelectWorkflow(e.target.value)}
              className="h-8 max-w-[140px] cursor-pointer truncate rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent3)] sm:max-w-[200px]"
            >
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setDraftName(activeWorkflow.name);
                setIsEditingName(true);
              }}
              aria-label="تغییر نام گردش کار"
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onCreateWorkflow}
          aria-label="گردش کار جدید"
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] px-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent3)]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden md:inline">جدید</span>
        </button>

        <button
          type="button"
          onClick={() => onDeleteWorkflow(activeWorkflow.id)}
          aria-label={`حذف ${activeWorkflow.name}`}
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors hover:border-red-500/35 hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Center Status Hint while Connecting Ports */}
      {isConnecting && (
        <div className="hidden items-center gap-2 rounded-lg border border-[var(--accent3)]/40 bg-[var(--accent3-transparent)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent3)] lg:flex">
          <span>روی پورت ورودی گره مقصد کلیک کنید</span>
          <button
            type="button"
            onClick={onCancelConnect}
            className="inline-flex cursor-pointer items-center gap-0.5 rounded px-1 text-[10px] hover:bg-[var(--accent3)] hover:text-[var(--accent3-foreground)]"
          >
            <X className="h-3 w-3" />
            لغو
          </button>
        </div>
      )}

      {/* Left side in RTL: Run, Enable Switch, Left Palette Toggle */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onRunTest}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 active:scale-[0.98]"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">اجرای تست</span>
        </button>

        {/* Active / Draft Toggle Switch (Gently rounded square style) */}
        <button
          type="button"
          role="switch"
          aria-checked={activeWorkflow.enabled}
          onClick={() => onToggleEnabled(activeWorkflow.id, !activeWorkflow.enabled)}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent3)]"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-5 w-9 shrink-0 items-center justify-start rounded-[7px] p-0.5 transition-colors ${
              activeWorkflow.enabled
                ? "border border-transparent bg-emerald-600"
                : "border border-[var(--border-color)] bg-[var(--input)]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-[14px] w-[14px] rounded-[4px] bg-white shadow-xs transition-transform duration-200 ${
                activeWorkflow.enabled ? "translate-x-0" : "-translate-x-4"
              }`}
            />
          </span>
          <span className="hidden sm:inline">{activeWorkflow.enabled ? "فعال" : "پیش‌نویس"}</span>
        </button>

        <button
          type="button"
          aria-pressed={isPaletteOpen}
          onClick={onTogglePalette}
          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors ${
            isPaletteOpen
              ? "border-[var(--accent3)] bg-[var(--accent3-transparent)] text-[var(--accent3)]"
              : "border-[var(--border-color)] bg-[var(--secondary)] text-[var(--text-primary)] hover:border-[var(--accent3)]"
          }`}
        >
          <PanelLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>گره‌ها</span>
        </button>
      </div>
    </div>
  );
}
