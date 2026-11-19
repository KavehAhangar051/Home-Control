/**
 * @file lib/performanceTier.ts
 * @description Headless adaptive performance-tier evaluator and sliding-window frame-drop detector.
 * Keeps compositor transforms, springs, and transitions active on all hardware while automatically
 * stepping down GPU-heavy blur/filter and dual SMIL wire-particle effects on constrained devices.
 */

export type PerformanceTier = "full" | "lite";

export interface HardwareHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  prefersReducedData?: boolean;
}

export interface FrameDropMonitorOptions {
  /** Frame delta in ms above which a frame counts as dropped for a 60 Hz budget (default: 28 ms). */
  slowFrameMs?: number;
  /** Ignore single pauses larger than this (tab switch, modal pause, debugger breakpoint; default: 250 ms). */
  outlierPauseMs?: number;
  /** Sliding window size in frames (default: 16). */
  windowSize?: number;
  /** Number of slow frames within `windowSize` required to downgrade to `lite` (default: 6). */
  downgradeSlowCount?: number;
  /** Consecutive fast frames (`<= recoveryFrameMs`) required before promoting back to `full` (default: 90). */
  recoveryStreakFrames?: number;
  /** Frame delta threshold considered smooth for recovery (default: 20 ms). */
  recoveryFrameMs?: number;
}

const DEFAULT_SLOW_FRAME_MS = 28;
const DEFAULT_OUTLIER_PAUSE_MS = 250;
const DEFAULT_WINDOW_SIZE = 16;
const DEFAULT_DOWNGRADE_SLOW_COUNT = 6;
const DEFAULT_RECOVERY_STREAK = 90;
const DEFAULT_RECOVERY_FRAME_MS = 20;

/**
 * Evaluates static device hints to determine whether heavy GPU blur/filter passes
 * should start in `lite` tier or run at `full` fidelity.
 */
export function evaluateHardwareBaseline(hints: HardwareHints): PerformanceTier {
  if (hints.saveData || hints.prefersReducedData) {
    return "lite";
  }

  if (
    hints.deviceMemory !== undefined &&
    Number.isFinite(hints.deviceMemory) &&
    hints.deviceMemory > 0 &&
    hints.deviceMemory <= 2
  ) {
    return "lite";
  }

  if (
    hints.hardwareConcurrency !== undefined &&
    Number.isFinite(hints.hardwareConcurrency) &&
    hints.hardwareConcurrency > 0 &&
    hints.hardwareConcurrency <= 2
  ) {
    return "lite";
  }

  return "full";
}

/**
 * Reads browser hardware/network hints safely without throwing in SSR or restricted WebViews.
 */
export function readBrowserHardwareHints(): HardwareHints {
  if (typeof globalThis.navigator === "undefined") {
    return {};
  }

  // SAFETY: `Navigator` exposes non-standard `deviceMemory` and `connection` fields on Chromium browsers.
  const nav = globalThis.navigator as Navigator & {
    deviceMemory?: unknown;
    connection?: { saveData?: unknown };
  };

  return {
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory:
      Number.isFinite(nav.deviceMemory) && Number(nav.deviceMemory) > 0
        ? Number(nav.deviceMemory)
        : undefined,
    saveData: Boolean(nav.connection?.saveData),
  };
}

/**
 * Resolves the active document performance tier strictly from explicit user settings
 * (`animationsEnabled` and `animationsFps`). Visual fidelity and animations stay at `"full"`
 * on all hardware unless the user explicitly enables reduced-motion or 30 FPS mode in Settings.
 */
export function resolveEffectivePerformanceTier(params: {
  animationsEnabled?: boolean;
  animationsFps: number;
  hardwareTier?: PerformanceTier;
  runtimeTier?: PerformanceTier;
}): PerformanceTier {
  if (params.animationsEnabled === false || params.animationsFps <= 30) {
    return "lite";
  }

  return "full";
}

/**
 * Sliding-window frame duration tracker with hysteresis to avoid rapid tier oscillation.
 */
export class FrameDropMonitor {
  private readonly slowFrameMs: number;
  private readonly outlierPauseMs: number;
  private readonly windowSize: number;
  private readonly downgradeSlowCount: number;
  private readonly recoveryStreakFrames: number;
  private readonly recoveryFrameMs: number;

  private tier: PerformanceTier = "full";
  private recentSlowFlags: boolean[] = [];
  private slowCountInWindow = 0;
  private smoothRecoveryStreak = 0;

  constructor(options: FrameDropMonitorOptions = {}) {
    this.slowFrameMs = options.slowFrameMs ?? DEFAULT_SLOW_FRAME_MS;
    this.outlierPauseMs = options.outlierPauseMs ?? DEFAULT_OUTLIER_PAUSE_MS;
    this.windowSize = Math.max(4, options.windowSize ?? DEFAULT_WINDOW_SIZE);
    this.downgradeSlowCount = Math.max(
      2,
      options.downgradeSlowCount ?? DEFAULT_DOWNGRADE_SLOW_COUNT,
    );
    this.recoveryStreakFrames = Math.max(
      10,
      options.recoveryStreakFrames ?? DEFAULT_RECOVERY_STREAK,
    );
    this.recoveryFrameMs = options.recoveryFrameMs ?? DEFAULT_RECOVERY_FRAME_MS;
  }

  getTier(): PerformanceTier {
    return this.tier;
  }

  reset(initialTier: PerformanceTier = "full"): void {
    this.tier = initialTier;
    this.recentSlowFlags = [];
    this.slowCountInWindow = 0;
    this.smoothRecoveryStreak = 0;
  }

  /**
   * Records one `requestAnimationFrame` delta in milliseconds and returns the current tier.
   * Outliers (e.g. background tab wakeups > 250ms or non-positive deltas) are ignored cleanly.
   */
  recordFrame(deltaMs: number): PerformanceTier {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs > this.outlierPauseMs) {
      return this.tier;
    }

    const isSlow = deltaMs > this.slowFrameMs;

    this.recentSlowFlags.push(isSlow);

    if (isSlow) {
      this.slowCountInWindow += 1;
    }

    if (this.recentSlowFlags.length > this.windowSize) {
      const dropped = this.recentSlowFlags.shift();

      if (dropped) {
        this.slowCountInWindow -= 1;
      }
    }

    if (this.tier === "full") {
      if (this.slowCountInWindow >= this.downgradeSlowCount) {
        this.tier = "lite";
        this.smoothRecoveryStreak = 0;
      }

      return this.tier;
    }

    if (deltaMs <= this.recoveryFrameMs) {
      this.smoothRecoveryStreak += 1;

      if (this.smoothRecoveryStreak >= this.recoveryStreakFrames) {
        this.tier = "full";
        this.recentSlowFlags = [];
        this.slowCountInWindow = 0;
        this.smoothRecoveryStreak = 0;
      }
    } else {
      this.smoothRecoveryStreak = 0;
    }

    return this.tier;
  }
}
