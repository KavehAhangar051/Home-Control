"use client";

import type { IconProps } from "@animate-ui/react/icons";
import React from "react";

export interface HugeIconProps
  extends Omit<IconProps<never>, "size" | "animate" | "animateOnHover" | "ref"> {
  size?: number | string;
  strokeWidth?: number;
  color?: string;
  className?: string;
  animateOnHover?: boolean;
  animate?: IconProps<never>["animate"];
  ref?: React.Ref<SVGSVGElement>;
}

export type HugeIconComponent = React.NamedExoticComponent<HugeIconProps>;

let cachedHoverMql: MediaQueryList | null = null;
let cachedReducedMotionMql: MediaQueryList | null = null;

function shouldEnableParentHoverListeners(): boolean {
  if (typeof window === "undefined") return false;

  cachedHoverMql ??= window.matchMedia("(hover: none)");
  cachedReducedMotionMql ??= window.matchMedia("(prefers-reduced-motion: reduce)");

  return !cachedHoverMql.matches && !cachedReducedMotionMql.matches;
}

const HOVER_TARGET_SELECTOR =
  'button, a, [role="button"], [data-slot="breadcrumb-page"], [data-slot="breadcrumb-link"], [data-animate-icon-parent]';

const svgHoverListeners = new WeakMap<SVGSVGElement, (hovered: boolean) => void>();
let activeHoverTarget: HTMLElement | null = null;
let delegatedHoverInitialized = false;

function setTargetIconsHovered(target: HTMLElement | null, hovered: boolean) {
  if (!target) return;

  const svgs = target.querySelectorAll<SVGSVGElement>("[data-hugeicon-hover]");

  for (let i = 0; i < svgs.length; i++) {
    svgHoverListeners.get(svgs[i])?.(hovered);
  }
}

function ensureDelegatedHoverListeners() {
  if (delegatedHoverInitialized || typeof document === "undefined") return;

  delegatedHoverInitialized = true;

  document.addEventListener(
    "pointerover",
    (e: PointerEvent) => {
      if (e.pointerType === "touch") return;

      const el = e.target instanceof Element ? e.target : null;
      const nextTarget = el?.closest<HTMLElement>(HOVER_TARGET_SELECTOR) ?? null;

      if (nextTarget === activeHoverTarget) return;

      setTargetIconsHovered(activeHoverTarget, false);
      activeHoverTarget = nextTarget;
      setTargetIconsHovered(activeHoverTarget, true);
    },
    { passive: true },
  );

  document.addEventListener(
    "pointerout",
    (e: PointerEvent) => {
      if (!activeHoverTarget) return;

      const related = e.relatedTarget instanceof Element ? e.relatedTarget : null;

      if (related && activeHoverTarget.contains(related)) return;

      setTargetIconsHovered(activeHoverTarget, false);
      activeHoverTarget = null;
    },
    { passive: true },
  );
}

/**
 * Creates an animated Hugeicons component backed by Animate UI and Motion.
 * Automatically animates when hovering either the icon or its parent container
 * via a single shared passive delegated pointer listener (zero per-icon mount DOM queries).
 */
export function createHugeIcon(
  IconComponent: React.ComponentType<IconProps<never>>,
  displayName?: string,
): HugeIconComponent {
  const BaseComponent = ({
    size = 24,
    strokeWidth = 2,
    className = "",
    animateOnHover = true,
    animate,
    ref: forwardedRef,
    ...props
  }: HugeIconProps) => {
    const localRef = React.useRef<SVGSVGElement | null>(null);
    const [isParentHovered, setIsParentHovered] = React.useState(false);

    const setRefs = React.useCallback(
      (node: SVGSVGElement | null) => {
        if (localRef.current && localRef.current !== node) {
          svgHoverListeners.delete(localRef.current);
        }

        localRef.current = node;

        if (node && animateOnHover && shouldEnableParentHoverListeners()) {
          ensureDelegatedHoverListeners();
          svgHoverListeners.set(node, setIsParentHovered);
        }

        if (forwardedRef instanceof Function) {
          forwardedRef(node);
        } else if (forwardedRef && "current" in forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef, animateOnHover],
    );

    if (!IconComponent) return null;

    // SAFETY: Animate UI icon wrappers forward ref and data-hugeicon-hover to the underlying motion SVG element
    const resolvedProps = {
      ...props,
      "data-hugeicon-hover": animateOnHover ? "" : undefined,
      ref: setRefs,
      size: Number(size) || 24,
      strokeWidth,
      className,
      animateOnHover,
      animate: animate ?? (animateOnHover ? isParentHovered : undefined),
    } as IconProps<never>;

    return <IconComponent {...resolvedProps} />;
  };

  if (displayName) {
    BaseComponent.displayName = displayName;
  }

  return React.memo(BaseComponent);
}
