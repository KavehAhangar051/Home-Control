"use client";

/**
 * @file lib/hooks/use-performance-tier.ts
 * @description Connects hardware baseline hints, Zustand `animationsFps`, page visibility,
 * and live `requestAnimationFrame` cadence into `html[data-perf-tier="full" | "lite"]`
 * and an SSR-safe `useSyncExternalStore` subscription for rich-but-adaptive UI rendering.
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  evaluateHardwareBaseline,
  FrameDropMonitor,
  type PerformanceTier,
  readBrowserHardwareHints,
  resolveEffectivePerformanceTier,
} from "@/lib/performanceTier";

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
 * Subscribes to the active adaptive performance tier (`"full" | "lite"`).
 * Only re-renders consumers when the session crosses between tiers.
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
 * Observes `animationsEnabled`, `animationsFps`, `isPageVisible`, hardware capability hints,
 * and passive frame deltas to manage `html[data-perf-tier]` without background wakeups.
 */
export function usePerformanceTierObserver(params: {
  animationsEnabled: boolean;
  animationsFps: number;
  isPageVisible: boolean;
}): void {
  const { animationsEnabled, animationsFps, isPageVisible } = params;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.animationsFps = String(animationsFps);
      document.documentElement.dataset.animationsEnabled = animationsEnabled ? "true" : "false";
    }

    const hardwareTier = evaluateHardwareBaseline(readBrowserHardwareHints());

    // Skip passive rAF polling entirely when hidden, disabled, locked to 30 FPS, or already lite hardware
    if (!animationsEnabled || animationsFps <= 30 || hardwareTier === "lite" || !isPageVisible) {
      setSharedPerformanceTier(
        resolveEffectivePerformanceTier({
          animationsFps,
          hardwareTier,
          runtimeTier: "full",
        }),
      );

      return;
    }

    setSharedPerformanceTier("full");

    const monitor = new FrameDropMonitor();
    let rafId: number | null = null;
    let lastTimestamp = 0;

    const tick = (timestamp: number) => {
      if (lastTimestamp > 0) {
        const nextRuntimeTier = monitor.recordFrame(timestamp - lastTimestamp);

        setSharedPerformanceTier(
          resolveEffectivePerformanceTier({
            animationsFps,
            hardwareTier,
            runtimeTier: nextRuntimeTier,
          }),
        );
      }

      lastTimestamp = timestamp;
      rafId = requestAnimationFrame(tick);
    };

    // Wait briefly for initial hydration and chunk settle before sampling runtime frame drops
    const warmupTimer = globalThis.setTimeout(() => {
      rafId = requestAnimationFrame(tick);
    }, 1500);

    return () => {
      globalThis.clearTimeout(warmupTimer);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [animationsEnabled, animationsFps, isPageVisible]);
}
