"use client";

import { useEffect } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { debugLog } from "@/lib/debug";

/**
 * SSR-safe capability check for the W3C Screen Wake Lock API.
 */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/**
 * Keeps the screen awake via `navigator.wakeLock.request("screen")` whenever
 * `wakeLockEnabled` is active and the document is visible.
 * Automatically re-acquires the sentinel after tab switches / lock-screen wakeups
 * and releases cleanly when disabled or unmounted.
 */
export function useScreenWakeLockObserver(): void {
  const wakeLockEnabled = usePreferencesStore((s) => s.wakeLockEnabled);
  const isPageVisible = useIoTStore((s) => s.isPageVisible);

  useEffect(() => {
    if (!wakeLockEnabled || !isPageVisible || !isWakeLockSupported()) {
      return;
    }

    let disposed = false;
    let sentinel: WakeLockSentinel | null = null;

    const releaseSentinel = () => {
      const current = sentinel;
      sentinel = null;

      if (current && !current.released) {
        current.release().catch(() => {
          // Ignore already-released sentinel errors
        });
      }
    };

    const acquireWakeLock = async () => {
      if (disposed || document.visibilityState !== "visible") return;

      if (sentinel && !sentinel.released) return;

      try {
        const nextSentinel = await navigator.wakeLock.request("screen");

        if (disposed) {
          nextSentinel.release().catch(() => {});

          return;
        }

        sentinel = nextSentinel;
        nextSentinel.addEventListener(
          "release",
          () => {
            if (sentinel === nextSentinel) {
              sentinel = null;
            }
          },
          { once: true },
        );
      } catch (error) {
        debugLog.warn("WakeLock", "Could not acquire screen wake lock.", error);
      }
    };

    const handleReacquire = () => {
      if (document.visibilityState === "visible") {
        void acquireWakeLock();
      }
    };

    void acquireWakeLock();
    document.addEventListener("visibilitychange", handleReacquire);
    window.addEventListener("pageshow", handleReacquire);
    window.addEventListener("focus", handleReacquire);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleReacquire);
      window.removeEventListener("pageshow", handleReacquire);
      window.removeEventListener("focus", handleReacquire);
      releaseSentinel();
    };
  }, [wakeLockEnabled, isPageVisible]);
}
