"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

interface MotionProviderProps {
  children: ReactNode;
}

const loadDomMax = () => import("motion/react").then((mod) => mod.domMax);

/**
 * Wraps client subtrees with Motion's async `LazyMotion` runtime (`domMax`) so all
 * `m.*` elements load gesture/layout features without blocking initial HTML hydration.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return <LazyMotion features={loadDomMax}>{children}</LazyMotion>;
}
