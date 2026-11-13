"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LayoutSelectorProps {
  maxCols: number;
  onColsChange: (cols: number) => void;
  parentGroupsCols: number;
  fullWidth?: boolean;
}

export default function LayoutSelector({
  maxCols,
  onColsChange,
  parentGroupsCols,
  fullWidth = false,
}: LayoutSelectorProps) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[String(maxCols)]}
      onValueChange={(vals) => {
        if (vals.length > 0) onColsChange(Number(vals[0]));
      }}
      className={`flex-row ${fullWidth ? "w-full *:flex-1" : ""} shrink-0 shadow-xs`}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <ToggleGroupItem
              value="1"
              aria-label="تک ستون"
              className={`${parentGroupsCols === 3 ? "h-7 min-w-7 px-1.5" : "h-8 min-w-8 px-2"} cursor-pointer select-none aria-pressed:bg-[var(--accent3-transparent)] aria-pressed:text-[var(--accent3)]`}
            >
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <rect width="18" height="6" x="3" y="5" rx="2" />
                <rect width="18" height="6" x="3" y="13" rx="2" />
              </svg>
            </ToggleGroupItem>
          }
        />
        <TooltipContent>نمایش تک ستونه</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <ToggleGroupItem
              value="2"
              aria-label="دو ستون"
              className={`${parentGroupsCols === 3 ? "h-7 min-w-7 px-1.5" : "h-8 min-w-8 px-2"} cursor-pointer select-none aria-pressed:bg-[var(--accent3-transparent)] aria-pressed:text-[var(--accent3)]`}
            >
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <circle cx="7" cy="7" r="3" />
                <circle cx="17" cy="7" r="3" />
                <circle cx="7" cy="17" r="3" />
                <circle cx="17" cy="17" r="3" />
              </svg>
            </ToggleGroupItem>
          }
        />
        <TooltipContent>نمایش دو ستونه</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <ToggleGroupItem
              value="3"
              aria-label="سه ستون"
              className={`${parentGroupsCols === 3 ? "h-7 min-w-7 px-1.5" : "h-8 min-w-8 px-2"} cursor-pointer select-none aria-pressed:bg-[var(--accent3-transparent)] aria-pressed:text-[var(--accent3)]`}
            >
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <circle cx="5" cy="7" r="2" />
                <circle cx="12" cy="7" r="2" />
                <circle cx="19" cy="7" r="2" />
                <circle cx="5" cy="17" r="2" />
                <circle cx="12" cy="17" r="2" />
                <circle cx="19" cy="17" r="2" />
              </svg>
            </ToggleGroupItem>
          }
        />
        <TooltipContent>نمایش سه ستونه</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}
