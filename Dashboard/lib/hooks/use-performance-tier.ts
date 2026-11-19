"use client";

/**
 * @file lib/hooks/use-performance-tier.ts
 * @description Connects hardware baseline hints, Zustand `animationsFps`, page visibility,
 * and live `requestAnimationFrame` cadence into `html[data-perf-tier="full" | "lite"]`
 * and an SSR-safe `useSyncExternalStore` subscription for rich-but-adaptive UI rendering.
 */

import { useEffect, useSyncExternalStore } from "react";
import { type PerformanceTier, resolveEffectivePerformanceTier } from "@/lib/performanceTier";

let currentTier: PerformanceTier = "full";
const listeners = new Set<() => void>();

function setSharedPerformanceTier(next: PerformanceTier): void {
  if (typeof globalThis.document !== "undefined") {
    const root = globalThis.document.documentElement;

    if (root.dataset.perfTier !== next) {
      root.dataset.perfTier = next;
    }
  }

  if (next === currentTier) return;

  currentTier = next;

  for (const listener of listeners) {
    listener();
  }
}

function subscribePerformanceTier(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): PerformanceTier => currentTier;
const getServerSnapshot = (): PerformanceTier => "full";

/**
 * Subscribes to the active performance tier (`"full" | "lite"`).
 * Only re-renders consumers when the user changes animation/FPS settings.
 */
export function usePerformanceTier(): PerformanceTier {
  return useSyncExternalStore(subscribePerformanceTier, getSnapshot, getServerSnapshot);
}

/**
 * Convenience boolean selector for components stepping down GPU blur/SMIL filters in `"lite"` tier.
 */
export function useIsLitePerformanceTier(): boolean {
  return usePerformanceTier() === "lite";
}

/**
 * Synchronizes explicit user animation settings (`animationsEnabled`, `animationsFps`)
 * to `html[data-perf-tier]` with zero continuous background `requestAnimationFrame` polling.
 */
export function usePerformanceTierObserver(params: {
  animationsEnabled: boolean;
  animationsFps: number;
  isPageVisible: boolean;
}): void {
  const { animationsEnabled, animationsFps } = params;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.animationsFps = String(animationsFps);
      document.documentElement.dataset.animationsEnabled = animationsEnabled ? "true" : "false";
    }

    setSharedPerformanceTier(
      resolveEffectivePerformanceTier({
        animationsEnabled,
        animationsFps,
      }),
    );
  }, [animationsEnabled, animationsFps]);
}
