"use client";

import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardStyles from "@/features/iot/components/DashboardStyles";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { usePageVisibility } from "@/features/iot/hooks/usePageVisibility";
import { scheduleIdleTask } from "@/lib/asyncScheduler";
import { useCrossTabSync } from "@/lib/hooks/use-cross-tab-sync";
import { usePerformanceTierObserver } from "@/lib/hooks/use-performance-tier";
import DashboardDrawers from "./DashboardDrawers";
import DashboardHeader from "./DashboardHeader";
import DashboardMain from "./DashboardMain";

const CustomCursor = dynamic(
  () => import("@/components/custom-cursor").then((mod) => mod.CustomCursor),
  { ssr: false },
);

const ScrollToTopButton = dynamic(() => import("../widgets/ScrollToTopButton"), {
  ssr: false,
});

const DeferredPlatformRuntime = dynamic(() => import("./DeferredPlatformRuntime"), {
  ssr: false,
});

const ToastNotification = dynamic(
  () => import("@/features/iot/components/notifications/ToastNotification"),
  { ssr: false },
);

export default function DashboardContainer() {
  usePageVisibility();
  useCrossTabSync();

  const [isPostPaintReady, setIsPostPaintReady] = useState(false);
  const [hasFinePointer, setHasFinePointer] = useState(false);
  const [hasToastActivated, setHasToastActivated] = useState(false);

  const accent3 = useIoTStore((s) => s.accent3);
  const accent4 = useIoTStore((s) => s.accent4);
  const isDark = useIoTStore((s) => s.isDark);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const animationsFps = useIoTStore((s) => s.animationsFps);
  const isPageVisible = useIoTStore((s) => s.isPageVisible);
  const darkBlackness = useIoTStore((s) => s.darkBlackness);
  const lightWhiteness = useIoTStore((s) => s.lightWhiteness);
  const selectedFont = useIoTStore((s) => s.selectedFont);
  const hasActiveToast = useIoTStore((s) => s.toast !== null);

  usePerformanceTierObserver({
    animationsEnabled,
    animationsFps,
    isPageVisible,
  });

  useEffect(() => {
    if (hasActiveToast) {
      setHasToastActivated(true);
    }
  }, [hasActiveToast]);

  useEffect(() => {
    let cancelIdle: (() => void) | null = null;
    const rafId = window.requestAnimationFrame(() => {
      cancelIdle = scheduleIdleTask(() => {
        setHasFinePointer(window.matchMedia("(pointer: fine)").matches);
        setIsPostPaintReady(true);
      }, 300);
    });

    const unlockOnFirstGesture = () => {
      void import("@/lib/audio/context").then(({ audioContextManager }) => {
        audioContextManager.unlock();
      });
      window.removeEventListener("pointerdown", unlockOnFirstGesture);
      window.removeEventListener("keydown", unlockOnFirstGesture);
    };

    window.addEventListener("pointerdown", unlockOnFirstGesture, { once: true, passive: true });
    window.addEventListener("keydown", unlockOnFirstGesture, { once: true, passive: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      cancelIdle?.();
      window.removeEventListener("pointerdown", unlockOnFirstGesture);
      window.removeEventListener("keydown", unlockOnFirstGesture);
    };
  }, []);

  return (
    <TooltipProvider>
      {isPostPaintReady && hasFinePointer && <CustomCursor />}
      <MotionConfig reducedMotion={animationsEnabled ? "user" : "always"}>
        <div
          className="style-nova bg-bg-main text-text-secondary min-h-dvh relative font-sans leading-relaxed selection:bg-accent3-medium selection:text-text-primary overflow-x-clip"
        >
          <div>
            <DashboardStyles
              accent3={accent3}
              accent4={accent4}
              isDark={isDark}
              animationsEnabled={animationsEnabled}
              darkBlackness={darkBlackness}
              lightWhiteness={lightWhiteness}
              selectedFont={selectedFont}
            />

            <a
              href="#dashboard-workspace-scroll"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[250] focus:rounded-xl focus:border focus:border-accent3 focus:bg-card-bg-solid focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-text-primary focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
            >
              پرش به محتوای اصلی
            </a>

            <div className="relative z-10 flex flex-row items-stretch w-full h-dvh overflow-hidden">
              <DashboardHeader />
              <div className="flex-1 min-w-0 flex flex-col justify-between w-full h-dvh overflow-hidden mx-auto">
                <DashboardMain />
              </div>
            </div>

            <DashboardDrawers />
            {(isPostPaintReady || hasToastActivated || hasActiveToast) && <ToastNotification />}
            {isPostPaintReady && <ScrollToTopButton />}
            {isPostPaintReady && <DeferredPlatformRuntime />}
          </div>
        </div>
      </MotionConfig>
    </TooltipProvider>
  );
}
