"use client";

import { ChevronDown, Play, Settings2, Zap } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboard } from "@/features/dashboard/context/DashboardContext";
import type { Macro } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { DURATION, EASE_OUT } from "@/lib/ease";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface MacroSidebarProps {
  compact?: boolean;
  className?: string;
}

const BIDI_CHARS_REGEX = /[\u200c\u200f\u202a-\u202e]/g;
const MULTI_SPACE_REGEX = /\s+/g;

export function filterVisibleMacros(macros: readonly Macro[]): Macro[] {
  return macros.filter(
    (macro) =>
      macro.title.replace(BIDI_CHARS_REGEX, "").replace(MULTI_SPACE_REGEX, " ").trim() !==
      "تمام سگمنت ها روشن",
  );
}

export function isMultiCharTextIcon(icon?: string): boolean {
  if (!icon || hasIcon(icon)) return false;

  const trimmed = icon.trim();

  return trimmed.length > 2 && /^[\w.-]+$/.test(trimmed);
}

export function MacroGlyph({
  icon,
  className = "size-3.5",
}: {
  icon?: string;
  className?: string;
}) {
  if (icon) {
    if (hasIcon(icon)) {
      return React.createElement(getSegmentIcon(icon), {
        className: cn(className, "shrink-0"),
        strokeWidth: 1.9,
        "aria-hidden": true,
      });
    }

    if (isMultiCharTextIcon(icon)) {
      return (
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center justify-center px-1 font-mono text-[10px] font-semibold tracking-tight leading-none"
          dir="ltr"
        >
          {icon.trim()}
        </span>
      );
    }

    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center text-sm leading-none"
      >
        {icon}
      </span>
    );
  }

  return <Zap aria-hidden="true" strokeWidth={1.9} className={cn(className, "shrink-0")} />;
}

/**
 * Compact header-anchored custom buttons (macros) selector for desktop.
 * Renders uniformly across Grid, Trellis, and Canvas display modes on desktop
 * without consuming vertical workspace space or overlapping cards.
 */
export default function MacroSidebar({ compact = false, className = "" }: MacroSidebarProps) {
  const { handleExecuteMacro } = useDashboard();
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const macros = useIoTStore((s) => s.macros);
  const setActiveSettingsTab = useIoTStore((s) => s.setActiveSettingsTab);
  const setActiveWorkspaceView = useIoTStore((s) => s.setActiveWorkspaceView);

  const visibleMacros = useMemo(() => filterVisibleMacros(macros), [macros]);

  const [isOpen, setIsOpen] = useState(false);
  const [recentMacroId, setRecentMacroId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onCloseMenu = useEffectEvent(() => {
    setIsOpen(false);
  });

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!recentMacroId) return;

    const timer = setTimeout(() => setRecentMacroId(null), 900);

    return () => clearTimeout(timer);
  }, [recentMacroId]);

  const executeMacro = useCallback(
    (macro: Macro) => {
      triggerHaptic("macro");
      void handleExecuteMacro(macro);
      setRecentMacroId(macro.id);
      setIsOpen(false);
    },
    [handleExecuteMacro],
  );

  const handleManageMacros = useCallback(() => {
    setIsOpen(false);
    setActiveSettingsTab("macros");
    setActiveWorkspaceView("settings");
  }, [setActiveSettingsTab, setActiveWorkspaceView]);

  if (visibleMacros.length === 0) {
    return null;
  }

  const triggerHeight = compact ? "h-8 rounded-lg px-2.5" : "h-9 rounded-xl px-3";

  if (visibleMacros.length === 1) {
    const singleMacro = visibleMacros[0];
    const isRunning = recentMacroId === singleMacro.id;

    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => executeMacro(singleMacro)}
              aria-label={`اجرای دکمه سفارشی ${singleMacro.title}`}
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1.5 border bg-bg-main text-xs font-medium shadow-2xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 active:scale-[0.98]",
                triggerHeight,
                isRunning
                  ? "border-accent3 bg-accent3/15 text-text-primary"
                  : "border-border-color text-text-primary hover:border-accent3 hover:bg-sidebar-hover",
                className,
              )}
            >
              <span
                className={cn(
                  "flex h-5 shrink-0 items-center justify-center rounded-md bg-accent3/15 text-accent3",
                  isMultiCharTextIcon(singleMacro.icon) ? "min-w-5 px-0.5" : "w-5",
                )}
              >
                <MacroGlyph icon={singleMacro.icon} className="size-3.5" />
              </span>
              <span className="max-w-[7.5rem] truncate">{singleMacro.title}</span>
            </button>
          }
        />
        <TooltipContent>
          اجرای سریع «{singleMacro.title}» ({singleMacro.actions.length} فرمان)
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div ref={containerRef} dir="rtl" className={cn("relative shrink-0", className)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              aria-label="انتخاب و اجرای دکمه‌های سفارشی"
              className={cn(
                "inline-flex shrink-0 cursor-pointer items-center gap-1.5 border bg-bg-main text-xs font-medium shadow-2xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 active:scale-[0.98]",
                triggerHeight,
                isOpen
                  ? "border-accent3 bg-sidebar-hover text-text-primary"
                  : "border-border-color text-text-secondary hover:border-accent3/70 hover:bg-sidebar-hover hover:text-text-primary",
              )}
            >
              <Zap
                aria-hidden="true"
                strokeWidth={1.9}
                className="size-3.5 shrink-0 text-accent3"
              />
              <span
                className={compact ? "hidden xs:inline whitespace-nowrap" : "whitespace-nowrap"}
              >
                ماکروها
              </span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-secondary px-1 font-mono text-[10px] font-semibold tabular-nums text-text-secondary">
                {visibleMacros.length}
              </span>
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.8}
                className={cn(
                  "size-3.5 shrink-0 text-text-muted transition-transform duration-150",
                  isOpen && "rotate-180 text-text-primary",
                )}
              />
            </button>
          }
        />
        <TooltipContent>دکمه‌های سفارشی و سناریوهای سریع</TooltipContent>
      </Tooltip>

      <AnimatePresence>
        {isOpen && (
          <m.div
            role="menu"
            aria-label="فهرست دکمه‌های سفارشی"
            initial={animationsEnabled ? { opacity: 0, y: -6, scale: 0.97 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              animationsEnabled
                ? { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12, ease: EASE_OUT } }
                : undefined
            }
            transition={{ duration: DURATION.quick, ease: EASE_OUT }}
            className="absolute top-full left-0 z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] origin-top-left overflow-hidden rounded-2xl border border-border-color bg-card-bg-solid p-1.5 text-right shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border-color/70 px-2.5 pt-1 pb-2">
              <span className="text-[11px] font-medium text-text-muted">اجرای سریع ماکرو</span>
              <span className="font-mono text-[10px] tabular-nums text-text-muted">
                {visibleMacros.length} مورد
              </span>
            </div>

            <div className="mt-1 flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {visibleMacros.map((macro) => {
                const isRecent = recentMacroId === macro.id;

                return (
                  <button
                    key={macro.id}
                    type="button"
                    role="menuitem"
                    onClick={() => executeMacro(macro)}
                    className={cn(
                      "group flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-right transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                      isRecent
                        ? "bg-accent3/15 text-text-primary"
                        : "text-text-primary hover:bg-sidebar-hover",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 shrink-0 items-center justify-center rounded-lg border border-border-color bg-secondary text-accent3 transition-colors group-hover:border-accent3/50 group-hover:bg-accent3 group-hover:text-accent3-foreground",
                          isMultiCharTextIcon(macro.icon) ? "min-w-8 px-1" : "w-8",
                        )}
                      >
                        <MacroGlyph icon={macro.icon} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-text-primary">
                          {macro.title}
                        </span>
                        <span className="block text-[11px] text-text-muted">
                          {macro.actions.length} فرمان هم‌زمان
                        </span>
                      </span>
                    </span>
                    <Play
                      aria-hidden="true"
                      strokeWidth={2}
                      className="size-3.5 shrink-0 text-text-muted opacity-70 transition-[color,opacity] group-hover:text-accent3 group-hover:opacity-100"
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-1 border-t border-border-color/70 pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={handleManageMacros}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-sidebar-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
              >
                <Settings2 aria-hidden="true" className="size-3.5 shrink-0" />
                <span>مدیریت دکمه‌های سفارشی</span>
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
