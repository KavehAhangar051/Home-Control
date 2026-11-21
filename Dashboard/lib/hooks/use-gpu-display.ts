"use client";

/**
 * @file lib/hooks/use-gpu-display.ts
 * @description Synchronizes native display resolution, DPR, GPU backend, and measured native
 * refresh rate (60Hz–360Hz) onto `document.documentElement` with zero idle polling.
 */

import { useEffect } from "react";
import {
  type GpuDisplayProfile,
  probeNativeRefreshRate,
  readDisplayProfile,
} from "@/lib/gpuDisplay";

function applyDisplayProfileToRoot(profile: GpuDisplayProfile): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const dprStr = String(profile.dpr);
  const fpsStr = String(profile.refreshRateHz);
  const resStr = `${profile.physicalWidth}x${profile.physicalHeight}`;

  const webGpuStr = profile.hasWebGpu ? "true" : "false";

  if (root.dataset.displayDpr !== dprStr) root.dataset.displayDpr = dprStr;
  if (root.dataset.displayFps !== fpsStr) root.dataset.displayFps = fpsStr;
  if (root.dataset.displayRes !== resStr) root.dataset.displayRes = resStr;
  if (root.dataset.gpuBackend !== profile.backend) root.dataset.gpuBackend = profile.backend;
  if (root.dataset.colorGamut !== profile.colorGamut) root.dataset.colorGamut = profile.colorGamut;
  if (root.dataset.dynamicRange !== profile.dynamicRange) {
    root.dataset.dynamicRange = profile.dynamicRange;
  }
  if (root.dataset.webgpu !== webGpuStr) root.dataset.webgpu = webGpuStr;

  root.style.setProperty("--display-dpr", dprStr);
  root.style.setProperty("--display-fps", fpsStr);
}

/**
 * Observes native display resolution, DPR switches (e.g. dragging window between 1080p & 4K monitors),
 * and probes native refresh rate once per display change so every dashboard layer renders at
 * full native resolution and native FPS.
 */
export function useGpuDisplayObserver(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let currentHz = 60;
    let cancelProbe: (() => void) | null = null;
    let dprMediaQuery: MediaQueryList | null = null;

    const syncProfile = () => {
      applyDisplayProfileToRoot(readDisplayProfile(currentHz));
    };

    const runRefreshProbe = () => {
      if (document.hidden) return;
      cancelProbe?.();
      cancelProbe = probeNativeRefreshRate((measuredHz) => {
        currentHz = measuredHz;
        syncProfile();
      });
    };

    const bindDprListener = () => {
      if (dprMediaQuery) {
        dprMediaQuery.removeEventListener("change", handleDprChange);
      }

      const dpr = window.devicePixelRatio || 1;
      dprMediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
      dprMediaQuery.addEventListener("change", handleDprChange);
    };

    const handleDprChange = () => {
      syncProfile();
      runRefreshProbe();
      bindDprListener();
    };

    const handleResize = () => {
      syncProfile();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncProfile();
      }
    };

    syncProfile();
    runRefreshProbe();
    bindDprListener();

    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelProbe?.();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      dprMediaQuery?.removeEventListener("change", handleDprChange);
    };
  }, []);
}
