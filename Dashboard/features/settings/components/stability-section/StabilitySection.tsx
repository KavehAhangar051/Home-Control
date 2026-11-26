"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Activity } from "@/components/ui/hugeicons-groups/media";
import { ChevronLeft } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { EASE_OUT } from "@/lib/ease";
import { ACCORDION_CLIP } from "@/lib/presets";
import AnimationsToggle from "./AnimationsToggle";
import BackupRestoreSection from "./BackupRestoreSection";
import CloudflareIntegration from "./CloudflareIntegration";
import HapticsToggle from "./HapticsToggle";
import LowDataToggle from "./LowDataToggle";
import PermissionsStatusCard from "./PermissionsStatusCard";
import PwaInstallCard from "./PwaInstallCard";
import type { StabilitySectionProps } from "./types";
import WakeLockToggle from "./WakeLockToggle";

export function StabilitySectionContent({
  animationsEnabled,
  setAnimationsEnabled,
  animationsFps,
  setAnimationsFps,
  isDark = true,
}: Pick<
  StabilitySectionProps,
  "animationsEnabled" | "setAnimationsEnabled" | "animationsFps" | "setAnimationsFps" | "isDark"
>) {
  const lowDataMode = useIoTStore((s) => s.lowDataMode);
  const setLowDataMode = useIoTStore((s) => s.setLowDataMode);

  return (
    <div className="space-y-4 text-right">
      <AnimationsToggle
        animationsEnabled={animationsEnabled}
        setAnimationsEnabled={setAnimationsEnabled}
        animationsFps={animationsFps}
        setAnimationsFps={setAnimationsFps}
        isDark={isDark}
      />
      <LowDataToggle
        lowDataMode={lowDataMode}
        setLowDataMode={setLowDataMode}
        animationsEnabled={animationsEnabled}
        isDark={isDark}
      />
      <HapticsToggle animationsEnabled={animationsEnabled} />
      <WakeLockToggle animationsEnabled={animationsEnabled} />
      <PermissionsStatusCard />
      <PwaInstallCard />
      <BackupRestoreSection />
      <CloudflareIntegration isDark={isDark} animationsEnabled={animationsEnabled} />
    </div>
  );
}

export function InlineStabilitySection(
  props: Pick<
    StabilitySectionProps,
    "animationsEnabled" | "setAnimationsEnabled" | "animationsFps" | "setAnimationsFps" | "isDark"
  >,
) {
  return (
    <div className="min-w-0 space-y-4 text-right">
      <StabilitySectionContent {...props} />
    </div>
  );
}

export default function StabilitySection({
  animationsEnabled,
  setAnimationsEnabled,
  animationsFps,
  setAnimationsFps,
  expandedSection,
  toggleSection,
  hideHeader = false,
  isDark = true,
}: StabilitySectionProps) {
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);

  if (hideHeader) {
    return (
      <InlineStabilitySection
        animationsEnabled={animationsEnabled}
        setAnimationsEnabled={setAnimationsEnabled}
        animationsFps={animationsFps}
        setAnimationsFps={setAnimationsFps}
        isDark={isDark}
      />
    );
  }

  const isExpanded = expandedSection === "animations";

  return (
    <div
      className="border border-accent3-medium overflow-hidden transition-colors duration-300"
      style={{ clipPath: ACCORDION_CLIP }}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => toggleSection?.("animations")}
        className="w-full py-3 px-4 bg-card-bg-solid flex items-center justify-between text-right cursor-pointer"
      >
        <ChevronLeft
          aria-hidden="true"
          className="size-4 text-accent3 transition-transform duration-300"
          style={{ transform: isExpanded ? "rotate(-90deg)" : "rotate(0deg)" }}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-primary">کنترل پایداری و بهینه‌سازی</span>
          <Activity
            aria-hidden="true"
            className="size-4 text-accent4"
            style={{ color: "var(--accent4)" }}
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <m.div
            key="stability-accordion-content"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={
              reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    height: { duration: 0.24, ease: EASE_OUT },
                    opacity: { duration: 0.18, ease: EASE_OUT },
                  }
            }
            className="bg-card-bg-solid border-t border-accent3-medium/30 overflow-hidden"
            style={{ contain: "layout style", backfaceVisibility: "hidden" }}
          >
            <div className="p-4 space-y-4">
              <StabilitySectionContent
                animationsEnabled={animationsEnabled}
                setAnimationsEnabled={setAnimationsEnabled}
                animationsFps={animationsFps}
                setAnimationsFps={setAnimationsFps}
                isDark={isDark}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
