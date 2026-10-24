"use client";

import { createPortal } from "react-dom";
import { useState, type ReactNode } from "react";

interface SidebarTooltipProps {
  label: string;
  enabled: boolean;
  children: ReactNode;
}

export default function SidebarTooltip({ label, enabled, children }: SidebarTooltipProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const showTooltip = (element: HTMLElement) => {
    if (!enabled) return;
    const rect = element.getBoundingClientRect();
    const isRtl = getComputedStyle(element).direction === "rtl";
    setPosition({
      top: rect.top + rect.height / 2,
      left: isRtl ? rect.right + 8 : rect.left - 8,
    });
  };

  return (
    <div
      className={enabled ? "inline-flex" : "flex w-full"}
      onMouseEnter={event => showTooltip(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocusCapture={event => showTooltip(event.currentTarget)}
      onBlurCapture={() => setPosition(null)}
    >
      {children}
      {enabled && position && typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md"
            style={{
              top: position.top,
              left: position.left,
              transform: `translate(${getComputedStyle(document.documentElement).direction === "rtl" ? "0" : "-100%"}, -50%)`,
            }}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1/2 size-1.5 -translate-y-1/2 rotate-45 bg-foreground ${getComputedStyle(document.documentElement).direction === "rtl" ? "-left-0.5" : "-right-0.5"}`}
            />
            {label}
          </div>,
          document.body,
        )}
    </div>
  );
}
