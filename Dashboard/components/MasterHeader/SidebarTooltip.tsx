"use client";

import { createPortal } from "react-dom";
import { useState, type ReactNode } from "react";

interface SidebarTooltipProps {
  label: string;
  enabled: boolean;
  children: ReactNode;
}

export default function SidebarTooltip({ label, enabled, children }: SidebarTooltipProps) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  const showTooltip = (element: HTMLElement) => {
    if (!enabled) return;
    const rect = element.getBoundingClientRect();
    setPosition({ top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + 10 });
  };

  return (
    <div
      className="contents"
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
            className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-lg border border-[var(--sidebar-border)] bg-[var(--card-bg-solid)] px-3 py-2 text-xs font-medium text-[var(--sidebar-text)] shadow-xl"
            style={{ top: position.top, right: position.right }}
          >
            {label}
          </div>,
          document.body,
        )}
    </div>
  );
}
