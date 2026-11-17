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
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState(activeWorkflow.name);
  const isEditingName = editingWorkflowId === activeWorkflow.id;

  const commitRename = () => {
    const trimmed = draftName.trim();

    if (trimmed) {
      onRenameWorkflow(activeWorkflow.id, trimmed);
    }

    setEditingWorkflowId(null);
  };

  return (
    <div
      dir="rtl"
      onPointerDown={(e) => e.stopPropagation()}
      className="custom-scrollbar relative z-40 flex h-12 w-full shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-border-color bg-card-bg-solid/95 px-2.5 backdrop-blur-md sm:px-3"
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
                  setEditingWorkflowId(null);
                }
              }}
              aria-label="نام گردش کار"
              className="h-8 w-36 rounded-lg border border-accent3 bg-bg-main px-2 text-xs font-bold text-text-primary outline-none sm:w-44"
            />
            <button
              type="button"
              onClick={commitRename}
              aria-label="ثبت نام گردش کار"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg bg-accent3 text-accent3-foreground"
            >
              <Check className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            <select
              aria-label="انتخاب گردش کار"
              value={activeWorkflow.id}
              onChange={(e) => onSelectWorkflow(e.target.value)}
              className="h-8 max-w-[140px] cursor-pointer truncate rounded-lg border border-border-color bg-bg-main px-2 text-xs font-bold text-text-primary outline-none focus:border-accent3 sm:max-w-[200px]"
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
                setEditingWorkflowId(activeWorkflow.id);
              }}
              aria-label="تغییر نام گردش کار"
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors hover:border-border-color hover:bg-secondary hover:text-text-primary"
            >
              <Edit3 className="size-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onCreateWorkflow}
          aria-label="گردش کار جدید"
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-border-color bg-secondary px-2 text-xs font-semibold text-text-primary transition-colors hover:border-accent3"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span className="hidden md:inline">جدید</span>
        </button>

        <button
          type="button"
          onClick={() => onDeleteWorkflow(activeWorkflow.id)}
          aria-label={`حذف ${activeWorkflow.name}`}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors hover:border-destructive/35 hover:bg-destructive-soft hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Center Status Hint while Connecting Ports */}
      {isConnecting && (
        <div className="hidden items-center gap-2 rounded-lg border border-accent3/40 bg-accent3-transparent px-2.5 py-1 text-[11px] font-bold text-accent3 lg:flex">
          <span>پورت ورودی گره مقصد را انتخاب کنید</span>
          <button
            type="button"
            onClick={onCancelConnect}
            className="inline-flex cursor-pointer items-center gap-0.5 rounded px-1 text-[10px] hover:bg-accent3 hover:text-accent3-foreground"
          >
            <X className="size-3" />
            لغو
          </button>
        </div>
      )}

      {/* Left side in RTL: Run, Enable Switch, Left Palette Toggle */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onRunTest}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-success px-2.5 text-xs font-bold text-success-foreground transition-colors hover:bg-success/90 active:scale-[0.98]"
        >
          <Play className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">تست مدار</span>
        </button>

        {/* Active / Draft Toggle Switch (Gently rounded square style) */}
        <button
          type="button"
          role="switch"
          aria-checked={activeWorkflow.enabled}
          onClick={() => onToggleEnabled(activeWorkflow.id, !activeWorkflow.enabled)}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border-color bg-bg-main px-2 text-[11px] font-semibold text-text-primary transition-colors hover:border-accent3"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-5 w-9 shrink-0 items-center justify-start rounded-[7px] p-0.5 transition-colors ${
              activeWorkflow.enabled
                ? "border border-transparent bg-success"
                : "border border-border-color bg-input"
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-[14px] rounded-[4px] bg-card-bg-solid dark:bg-foreground shadow-xs transition-transform duration-200 ${
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
              ? "border-accent3 bg-accent3-transparent text-accent3"
              : "border-border-color bg-secondary text-text-primary hover:border-accent3"
          }`}
        >
          <PanelLeft className="size-3.5 shrink-0" aria-hidden="true" />
          <span>کتابخانه گره‌ها</span>
        </button>
      </div>
    </div>
  );
}
