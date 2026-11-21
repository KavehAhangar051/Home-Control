"use client";

import { useEffect } from "react";
import { debugLog } from "@/lib/debug";

export interface DashboardPerfSnapshot {
  /** Largest Contentful Paint (ms) if reported by the browser. */
  lcpMs: number | null;
  /** Cumulative Layout Shift score (excluding input-driven shifts). */
  cls: number;
  /** Worst observed event interaction latency (INP approximation, ms). */
  inpWorstMs: number | null;
  /** Total count of observed interaction events with duration > 0. */
  interactionCount: number;
  /** Count of Long Animation Frames (> 50ms) reported by the browser. */
  loafCount: number;
  /** Worst Long Animation Frame duration (ms). */
  loafWorstMs: number | null;
  /** Total Long Animation Frame blocking duration (ms). */
  loafTotalBlockingMs: number;
  /** Supported PerformanceObserver entry types active in this session. */
  supportedTypes: string[];
  /** Timestamp (ms since epoch) of the most recent metric update. */
  updatedAt: number;
}

export interface DashboardPerfHandle {
  getReport: () => DashboardPerfSnapshot;
  reset: () => void;
}

declare global {
  interface Window {
    __dashboardPerf?: DashboardPerfHandle;
  }
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface LongAnimationFrameEntry extends PerformanceEntry {
  blockingDuration?: number;
}

interface EventTimingEntry extends PerformanceEntry {
  interactionId?: number;
}

function createInitialSnapshot(supportedTypes: string[]): DashboardPerfSnapshot {
  return {
    lcpMs: null,
    cls: 0,
    inpWorstMs: null,
    interactionCount: 0,
    loafCount: 0,
    loafWorstMs: null,
    loafTotalBlockingMs: 0,
    supportedTypes,
    updatedAt: Date.now(),
  };
}

/**
 * Headless runtime PerformanceObserver (LoAF, INP/Event Timing, LCP, CLS).
 * Zero DOM/UI overhead — exposes live metrics on `window.__dashboardPerf.getReport()`
 * and logs severe Long Animation Frames (> 120ms) strictly via `debugLog` in dev mode.
 */
export function usePerfObserver(): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

    const supported = Array.isArray(PerformanceObserver.supportedEntryTypes)
      ? PerformanceObserver.supportedEntryTypes
      : [];

    const activeTypes: string[] = [];
    const observers: PerformanceObserver[] = [];
    let snapshot = createInitialSnapshot(activeTypes);

    const observeType = (
      type: string,
      options: PerformanceObserverInit,
      onEntries: (entries: readonly PerformanceEntry[]) => void,
    ) => {
      if (!supported.includes(type)) return;

      try {
        const observer = new PerformanceObserver((list) => {
          onEntries(list.getEntries());
        });
        observer.observe(options);
        observers.push(observer);
        activeTypes.push(type);
      } catch {
        // Ignore unsupported observer option combinations in older engines
      }
    };

    observeType(
      "largest-contentful-paint",
      { type: "largest-contentful-paint", buffered: true },
      (entries) => {
        const last = entries[entries.length - 1];

        if (!last) return;

        snapshot.lcpMs = Math.round(last.startTime * 10) / 10;
        snapshot.updatedAt = Date.now();
      },
    );

    observeType("layout-shift", { type: "layout-shift", buffered: true }, (entries) => {
      for (const entry of entries) {
        const shift = entry as LayoutShiftEntry;

        if (!shift.hadRecentInput && typeof shift.value === "number") {
          snapshot.cls = Math.round((snapshot.cls + shift.value) * 10000) / 10000;
          snapshot.updatedAt = Date.now();
        }
      }
    });

    observeType(
      "event",
      { type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit,
      (entries) => {
        for (const entry of entries) {
          const eventEntry = entry as EventTimingEntry;

          if (!eventEntry.interactionId) continue;

          const duration = Math.round(entry.duration * 10) / 10;
          snapshot.interactionCount += 1;

          if (snapshot.inpWorstMs === null || duration > snapshot.inpWorstMs) {
            snapshot.inpWorstMs = duration;
          }

          snapshot.updatedAt = Date.now();
        }
      },
    );

    observeType(
      "long-animation-frame",
      { type: "long-animation-frame", buffered: true },
      (entries) => {
        for (const entry of entries) {
          const loaf = entry as LongAnimationFrameEntry;
          const duration = Math.round(loaf.duration * 10) / 10;
          const blocking =
            Math.round((loaf.blockingDuration ?? Math.max(0, duration - 50)) * 10) / 10;

          snapshot.loafCount += 1;
          snapshot.loafTotalBlockingMs =
            Math.round((snapshot.loafTotalBlockingMs + blocking) * 10) / 10;

          if (snapshot.loafWorstMs === null || duration > snapshot.loafWorstMs) {
            snapshot.loafWorstMs = duration;
          }

          snapshot.updatedAt = Date.now();

          if (duration >= 120) {
            debugLog.warn(
              "Perf",
              `Long Animation Frame detected (${duration}ms, blocking ${blocking}ms).`,
            );
          }
        }
      },
    );

    snapshot.supportedTypes = [...activeTypes];

    window.__dashboardPerf = {
      getReport: () => ({ ...snapshot, supportedTypes: [...snapshot.supportedTypes] }),
      reset: () => {
        snapshot = createInitialSnapshot([...activeTypes]);
      },
    };

    return () => {
      for (const observer of observers) {
        try {
          observer.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }

      delete window.__dashboardPerf;
    };
  }, []);
}
