"use client";

/**
 * @file components/layout/theme-toggle.tsx
 * @description Header theme toggle button implementing the Circle Blur View Transition API reveal.
 */

import type React from "react";
import { useRef } from "react";
import { ActionSwapIcon } from "@/components/motion/action-swap";
import { useThemeToggle } from "@/components/motion/theme-toggle";
import { Moon, Sun } from "@/components/ui/hugeicons";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Renders the theme switcher button in the application header with Circle Blur View Transition.
 *
 * @returns {React.JSX.Element} The rendered ThemeToggle component.
 */
export function ThemeToggle(): React.JSX.Element {
  const { isDark, mounted, toggle } = useThemeToggle({
    variant: "circle-blur",
    start: "center",
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 100);
    const y = Math.round(((rect.top + rect.height / 2) / window.innerHeight) * 100);

    toggle(`${x}% ${y}%`);
  };

  const titleText = isDark ? "تغییر به حالت روز (روشن)" : "تغییر به حالت شب (تاریک)";

  return (
    <div id="header-theme-container" className="flex items-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              ref={buttonRef}
              id="header-theme-toggle"
              pressed={isDark}
              onClick={handleToggle}
              aria-label={titleText}
              className="group relative inline-flex size-9 size-9 min-w-9 shrink-0 items-center justify-center gap-0 rounded-lg border border-sidebar-border bg-sidebar-control-bg p-0 px-0 text-sidebar-muted transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer select-none touch-manipulation hover:bg-sidebar-hover hover:text-sidebar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent3 active:scale-[0.97]"
            >
              <span
                className="relative flex size-4 items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {mounted ? (
                  <ActionSwapIcon
                    value={isDark ? "dark" : "light"}
                    animation="blur"
                    className="size-4"
                  >
                    {isDark ? (
                      <Sun aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    ) : (
                      <Moon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    )}
                  </ActionSwapIcon>
                ) : (
                  <span className="size-4 inline-block" />
                )}
              </span>
            </Toggle>
          }
        />
        <TooltipContent side="top">{titleText}</TooltipContent>
      </Tooltip>
    </div>
  );
}
