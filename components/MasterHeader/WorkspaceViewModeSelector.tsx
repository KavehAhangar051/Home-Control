"use client";

import { LayoutGrid, PanelsTopLeft, Workflow } from "lucide-react";
import { m } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WorkspaceDisplayMode } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

interface ViewModeOption {
  id: WorkspaceDisplayMode;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof LayoutGrid;
}

const VIEW_MODE_OPTIONS: readonly ViewModeOption[] = [
  {
    id: "grid",
    label: "چیدمان ستونی",
    shortLabel: "ستونی",
    description: "نمایش کلاسیک گروه‌ها و قطعات با تنظیم تعداد ستون‌ها",
    icon: LayoutGrid,
  },
  {
    id: "trellis",
    label: "چیدمان آزاد",
    shortLabel: "آزاد",
    description: "پنجره‌های شناور، تب‌دار و مقیاس‌پذیر بدون محدودیت ستون",
    icon: PanelsTopLeft,
  },
  {
    id: "canvas",
    label: "شیت بوم",
    shortLabel: "شیت بوم",
    description: "بوم یکپارچه با قابلیت جابه‌جایی آزاد، تغییر اندازه و بزرگ‌نمایی لمسی",
    icon: Workflow,
  },
];

interface WorkspaceViewModeSelectorProps {
  compact?: boolean;
}

export default function WorkspaceViewModeSelector({
  compact = false,
}: WorkspaceViewModeSelectorProps) {
  const displayMode = useIoTStore((s) => s.workspaceDisplayMode);
  const setDisplayMode = useIoTStore((s) => s.setWorkspaceDisplayMode);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const pillLayoutId = compact
    ? "workspace-display-mode-pill-compact"
    : "workspace-display-mode-pill";

  return (
    <fieldset
      aria-label="فرم نمایش گروه‌ها و قطعات"
      className={cn(
        "m-0 inline-flex min-w-0 shrink-0 items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-2xs",
        compact ? "h-9" : "h-10 flex-wrap sm:flex-nowrap",
      )}
    >
      {VIEW_MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = displayMode === option.id;

        return (
          <Tooltip key={option.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-pressed={isActive}
                  aria-label={option.label}
                  onClick={() => setDisplayMode(option.id)}
                  className={cn(
                    "relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-xs font-semibold transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent3)]",
                    compact ? "h-7 px-2 sm:px-2.5" : "h-8 px-2.5 sm:px-3",
                    isActive
                      ? "text-[var(--accent3-foreground)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {isActive && (
                    <m.span
                      layoutId={pillLayoutId}
                      transition={animationsEnabled ? SPRING_SWAP : { duration: 0 }}
                      className="absolute inset-0 rounded-lg bg-[var(--accent3)] shadow-2xs"
                    />
                  )}
                  <Icon className="relative z-10 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="relative z-10 whitespace-nowrap">
                    {compact ? (
                      <>
                        <span className="hidden sm:inline">{option.shortLabel}</span>
                        <span className="sm:hidden">{option.shortLabel}</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">{option.label}</span>
                        <span className="sm:hidden">{option.shortLabel}</span>
                      </>
                    )}
                  </span>
                </button>
              }
            />
            <TooltipContent>{option.description}</TooltipContent>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}
