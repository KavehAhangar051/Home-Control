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
              className={`group relative inline-flex size-9 h-9 w-9 min-w-9 shrink-0 items-center justify-center gap-0 rounded-full border p-0 px-0 transition-[background-color,border-color,color,transform] duration-200 ease-out cursor-pointer select-none touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 active:scale-[0.96] ${
                isDark
                  ? "bg-white/5 aria-pressed:bg-white/5 data-[state=on]:bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-neutral-300 hover:text-white focus-visible:ring-offset-neutral-950"
                  : "bg-neutral-100 aria-pressed:bg-neutral-100 data-[state=on]:bg-neutral-100 hover:bg-neutral-200/80 border-neutral-200 hover:border-neutral-300 text-neutral-700 hover:text-neutral-900 focus-visible:ring-offset-white"
              }`}
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
                      <Sun aria-hidden="true" className="size-4 text-amber-400" />
                    ) : (
                      <Moon aria-hidden="true" className="size-4 text-neutral-800" />
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
