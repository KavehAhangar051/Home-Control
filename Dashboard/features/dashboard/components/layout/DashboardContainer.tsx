"use client";

import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardStyles from "@/features/iot/components/DashboardStyles";
import ToastNotification from "@/features/iot/components/notifications/ToastNotification";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { usePageVisibility } from "@/features/iot/hooks/usePageVisibility";
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

export default function DashboardContainer() {
  usePageVisibility();

  const accent3 = useIoTStore((s) => s.accent3);
  const accent4 = useIoTStore((s) => s.accent4);
  const isDark = useIoTStore((s) => s.isDark);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const animationsFps = useIoTStore((s) => s.animationsFps);
  const isPageVisible = useIoTStore((s) => s.isPageVisible);
  const darkBlackness = useIoTStore((s) => s.darkBlackness);
  const lightWhiteness = useIoTStore((s) => s.lightWhiteness);
  const selectedFont = useIoTStore((s) => s.selectedFont);

  usePerformanceTierObserver({
    animationsEnabled,
    animationsFps,
    isPageVisible,
  });

  return (
    <TooltipProvider>
      <CustomCursor />
      <MotionConfig reducedMotion={animationsEnabled ? "user" : "always"}>
        <div
          className={`style-nova bg-bg-main text-text-secondary min-h-dvh relative font-sans leading-relaxed selection:bg-accent3/15 selection:text-accent3 overflow-x-clip ${isDark ? "dark" : ""}`}
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
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:right-3 focus:z-[250] focus:rounded-xl focus:border focus:border-accent3 focus:bg-card-bg-solid focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-text-primary focus:shadow-lg focus:outline-none"
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
            <ToastNotification />
            <ScrollToTopButton />
          </div>
        </div>
      </MotionConfig>
    </TooltipProvider>
  );
}
