"use client";

import { motion, AnimatePresence } from "motion/react";
import { Activity, ChevronLeft } from "@/components/ui/hugeicons";
import { ACCORDION_CLIP } from "@/lib/presets";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { StabilitySectionProps } from "./types";
import AnimationsToggle from "./AnimationsToggle";
import LowDataToggle from "./LowDataToggle";
import CloudflareIntegration from "./CloudflareIntegration";

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
      <CloudflareIntegration isDark={isDark} />
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
    <div className="theme-card-bg-solid border border-accent3-medium/30 p-4 space-y-4 overflow-hidden rounded-xl text-right">
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
      className="border border-accent3-medium overflow-hidden transition-all duration-300"
      style={{ clipPath: ACCORDION_CLIP }}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => toggleSection?.("animations")}
        className="w-full py-3 px-4 bg-[var(--card-bg-solid)] flex items-center justify-between text-right cursor-pointer"
      >
        <ChevronLeft
          aria-hidden="true"
          className="w-4 h-4 text-accent3 transition-transform duration-300"
          style={{ transform: isExpanded ? "rotate(-90deg)" : "rotate(0deg)" }}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold theme-text-primary">کنترل پایداری و بهینه‌سازی</span>
          <Activity
            aria-hidden="true"
            className="w-4 h-4 text-accent4"
            style={{ color: "var(--accent4)" }}
          />
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="theme-card-bg-solid border-t border-accent3-medium/30 p-4 space-y-4 overflow-hidden"
          >
            <StabilitySectionContent
              animationsEnabled={animationsEnabled}
              setAnimationsEnabled={setAnimationsEnabled}
              animationsFps={animationsFps}
              setAnimationsFps={setAnimationsFps}
              isDark={isDark}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
