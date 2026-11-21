"use client";

import { useServiceWorkerRegistration } from "@/lib/hooks/use-pwa";
import { useGpuDisplayObserver } from "@/lib/hooks/use-gpu-display";
import { useScreenWakeLockObserver } from "@/lib/hooks/use-wake-lock";
import { usePerfObserver } from "@/lib/perfObserver";

/**
 * Non-critical browser-platform observers & SW registration loaded asynchronously
 * after First Paint so WebGL/WebGPU probing, Wake Lock, PerfObserver setup,
 * and Service Worker registration never block initial HTML hydration.
 */
export default function DeferredPlatformRuntime() {
  useServiceWorkerRegistration();
  useScreenWakeLockObserver();
  useGpuDisplayObserver();
  usePerfObserver();

  return null;
}
