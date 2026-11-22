"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useGpuDisplayObserver } from "@/lib/hooks/use-gpu-display";
import { useServiceWorkerRegistration } from "@/lib/hooks/use-pwa";
import { useScreenWakeLockObserver } from "@/lib/hooks/use-wake-lock";
import { usePerfObserver } from "@/lib/perfObserver";
import {
  hasDashboardConsent,
  notifyWhenBackgrounded,
  subscribePermissionsModal,
} from "@/lib/permissions";

const PermissionsOnboardingModal = dynamic(() => import("../modals/PermissionsOnboardingModal"), {
  ssr: false,
});

/**
 * Non-critical browser-platform observers, SW registration, and first-run permission onboarding
 * loaded asynchronously after First Paint so WebGL/WebGPU probing, Wake Lock, PerfObserver setup,
 * and Service Worker registration never block initial HTML hydration.
 */
export default function DeferredPlatformRuntime() {
  useServiceWorkerRegistration();
  useScreenWakeLockObserver();
  useGpuDisplayObserver();
  usePerfObserver();

  const [shouldLoadPermissionsModal, setShouldLoadPermissionsModal] = useState(
    () => !hasDashboardConsent(),
  );

  useEffect(() => {
    return subscribePermissionsModal((open) => {
      if (open) {
        setShouldLoadPermissionsModal(true);
      }
    });
  }, []);

  useEffect(() => {
    let seenOnlineAtLeastOnce = useIoTStore.getState().isLocal;

    return useIoTStore.subscribe(
      (state) => state.isLocal,
      (isLocal, prevIsLocal) => {
        if (isLocal) {
          if (seenOnlineAtLeastOnce && !prevIsLocal) {
            notifyWhenBackgrounded(
              "اتصال دستگاه برقرار شد",
              "ارتباط داشبورد با کنترلر ESP32 دوباره آنلاین شد.",
            );
          }
          seenOnlineAtLeastOnce = true;
        } else if (seenOnlineAtLeastOnce && prevIsLocal) {
          notifyWhenBackgrounded(
            "قطع ارتباط با ESP32",
            "وضعیت دستگاه آفلاین شد. اتصال شبکه یا بروکر MQTT را بررسی کنید.",
          );
        }
      },
    );
  }, []);

  return shouldLoadPermissionsModal ? <PermissionsOnboardingModal /> : null;
}
