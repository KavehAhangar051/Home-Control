"use client";

import { Smile, Shapes, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import React, { type CSSProperties, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CEmojiPicker1 } from "@/components/reui/c-emoji-picker-1";
import { LineIconPicker } from "@/components/reui/line-icon-picker";
import { ChevronDown } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useMediaQuery } from "@/features/iot/hooks/useMediaQuery";
import { getIconPersianLabel } from "@/features/iot/utils/iconCatalog";
import {
  AVAILABLE_ICONS,
  getSegmentIcon,
  hasIcon,
  preloadSegmentIcons,
} from "@/features/iot/utils/icons";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface DashboardIconPickerProps {
  label: string;
  isOptional?: boolean;
  selectedIcon: string;
  onSelectIcon: (val: string) => void;
  /** Optional text/emoji direct entry inside the picker (used by Settings -> Macros). */
  allowCustomText?: boolean;
  inputId?: string;
  className?: string;
}

const EMOJI_PANEL_STYLE = {
  "--emoji-picker-list-height": "clamp(220px, 44dvh, 340px)",
} as CSSProperties;

function renderSelectedGlyph(selectedIcon: string) {
  if (!selectedIcon) return null;

  if (hasIcon(selectedIcon)) {
    return React.createElement(getSegmentIcon(selectedIcon), {
      strokeWidth: 1.75,
      className: "size-4.5 text-accent3",
      "aria-hidden": true,
    });
  }

  if (selectedIcon.trim().length > 2 && /^[\w.-]+$/.test(selectedIcon.trim())) {
    return (
      <span className="rounded bg-card-hover-bg px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent3">
        {selectedIcon.trim()}
      </span>
    );
  }

  return <span className="text-base leading-none">{selectedIcon}</span>;
}

function getSelectedLabel(selectedIcon: string): string {
  if (!selectedIcon) return "انتخاب آیکون یا ایموجی";
  if (hasIcon(selectedIcon)) {
    return getIconPersianLabel(selectedIcon) ?? selectedIcon;
  }
  return selectedIcon.trim().length > 2 && /^[\w.-]+$/.test(selectedIcon.trim())
    ? "برچسب دلخواه"
    : "ایموجی انتخاب شد";
}

/**
 * Mobile-first Dashboard Icon & Emoji Picker:
 * - Compact 44px form trigger with optional quick-clear action
 * - Opens a Bottom Sheet on mobile (< md) and centered Dialog on desktop (md:+)
 * - Houses unified unboxed `@reui/c-emoji-picker-1` and categorized `LineIconPicker`
 */
export function DashboardIconPicker({
  label,
  isOptional = true,
  selectedIcon,
  onSelectIcon,
  allowCustomText = false,
  inputId,
  className,
}: DashboardIconPickerProps) {
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const generatedId = useId();
  const titleId = `dashboard-icon-title-${generatedId}`;
  const textInputId = inputId ?? `dashboard-icon-input-${generatedId}`;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [iconMode, setIconMode] = useState<"emoji" | "hugeicons">(() =>
    selectedIcon && !hasIcon(selectedIcon) ? "emoji" : "hugeicons",
  );
  const [customDraft, setCustomDraft] = useState(selectedIcon);

  const warmIconCatalog = () => {
    preloadSegmentIcons(AVAILABLE_ICONS);
  };

  const openPicker = () => {
    warmIconCatalog();
    setCustomDraft(selectedIcon);
    if (selectedIcon) {
      setIconMode(hasIcon(selectedIcon) ? "hugeicons" : "emoji");
    }
    setIsOpen(true);
  };

  const closePicker = useCallback(() => {
    setIsOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePicker();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePicker]);

  const sheetPortal =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {isOpen && (
              <m.div
                key="dashboard-icon-picker-backdrop"
                dir="rtl"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_QUICK}
                onClick={closePicker}
                className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 backdrop-blur-xs md:items-center md:p-4"
              >
                <m.div
                  key="dashboard-icon-picker-surface"
                  initial={
                    reduceMotion
                      ? false
                      : isDesktop
                        ? { opacity: 0, scale: 0.96, y: 10 }
                        : { y: "100%" }
                  }
                  animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0, transition: { duration: 0 } }
                      : isDesktop
                        ? { opacity: 0, scale: 0.96, y: 8, transition: TRANSITION_EXIT_QUICK }
                        : { y: "100%", transition: TRANSITION_EXIT_QUICK }
                  }
                  transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_QUICK}
                  onClick={(event) => event.stopPropagation()}
                  className="flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-b-0 border-border-color bg-card-bg-solid text-right shadow-2xl pb-[env(safe-area-inset-bottom)] md:max-h-[82dvh] md:max-w-lg md:rounded-2xl md:border-b md:pb-0"
                >
                  <div className="flex justify-center pt-2.5 pb-1 md:hidden" aria-hidden="true">
                    <span className="h-1 w-10 rounded-full bg-border-color" />
                  </div>

                  <div className="flex items-center justify-between gap-2 border-b border-border-color px-4 py-3">
                    <h3
                      id={titleId}
                      className="min-w-0 truncate font-sans text-sm font-bold text-text-primary"
                    >
                      {label}
                    </h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {selectedIcon && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectIcon("");
                            closePicker();
                          }}
                          className="min-h-9 cursor-pointer rounded-lg border border-border-color bg-bg-main px-2.5 text-xs font-medium text-text-secondary transition-colors hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
                        >
                          حذف آیکون
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={closePicker}
                        aria-label="بستن پنجره انتخاب آیکون"
                        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-color bg-bg-main text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
                      >
                        <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 border-b border-border-color bg-bg-main/50 px-3.5 py-2.5">
                    <div
                      role="tablist"
                      aria-label="نوع آیکون"
                      className="grid grid-cols-2 gap-1 rounded-xl border border-border-color bg-bg-main p-1"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={iconMode === "hugeicons"}
                        onClick={() => {
                          warmIconCatalog();
                          setIconMode("hugeicons");
                        }}
                        className={cn(
                          "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                          iconMode === "hugeicons"
                            ? "bg-accent3 text-accent3-foreground shadow-2xs"
                            : "text-text-secondary hover:text-text-primary",
                        )}
                      >
                        <Shapes className="size-3.5" strokeWidth={1.85} aria-hidden="true" />
                        <span>آیکون خطی</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={iconMode === "emoji"}
                        onClick={() => setIconMode("emoji")}
                        className={cn(
                          "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3",
                          iconMode === "emoji"
                            ? "bg-accent3 text-accent3-foreground shadow-2xs"
                            : "text-text-secondary hover:text-text-primary",
                        )}
                      >
                        <Smile className="size-3.5" strokeWidth={1.85} aria-hidden="true" />
                        <span>ایموجی</span>
                      </button>
                    </div>

                    {allowCustomText && (
                      <div className="flex items-center gap-2">
                        <label htmlFor={textInputId} className="sr-only">
                          {label}
                        </label>
                        <Input
                          id={textInputId}
                          value={customDraft}
                          maxLength={24}
                          onChange={(event) => {
                            const val = event.target.value;
                            setCustomDraft(val);
                            onSelectIcon(val);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              onSelectIcon(customDraft.trim());
                              closePicker();
                            }
                          }}
                          placeholder="یا متن کوتاه دلخواه (مثلاً 💡 یا ON)"
                          className="h-9 flex-1 text-right font-sans text-xs"
                        />
                        {customDraft.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectIcon(customDraft.trim());
                              closePicker();
                            }}
                            className="min-h-9 shrink-0 cursor-pointer rounded-lg bg-accent3 px-3 text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90"
                          >
                            اعمال
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden">
                    {iconMode === "emoji" ? (
                      <CEmojiPicker1
                        bare
                        columns="auto"
                        size="lg"
                        value={selectedIcon && !hasIcon(selectedIcon) ? selectedIcon : null}
                        onValueChange={(picked) => {
                          onSelectIcon(picked ?? "");
                          if (picked) closePicker();
                        }}
                        panelStyle={EMOJI_PANEL_STYLE}
                      />
                    ) : (
                      <LineIconPicker
                        value={hasIcon(selectedIcon) ? selectedIcon : undefined}
                        onSelect={(picked) => {
                          onSelectIcon(picked);
                          closePicker();
                        }}
                      />
                    )}
                  </div>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <span className="block text-sm font-bold text-text-primary">{label}</span>
        {isOptional && <span className="text-xs font-normal text-text-secondary">(اختیاری)</span>}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={label}
          onMouseEnter={warmIconCatalog}
          onFocus={warmIconCatalog}
          onClick={openPicker}
          className="flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border-color bg-bg-main px-3.5 font-sans text-sm text-text-primary transition-colors hover:border-accent3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {renderSelectedGlyph(selectedIcon)}
            <span
              className={selectedIcon ? "truncate font-medium" : "truncate text-text-secondary"}
            >
              {getSelectedLabel(selectedIcon)}
            </span>
          </span>
          <ChevronDown
            strokeWidth={1.75}
            aria-hidden="true"
            className="size-4 shrink-0 text-text-secondary"
          />
        </button>

        {selectedIcon && (
          <button
            type="button"
            onClick={() => onSelectIcon("")}
            aria-label={`پاک کردن ${label}`}
            title="پاک کردن آیکون"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border-color bg-bg-main text-text-secondary transition-colors hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>

      {sheetPortal}
    </div>
  );
}
