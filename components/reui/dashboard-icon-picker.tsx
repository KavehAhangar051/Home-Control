"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import React, { useId, useState } from "react";
import { CEmojiPicker1 } from "@/components/reui/c-emoji-picker-1";
import { ChevronDown } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  AVAILABLE_ICONS,
  getSegmentIcon,
  hasIcon,
  preloadSegmentIcons,
} from "@/features/iot/utils/icons";
import { EASE_OUT } from "@/lib/ease";
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

function renderSelectedGlyph(selectedIcon: string) {
  if (!selectedIcon) return null;

  if (hasIcon(selectedIcon)) {
    return React.createElement(getSegmentIcon(selectedIcon), {
      strokeWidth: 1.5,
      className: "size-4 text-accent3",
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

/**
 * Unified Dashboard Icon & Emoji Picker powered by ReUI `@reui/c-emoji-picker-1`
 * paired with smart-home Hugeicons and optional short custom label input.
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
  const generatedId = useId();
  const textInputId = inputId ?? `dashboard-icon-input-${generatedId}`;

  const [showIcons, setShowIcons] = useState(false);
  const [iconMode, setIconMode] = useState<"emoji" | "hugeicons">(() =>
    selectedIcon && hasIcon(selectedIcon) ? "hugeicons" : "emoji",
  );

  const warmIconCatalog = () => {
    preloadSegmentIcons(AVAILABLE_ICONS);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <span className="block text-sm font-bold text-text-primary">{label}</span>
        {isOptional && <span className="text-xs font-normal text-text-secondary">(اختیاری)</span>}
      </div>

      <button
        type="button"
        aria-expanded={showIcons}
        aria-label={label}
        onMouseEnter={warmIconCatalog}
        onFocus={warmIconCatalog}
        onClick={() => {
          warmIconCatalog();
          setShowIcons((prev) => !prev);
        }}
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border-color bg-bg-main px-3.5 font-sans text-sm text-text-primary transition-colors hover:border-accent3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {renderSelectedGlyph(selectedIcon)}
          <span className={selectedIcon ? "truncate font-medium" : "truncate text-text-secondary"}>
            {selectedIcon ? "آیکون انتخاب شد" : "انتخاب آیکون یا ایموجی"}
          </span>
        </div>
        <ChevronDown
          strokeWidth={1.75}
          aria-hidden="true"
          className={`size-4 shrink-0 text-text-secondary transition-transform duration-200 ${showIcons ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {showIcons && (
          <m.div
            key="icon-picker-panel"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    height: { duration: 0.22, ease: EASE_OUT },
                    opacity: { duration: 0.16, ease: EASE_OUT },
                  }
            }
            className="overflow-hidden"
            style={{ contain: "layout style", backfaceVisibility: "hidden" }}
          >
            <div className="space-y-3 rounded-lg border border-border-color bg-bg-main p-3">
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={[iconMode]}
                  onValueChange={(vals) => {
                    const val = vals[0];
                    if (val === "emoji" || val === "hugeicons") {
                      setIconMode(val);
                    }
                  }}
                  className="min-w-0 flex-1"
                >
                  <ToggleGroupItem
                    value="emoji"
                    className="flex-1 text-xs font-medium aria-pressed:bg-accent3 aria-pressed:text-accent3-foreground"
                  >
                    ایموجی
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="hugeicons"
                    className="flex-1 text-xs font-medium aria-pressed:bg-accent3 aria-pressed:text-accent3-foreground"
                  >
                    آیکون خطی
                  </ToggleGroupItem>
                </ToggleGroup>

                {selectedIcon && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectIcon("");
                      setShowIcons(false);
                    }}
                    className="h-7 rounded-md border border-border-color px-2.5 text-xs text-text-secondary transition-colors hover:bg-card-hover-bg"
                  >
                    بدون آیکون
                  </button>
                )}
              </div>

              {allowCustomText && (
                <div className="space-y-1">
                  <label htmlFor={textInputId} className="sr-only">
                    {label}
                  </label>
                  <Input
                    id={textInputId}
                    value={selectedIcon}
                    maxLength={24}
                    onChange={(event) => onSelectIcon(event.target.value)}
                    placeholder="یا متن کوتاه دلخواه (مثلاً 💡 یا ON) را وارد کنید"
                    className="text-right font-sans text-xs"
                  />
                </div>
              )}

              {iconMode === "emoji" ? (
                <div className="flex justify-center overflow-x-auto">
                  <CEmojiPicker1
                    value={selectedIcon && !hasIcon(selectedIcon) ? selectedIcon : null}
                    onValueChange={(picked) => {
                      onSelectIcon(picked ?? "");
                      if (picked) setShowIcons(false);
                    }}
                    columns={9}
                    size="default"
                    className="mx-auto"
                  />
                </div>
              ) : (
                <div className="grid max-h-44 grid-cols-6 gap-2 overflow-y-auto pr-1 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectIcon("");
                      setShowIcons(false);
                    }}
                    className={`col-span-2 flex items-center justify-center rounded-lg p-2 text-xs transition-colors ${!selectedIcon ? "bg-accent3 text-accent3-foreground" : "text-text-secondary hover:bg-card-hover-bg"}`}
                  >
                    بدون آیکون
                  </button>
                  {AVAILABLE_ICONS.map((iconName) => (
                    <Tooltip key={iconName}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => {
                              onSelectIcon(iconName);
                              setShowIcons(false);
                            }}
                            className={`flex items-center justify-center rounded-lg p-2 transition-colors ${selectedIcon === iconName ? "bg-accent3 text-accent3-foreground" : "text-text-secondary hover:bg-card-hover-bg"}`}
                            aria-label={iconName}
                          >
                            {React.createElement(getSegmentIcon(iconName), {
                              className: "size-4",
                            })}
                          </button>
                        }
                      />
                      <TooltipContent>{iconName}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
