"use client";

/**
 * @file components/motion/dock.tsx
 * @description Floating dock toolbar with a shared-layout gliding active pill and grouped separators.
 * Adapted from beui.dev Dock for Motion LazyMotion (`m.*`), RTL, and dashboard semantic tokens.
 */

import { m, useReducedMotion } from "motion/react";
import { createContext, type PointerEvent, type ReactNode, useContext, useId, useMemo } from "react";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type DockContextValue = {
  size: number;
  pillLayoutId: string;
};

const DockContext = createContext<DockContextValue | null>(null);

export interface DockProps {
  children: ReactNode;
  className?: string;
  /** Size of each item in px. */
  size?: number;
}

/**
 * Floating bottom toolbar container that shares a uniform item size and gliding active indicator.
 */
export function Dock({ children, size = 44, className }: DockProps) {
  const pillLayoutId = useId();
  const ctx = useMemo<DockContextValue>(() => ({ size, pillLayoutId }), [size, pillLayoutId]);

  return (
    <DockContext.Provider value={ctx}>
      <div
        className={cn(
          "inline-flex h-auto items-center gap-1.5 rounded-[26px] border border-border-color bg-card-bg-solid/90 px-2 py-1.5 shadow-2xl backdrop-blur-xl",
          className,
        )}
      >
        {children}
      </div>
    </DockContext.Provider>
  );
}

export interface DockItemProps {
  children: ReactNode;
  className?: string;
  /** When set, the item renders as a <button>. Omit when children carry their own link or button. */
  onClick?: () => void;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLButtonElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  "aria-label"?: string;
  touchAction?: "none" | "manipulation";
}

/**
 * Individual interactive or wrapped item inside a Dock.
 */
export function DockItem({
  children,
  className,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
  active,
  touchAction,
  ...rest
}: DockItemProps) {
  const dock = useContext(DockContext);
  const reduce = useReducedMotion();
  const size = dock?.size ?? 44;
  const pillLayoutId = dock?.pillLayoutId ?? "dock-pill";

  const pill = active ? (
    <m.span
      layoutId={pillLayoutId}
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
      className="absolute inset-0.5 -z-10 rounded-[18px] bg-sidebar-hover"
    />
  ) : null;

  const sharedStyle = {
    width: size,
    height: size,
    ...(touchAction ? { touchAction } : {}),
  };

  const sharedClass = cn(
    "relative isolate flex shrink-0 items-center justify-center rounded-[18px] text-text-secondary transition-colors duration-150",
    active ? "text-text-primary" : "hover:text-text-primary",
    className,
  );

  const isButton = Boolean(onClick || onPointerDown || onPointerUp);

  if (isButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContextMenu}
        aria-label={rest["aria-label"]}
        aria-pressed={active}
        style={sharedStyle}
        className={cn(
          sharedClass,
          "cursor-pointer select-none border-0 bg-transparent p-0 outline-none",
          "focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-main",
        )}
      >
        {pill}
        {children}
      </button>
    );
  }

  // Children carry their own link or button (and its accessible name).
  return (
    <div style={sharedStyle} className={sharedClass}>
      {pill}
      {children}
    </div>
  );
}

/**
 * Subtle vertical hairline separating action groups inside a Dock.
 */
export function DockSeparator({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("mx-0.5 h-5 w-px shrink-0 self-center bg-border-color", className)} />
  );
}
