"use client";

import { domMax, LazyMotion } from "motion/react";
import type { ReactNode } from "react";

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * Wraps client subtrees with Motion's `LazyMotion` runtime (`domMax`) so all
 * `m.*` elements share layout, gesture, and spring features with reduced bundle cost.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return <LazyMotion features={domMax}>{children}</LazyMotion>;
}
