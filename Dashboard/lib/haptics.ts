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
  tap: 24,
  toggleOn: 30,
  toggleOff: [22, 36, 20],
  push: 32,
  macro: [26, 40, 34],
  voice: 36,
  success: [24, 42, 32],
  error: [40, 50, 40, 50, 40],
};

/**
 * Returns true when the current browser/device exposes the Vibration API.
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Triggers tactile feedback via the Web Vibration API.
 * Durations are tuned above AOSP/Motorola vibrator actuation floors (>= 22ms)
 * while staying crisp on MIUI/LRA devices, and respect the dedicated `hapticsEnabled`
 * preference rather than silently failing under Android reduced-animation / battery-saver modes.
 */
export function triggerHaptic(pattern: HapticPattern, options?: { force?: boolean }): boolean {
  if (!isHapticsSupported()) return false;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;

  if (!options?.force && !usePreferencesStore.getState().hapticsEnabled) {
    return false;
  }

  const rawPattern = HAPTIC_PATTERNS[pattern];

  try {
    const vibrated = navigator.vibrate(rawPattern);

    if (!vibrated && Array.isArray(rawPattern)) {
      return navigator.vibrate(rawPattern[0] ?? 28);
    }

    return vibrated;
  } catch {
    return false;
  }
}
