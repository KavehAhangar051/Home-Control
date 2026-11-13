"use client";

import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardStyles from "@/features/iot/components/DashboardStyles";
import ToastNotification from "@/features/iot/components/notifications/ToastNotification";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { usePageVisibility } from "@/features/iot/hooks/usePageVisibility";
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
  const darkBlackness = useIoTStore((s) => s.darkBlackness);
  const lightWhiteness = useIoTStore((s) => s.lightWhiteness);
  const selectedFont = useIoTStore((s) => s.selectedFont);

  return (
    <TooltipProvider>
      <CustomCursor />
      <MotionConfig reducedMotion={animationsEnabled ? "user" : "always"}>
        <div
          className={`style-nova theme-bg-main theme-text-secondary min-h-screen relative font-sans leading-relaxed selection:bg-[var(--accent3-transparent)] selection:text-[var(--accent3)] overflow-x-clip ${isDark ? "dark" : ""}`}
        >
          <div className="animate-fade-in">
            <DashboardStyles
              accent3={accent3}
              accent4={accent4}
              isDark={isDark}
              animationsEnabled={animationsEnabled}
              darkBlackness={darkBlackness}
              lightWhiteness={lightWhiteness}
              selectedFont={selectedFont}
            />

            <div className="relative z-10 flex flex-row items-stretch w-full h-screen overflow-hidden">
              <DashboardHeader />
              <div className="flex-1 min-w-0 flex flex-col justify-between w-full h-screen overflow-hidden mx-auto">
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
