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
      className="relative flex size-full min-h-[480px] flex-1 items-center justify-center overflow-hidden bg-bg-main p-6 text-center"
      style={{
        backgroundImage: "radial-gradient(var(--border-color) 1.35px, transparent 1.35px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="bezel-shell relative z-10 max-w-md">
        <div className="bezel-core flex flex-col items-center gap-5 p-8">
          <div
            dir="ltr"
            className="flex h-14 w-20 items-center justify-center rounded-2xl border border-border-color bg-bg-main text-accent3 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.07)]"
          >
            <WorkflowSchematicSymbol kind="logic_and" className="h-9 w-16" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full border border-border-color bg-bg-main px-3 py-1 text-[10px] font-medium tracking-wider text-text-secondary">
              موتور منطقی بلادرنگ
            </span>
            <h2 className="text-lg font-bold text-balance text-text-primary sm:text-xl">
              طراحی مدار و گردش کار اتوماسیون
            </h2>
            <p className="text-xs leading-6 text-text-secondary sm:text-sm">
              گیت‌های منطقی با استاندارد شماتیک (AND / OR / NOT)، تایمرها، بلوک‌های گروهی و قطعات
              سخت‌افزاری را روی بوم بچینید و پورت‌ها را به هم سیم‌کشی کنید.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartDesigning}
            className="group inline-flex h-11 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-accent3 pr-5 pl-2 text-sm font-bold text-accent3-foreground shadow-xs transition-[transform,opacity] duration-200 ease-out hover:opacity-95 active:scale-[0.98]"
          >
            <span>ایجاد اولین مدار گردش کار</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-bg-main/15 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
              <Plus className="size-4 shrink-0" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
