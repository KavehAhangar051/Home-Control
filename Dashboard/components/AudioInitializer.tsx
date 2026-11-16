"use client";

import { useEffect } from "react";

function preloadAudio(): void {
  void import("@/lib/audio");
}

export default function AudioInitializer() {
  useEffect(() => {
    let cancelled = false;

    const loadAudio = () => {
      if (!cancelled) {
        preloadAudio();
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(loadAudio, { timeout: 1500 });

      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timer = globalThis.setTimeout(loadAudio, 250);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  return null;
}
