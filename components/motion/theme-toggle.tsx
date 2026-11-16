"use client";

/**
 * @file components/motion/theme-toggle.tsx
 * @description Theme toggle component repainting the page through the View Transition API.
 * Supports rectangle, circle, circle-blur, and blinds animation variants.
 */

import { useReducedMotion } from "motion/react";
import { type ComponentPropsWithoutRef, useEffect, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { ActionSwapIcon } from "@/components/motion/action-swap";
import { Moon, Sun } from "@/components/ui/hugeicons";
import { Toggle } from "@/components/ui/toggle";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { cn } from "@/lib/utils";
import {
  CIRCLE_ORIGIN,
  RECT_FROM,
  type RectStart,
  type ThemeVariant,
  VT_CSS,
  VT_STYLE_ID,
} from "./theme-toggle-config";

export type { RectStart, ThemeVariant };

const emptySubscribe = () => () => {};

export interface ThemeToggleProps
  extends Omit<
    ComponentPropsWithoutRef<typeof Toggle>,
    "children" | "onClick" | "onToggle" | "pressed" | "variant"
  > {
  /** Animation variant for the reveal. Default: "rectangle". */
  variant?: ThemeVariant;
  /** Origin direction for the reveal. Default: "bottom-up". */
  start?: RectStart;
  /** Custom CSS classes for the toggle icon. */
  iconClassName?: string;
  /** Optional click callback after toggle execution. */
  onToggle?: (newTheme: "light" | "dark") => void;
}

/**
 * Custom hook to toggle theme using the View Transition API with configurable variants.
 *
 * @param {object} options - Options including variant and origin direction.
 * @returns {object} Controller object containing theme state and toggle function.
 */
export function useThemeToggle({
  variant = "rectangle",
  start = "bottom-up",
}: {
  variant?: ThemeVariant;
  start?: RectStart;
} = {}) {
  const storeIsDark = useIoTStore((s) => s.isDark);
  const setIsDark = useIoTStore((s) => s.setIsDark);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const reduce = (useReducedMotion() ?? false) || !animationsEnabled;

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (document.getElementById(VT_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = VT_STYLE_ID;
    el.textContent = VT_CSS;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", storeIsDark);
    root.classList.toggle("light", !storeIsDark);
    root.style.colorScheme = storeIsDark ? "dark" : "light";
  }, [storeIsDark]);

  const isDark = mounted ? storeIsDark : true;

  const applyThemeSynchronously = (next: "light" | "dark") => {
    const nextIsDark = next === "dark";

    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.toggle("dark", nextIsDark);
      root.classList.toggle("light", !nextIsDark);
      root.style.colorScheme = next;
    }

    flushSync(() => {
      setIsDark(nextIsDark);
    });
  };

  const toggle = (originOverride?: string) => {
    const next = isDark ? "light" : "dark";

    if (reduce || typeof document === "undefined" || !("startViewTransition" in document)) {
      if (typeof document !== "undefined") {
        const style = document.createElement("style");
        style.append(
          document.createTextNode(
            "*:not(#header-theme-toggle):not(#header-theme-toggle *),*::before,*::after{transition:none !important}",
          ),
        );
        document.head.append(style);
        applyThemeSynchronously(next);
        const _flushReflow = document.body.offsetHeight;
        void _flushReflow;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => style.remove());
        });
      } else {
        setIsDark(next === "dark");
      }

      return;
    }

    const root = document.documentElement;

    if (variant === "rectangle") {
      root.style.setProperty("--beui-vt-from", RECT_FROM[start]);
      root.dataset.beuiVt = "rect";
    } else if (variant === "blinds") {
      root.dataset.beuiVt = "blinds";
    } else {
      const origin = originOverride || CIRCLE_ORIGIN[start];
      root.style.setProperty("--beui-vt-origin", origin);
      root.dataset.beuiVt = variant;
    }

    // SAFETY: startViewTransition existence was verified above in this method
    const docWithVT = document as Document & {
      startViewTransition(cb: () => void | Promise<void>): { finished: Promise<void> };
    };

    const vt = docWithVT.startViewTransition(() => {
      const style = document.createElement("style");
      style.append(
        document.createTextNode(
          "*:not(#header-theme-toggle):not(#header-theme-toggle *),*::before,*::after{transition:none !important}",
        ),
      );
      document.head.append(style);
      applyThemeSynchronously(next);
      const _flushReflow = document.body.offsetHeight;
      void _flushReflow;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => style.remove());
      });
    });

    vt.finished.finally(() => {
      root.removeAttribute("data-beui-vt");
    });
  };

  return { isDark, mounted, toggle };
}

/**
 * ThemeToggle button component rendering an interactive icon with View Transition reveals.
 */
export function ThemeToggle({
  variant = "rectangle",
  start = "bottom-up",
  className,
  iconClassName,
  onToggle,
  ...rest
}: ThemeToggleProps) {
  const { isDark, mounted, toggle } = useThemeToggle({ variant, start });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    let origin: string | undefined;

    if (variant === "circle" || variant === "circle-blur") {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 100);
      const y = Math.round(((rect.top + rect.height / 2) / window.innerHeight) * 100);
      origin = `${x}% ${y}%`;
    }

    toggle(origin);
    onToggle?.(isDark ? "light" : "dark");
  };

  return (
    <Toggle
      pressed={isDark}
      aria-label={mounted && isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={handleClick}
      className={cn("flex items-center justify-center cursor-pointer select-none", className)}
      {...rest}
    >
      {mounted ? (
        <ActionSwapIcon
          value={isDark ? "dark" : "light"}
          animation="blur"
          className={iconClassName}
        >
          {isDark ? <Sun className={iconClassName} /> : <Moon className={iconClassName} />}
        </ActionSwapIcon>
      ) : (
        <span className={iconClassName} aria-hidden="true" />
      )}
    </Toggle>
  );
}
