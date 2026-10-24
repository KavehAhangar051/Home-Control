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
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 8 });
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
            style={{ top: position.top, left: position.left }}
          >
            {label}
          </div>,
          document.body,
        )}
    </div>
  );
}
