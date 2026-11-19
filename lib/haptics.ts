"use client";

import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";

export type HapticPattern =
  | "tap"
  | "toggleOn"
  | "toggleOff"
  | "push"
  | "macro"
  | "voice"
  | "success"
  | "error";

const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  toggleOn: 14,
  toggleOff: [10, 26, 10],
  push: 16,
  macro: [14, 30, 20],
  voice: 22,
  success: [12, 34, 16],
  error: [26, 42, 26, 42, 26],
};

/**
 * Returns true when the current browser/device exposes the Vibration API.
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Triggers subtle tactile feedback via the Web Vibration API.
 * Silently no-ops on unsupported devices (e.g. desktop / iOS Safari),
 * when `prefers-reduced-motion: reduce` is active, or when disabled in Settings.
 */
export function triggerHaptic(pattern: HapticPattern, options?: { force?: boolean }): boolean {
  if (!isHapticsSupported()) return false;

  if (!options?.force) {
    if (!usePreferencesStore.getState().hapticsEnabled) return false;
    if (prefersReducedMotion()) return false;
  }

  try {
    return navigator.vibrate(HAPTIC_PATTERNS[pattern]);
  } catch {
    return false;
  }
}
