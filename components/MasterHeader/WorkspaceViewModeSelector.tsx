"use client";

import { LayoutGrid, PanelsTopLeft } from "lucide-react";
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
];

export default function WorkspaceViewModeSelector() {
  const displayMode = useIoTStore((s) => s.workspaceDisplayMode);
  const setDisplayMode = useIoTStore((s) => s.setWorkspaceDisplayMode);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);

  return (
    <fieldset
      aria-label="فرم نمایش گروه‌ها و قطعات"
      className="m-0 inline-flex h-10 min-w-0 shrink-0 items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-2xs"
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
                    "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent3)]",
                    isActive
                      ? "text-[var(--accent3-foreground)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {isActive && (
                    <m.span
                      layoutId="workspace-display-mode-pill"
                      transition={animationsEnabled ? SPRING_SWAP : { duration: 0 }}
                      className="absolute inset-0 rounded-lg bg-[var(--accent3)] shadow-2xs"
                    />
                  )}
                  <Icon className="relative z-10 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="relative z-10 whitespace-nowrap">{option.label}</span>
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
