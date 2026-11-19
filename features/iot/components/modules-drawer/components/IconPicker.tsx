import { AnimatePresence, m, useReducedMotion } from "motion/react";
import React, { useState } from "react";
import { ChevronDown } from "@/components/ui/hugeicons-groups/shell";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  AVAILABLE_ICONS,
  getSegmentIcon,
  hasIcon,
  preloadSegmentIcons,
  SUGGESTED_EMOJIS,
} from "@/features/iot/utils/icons";
import { EASE_OUT } from "@/lib/ease";

interface IconPickerProps {
  label: string;
  isOptional?: boolean;
  selectedIcon: string;
  onSelectIcon: (val: string) => void;
}

export default function IconPicker({
  label,
  isOptional = true,
  selectedIcon,
  onSelectIcon,
}: IconPickerProps) {
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);
  const [showIcons, setShowIcons] = useState(false);
  const [iconMode, setIconMode] = useState<"emoji" | "hugeicons">("hugeicons");

  const warmIconCatalog = () => {
    preloadSegmentIcons(AVAILABLE_ICONS);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {isOptional && <span className="text-xs text-text-muted">(اختیاری)</span>}
        <span className="text-xs text-text-secondary font-medium block">{label}</span>
      </div>
      <button
        type="button"
        aria-expanded={showIcons}
        aria-label={label}
        onMouseEnter={warmIconCatalog}
        onFocus={warmIconCatalog}
        onClick={() => {
          warmIconCatalog();
          setShowIcons(!showIcons);
        }}
        className="w-full h-10 px-3 text-xs bg-bg-main text-text-primary border border-border-color rounded-lg flex items-center justify-between hover:border-accent3 transition-colors font-sans"
      >
        <ChevronDown
          strokeWidth={1.5}
          aria-hidden="true"
          className={`size-4 opacity-60 transition-transform duration-200 ${showIcons ? "rotate-180" : "rotate-0"}`}
        />
        <div className="flex items-center gap-2">
          <span>{selectedIcon ? "آیکون انتخاب شد" : "انتخاب آیکون"}</span>
          {selectedIcon &&
            (hasIcon(selectedIcon) ? (
              React.createElement(getSegmentIcon(selectedIcon), {
                strokeWidth: 1.5,
                className: "size-4 text-accent3",
              })
            ) : (
              <span className="text-base leading-none">{selectedIcon}</span>
            ))}
        </div>
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
          >
            <div className="p-3 bg-bg-main border border-border-color rounded-lg space-y-3">
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                value={[iconMode]}
                onValueChange={(vals) => {
                  const val = vals[0];

                  if (val === "emoji" || val === "hugeicons") setIconMode(val);
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="emoji"
                  className="flex-1 text-xs font-medium aria-pressed:bg-accent3 aria-pressed:text-bg-main"
                >
                  ایموجی
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="hugeicons"
                  className="flex-1 text-xs font-medium aria-pressed:bg-accent3 aria-pressed:text-bg-main"
                >
                  آیکون خطی
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectIcon("");
                    setShowIcons(false);
                  }}
                  className={`p-2 rounded-lg flex items-center justify-center transition-colors text-xs col-span-2 ${!selectedIcon ? "bg-accent3 text-bg-main" : "hover:bg-card-hover-bg text-text-secondary"}`}
                >
                  بدون آیکون
                </button>
                {iconMode === "emoji"
                  ? SUGGESTED_EMOJIS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => {
                          onSelectIcon(icon);
                          setShowIcons(false);
                        }}
                        className={`p-2 rounded-lg flex items-center justify-center text-lg leading-none transition-colors ${selectedIcon === icon ? "bg-accent3 text-bg-main" : "hover:bg-card-hover-bg text-text-secondary"}`}
                      >
                        {icon}
                      </button>
                    ))
                  : AVAILABLE_ICONS.map((iconName) => (
                      <Tooltip key={iconName}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => {
                                onSelectIcon(iconName);
                                setShowIcons(false);
                              }}
                              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${selectedIcon === iconName ? "bg-accent3 text-bg-main" : "hover:bg-card-hover-bg text-text-secondary"}`}
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
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
