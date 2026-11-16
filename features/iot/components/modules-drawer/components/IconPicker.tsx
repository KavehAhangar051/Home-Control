import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "@/components/ui/hugeicons";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AVAILABLE_ICONS,
  getSegmentIcon,
  hasIcon,
  SUGGESTED_EMOJIS,
} from "@/features/iot/utils/icons";

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
  const [showIcons, setShowIcons] = useState(false);
  const [iconMode, setIconMode] = useState<"emoji" | "hugeicons">("hugeicons");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {isOptional && <span className="text-xs theme-text-muted">(اختیاری)</span>}
        <span className="text-xs theme-text-secondary font-medium block">{label}</span>
      </div>
      <button
        type="button"
        aria-expanded={showIcons}
        aria-label={label}
        onClick={() => setShowIcons(!showIcons)}
        className="w-full h-10 px-3 text-xs bg-[var(--bg-main)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg flex items-center justify-between hover:border-[var(--accent3)] transition-colors font-sans"
      >
        {showIcons ? (
          <ChevronUp strokeWidth={1.5} className="w-4 h-4 opacity-60" />
        ) : (
          <ChevronDown strokeWidth={1.5} className="w-4 h-4 opacity-60" />
        )}
        <div className="flex items-center gap-2">
          <span>{selectedIcon ? "آیکون انتخاب شد" : "انتخاب آیکون"}</span>
          {selectedIcon &&
            (hasIcon(selectedIcon) ? (
              React.createElement(getSegmentIcon(selectedIcon), {
                strokeWidth: 1.5,
                className: "w-4 h-4 text-[var(--accent3)]",
              })
            ) : (
              <span className="text-base leading-none">{selectedIcon}</span>
            ))}
        </div>
      </button>

      {showIcons && (
        <div className="p-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg space-y-3">
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
              className="flex-1 text-xs font-medium aria-pressed:bg-[var(--accent3)] aria-pressed:text-[var(--bg-main)]"
            >
              ایموجی
            </ToggleGroupItem>
            <ToggleGroupItem
              value="hugeicons"
              className="flex-1 text-xs font-medium aria-pressed:bg-[var(--accent3)] aria-pressed:text-[var(--bg-main)]"
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
              className={`p-2 rounded-lg flex items-center justify-center transition-colors text-xs col-span-2 ${!selectedIcon ? "bg-[var(--accent3)] text-[var(--bg-main)]" : "hover:bg-[var(--card-hover-bg)] text-[var(--text-secondary)]"}`}
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
                    className={`p-2 rounded-lg flex items-center justify-center text-lg leading-none transition-colors ${selectedIcon === icon ? "bg-[var(--accent3)] text-[var(--bg-main)]" : "hover:bg-[var(--card-hover-bg)] text-[var(--text-secondary)]"}`}
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
                          className={`p-2 rounded-lg flex items-center justify-center transition-colors ${selectedIcon === iconName ? "bg-[var(--accent3)] text-[var(--bg-main)]" : "hover:bg-[var(--card-hover-bg)] text-[var(--text-secondary)]"}`}
                          aria-label={iconName}
                        >
                          {React.createElement(getSegmentIcon(iconName), { className: "w-4 h-4" })}
                        </button>
                      }
                    />
                    <TooltipContent>{iconName}</TooltipContent>
                  </Tooltip>
                ))}
          </div>
        </div>
      )}
    </div>
  );
}
