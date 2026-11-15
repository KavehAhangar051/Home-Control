"use client";

import { Plus } from "lucide-react";
import { WorkflowSchematicSymbol } from "./WorkflowSchematicSymbols";

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
        <div
          dir="ltr"
          className="flex h-14 w-20 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--accent3)]"
        >
          <WorkflowSchematicSymbol kind="logic_and" className="h-9 w-16" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-balance text-[var(--text-primary)] sm:text-xl">
            طراحی مدار و گردش کار اتوماسیون
          </h2>
          <p className="text-xs leading-6 text-[var(--text-secondary)] sm:text-sm">
            گیت‌های منطقی با استاندارد شماتیک (AND / OR / NOT)، تایمرها، بلوک‌های گروهی و قطعات
            سخت‌افزاری را روی بوم بچینید و پورت‌ها را به هم سیم‌کشی کنید.
          </p>
        </div>

        <button
          type="button"
          onClick={onStartDesigning}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent3)] px-6 text-sm font-bold text-[var(--accent3-foreground)] shadow-sm transition-[background-color,transform,opacity] duration-150 hover:opacity-95 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>ایجاد اولین مدار گردش کار</span>
        </button>
      </div>
    </div>
  );
}
