"use client";

import { Columns2, Columns3, Rows2 } from "lucide-react";
import { m } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

interface GroupColsOption {
  cols: 1 | 2 | 3;
  label: string;
  description: string;
  icon: typeof Rows2;
}

const GROUP_COLS_OPTIONS: readonly GroupColsOption[] = [
  {
    cols: 1,
    label: "۱",
    description: "نمایش گروه‌ها در ۱ ستون",
    icon: Rows2,
  },
  {
    cols: 2,
    label: "۲",
    description: "نمایش گروه‌ها در ۲ ستون",
    icon: Columns2,
  },
  {
    cols: 3,
    label: "۳",
    description: "نمایش گروه‌ها در ۳ ستون",
    icon: Columns3,
  },
];

export default function GroupColsSelector() {
  const groupsCols = useIoTStore((s) => s.groupsCols);
  const setGroupsCols = useIoTStore((s) => s.setGroupsCols);
  const selectedGroupFilter = useIoTStore((s) => s.selectedGroupFilter);
  const setSelectedGroupFilter = useIoTStore((s) => s.setSelectedGroupFilter);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);

  const handleSelectCols = (cols: 1 | 2 | 3) => {
    setGroupsCols(cols);

    if (selectedGroupFilter && cols > 1) {
      setSelectedGroupFilter(null);
    }
  };

  return (
    <fieldset
      aria-label="تعداد ستون گروه‌های داشبورد"
      className="m-0 inline-flex h-10 min-w-0 shrink-0 items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-1 shadow-2xs"
    >
      {GROUP_COLS_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = groupsCols === option.cols;

        return (
          <Tooltip key={option.cols}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-pressed={isActive}
                  aria-label={option.description}
                  onClick={() => handleSelectCols(option.cols)}
                  className={cn(
                    "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold tabular-nums transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent3)]",
                    isActive
                      ? "text-[var(--accent3-foreground)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {isActive && (
                    <m.span
                      layoutId="workspace-group-cols-pill"
                      transition={animationsEnabled ? SPRING_SWAP : { duration: 0 }}
                      className="absolute inset-0 rounded-lg bg-[var(--accent3)] shadow-2xs"
                    />
                  )}
                  <Icon className="relative z-10 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="relative z-10 whitespace-nowrap">{option.label} ستون</span>
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
