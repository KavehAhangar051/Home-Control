"use client";

import { GitBranch, Plus } from "lucide-react";

interface WorkflowEmptyStateProps {
  onStartDesigning: () => void;
}

export default function WorkflowEmptyState({ onStartDesigning }: WorkflowEmptyStateProps) {
  return (
    <div
      dir="rtl"
      className="relative flex h-full min-h-[480px] w-full flex-1 items-center justify-center overflow-hidden bg-[var(--bg-main)] p-6 text-center"
      style={{
        backgroundImage: "radial-gradient(var(--border-color) 1.35px, transparent 1.35px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="relative z-10 flex max-w-md flex-col items-center gap-5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)]/95 p-8 shadow-sm backdrop-blur-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--accent3-medium)] bg-[var(--accent3-transparent)] text-[var(--accent3)]">
          <GitBranch className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-balance text-[var(--text-primary)] sm:text-xl">
            هنوز گردش کاری طراحی نشده است
          </h2>
          <p className="text-xs leading-6 text-[var(--text-secondary)] sm:text-sm">
            یک بوم خالی باز کنید، سگمنت‌ها و گروه‌های خود را از پنل سمت چپ بوم اضافه کنید و با
            بوابه‌های منطقی (AND / OR / NOT) و تایمرها به هم متصل نمایید.
          </p>
        </div>

        <button
          type="button"
          onClick={onStartDesigning}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent3)] px-6 text-sm font-bold text-[var(--accent3-foreground)] shadow-sm transition-[background-color,transform,opacity] duration-150 hover:opacity-95 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>شروع طراحی یک گردش کار</span>
        </button>
      </div>
    </div>
  );
}
