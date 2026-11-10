"use client";

import React from "react";
import { motion } from "motion/react";
import { Play } from "@/components/ui/hugeicons";
import { ICON_MAP } from "@/features/iot/utils/icons";

interface MacroSidebarButtonProps {
  macro: any;
  isCenter?: boolean;
  onClick: () => void;
  isHorizontal: boolean;
  animationsEnabled: boolean;
  direction?: number;
  isSimpleList?: boolean;
  index?: number;
}

function MacroButtonIcon({
  icon,
  isHorizontal,
  activeScaleClass = "md:group-hover:scale-110",
  playExtraClass = "opacity-70 md:group-hover:scale-110",
}: {
  icon?: string;
  isHorizontal: boolean;
  activeScaleClass?: string;
  playExtraClass?: string;
}) {
  if (icon) {
    return (
      <span
        className={`${isHorizontal ? "text-xl" : "text-2xl mb-1"} ${activeScaleClass} transition-transform duration-150 ease-out`}
      >
        {ICON_MAP[icon]
          ? React.createElement(ICON_MAP[icon], {
              className: isHorizontal ? "w-5 h-5" : "w-6 h-6",
              strokeWidth: 2.5,
            })
          : icon}
      </span>
    );
  }
  return (
    <Play
      strokeWidth={2.5}
      className={`${isHorizontal ? "w-5 h-5" : "w-6 h-6 mb-1"} translate-x-px ${playExtraClass} transition-[transform,opacity] duration-150 ease-out`}
    />
  );
}

interface SimpleMacroButtonProps {
  macro: any;
  onClick: () => void;
  isHorizontal?: boolean;
  animationsEnabled: boolean;
  index?: number;
}

export function SimpleMacroButton({
  macro,
  onClick,
  isHorizontal = true,
  animationsEnabled,
  index = 0,
}: SimpleMacroButtonProps) {
  return (
    <motion.button
      initial={
        animationsEnabled
          ? isHorizontal
            ? { opacity: 0, y: -12, filter: "blur(4px)" }
            : { opacity: 0, x: -12, filter: "blur(4px)" }
          : undefined
      }
      animate={
        animationsEnabled
          ? isHorizontal
            ? { opacity: 1, y: 0, filter: "blur(0px)" }
            : { opacity: 1, x: 0, filter: "blur(0px)" }
          : undefined
      }
      exit={
        animationsEnabled
          ? {
              opacity: 0,
              y: -12,
              filter: "blur(4px)",
              transition: { duration: 0.15, ease: "easeOut" },
            }
          : undefined
      }
      transition={
        animationsEnabled ? { duration: 0.2, delay: index * 0.05, ease: "easeOut" } : undefined
      }
      onClick={onClick}
      whileTap={animationsEnabled ? { scale: 0.96 } : undefined}
      className={`flex items-center justify-center rounded-2xl bg-[var(--card-bg-solid)] border border-[var(--border-color)] text-[var(--text-primary)] md:hover:border-[var(--accent3)] md:hover:text-[var(--accent3)] md:hover:-translate-y-1 md:hover:shadow-[0_10px_20px_-5px_var(--accent3-transparent)] transition-[transform,border-color,color,box-shadow] duration-200 ease-out shadow-sm relative group ${isHorizontal ? "flex-row gap-2 ps-3.5 pe-4 w-[120px] min-w-min min-h-[48px] h-fit py-2" : "flex-col w-[72px] min-w-min px-2 min-h-[72px] h-fit py-2"}`}
      title={macro.title}
    >
      <MacroButtonIcon icon={macro.icon} isHorizontal={isHorizontal} />
      <span
        className={`${isHorizontal ? "text-xs" : "text-[10px] px-1 leading-tight"} font-bold text-center opacity-80 md:group-hover:opacity-100 transition-opacity duration-150 ease-out`}
      >
        {macro.title}
      </span>
    </motion.button>
  );
}

interface CarouselMacroButtonProps {
  macro: any;
  isCenter?: boolean;
  onClick: () => void;
  isHorizontal?: boolean;
  animationsEnabled: boolean;
  direction?: number;
}

export function CarouselMacroButton({
  macro,
  isCenter = false,
  onClick,
  isHorizontal = true,
  animationsEnabled,
  direction = 1,
}: CarouselMacroButtonProps) {
  return (
    <motion.button
      layout
      initial={
        animationsEnabled
          ? isHorizontal
            ? { opacity: 0, scale: 0.85, x: direction * 40 }
            : { opacity: 0, scale: 0.85, y: direction * 40 }
          : undefined
      }
      animate={
        animationsEnabled
          ? {
              opacity: isCenter ? 1 : 0.4,
              scale: isCenter ? 1 : 0.85,
              x: 0,
              y: 0,
            }
          : undefined
      }
      exit={
        animationsEnabled
          ? isHorizontal
            ? {
                opacity: 0,
                scale: 0.85,
                x: -direction * 40,
                transition: { duration: 0.15, ease: "easeOut" },
              }
            : {
                opacity: 0,
                scale: 0.85,
                y: -direction * 40,
                transition: { duration: 0.15, ease: "easeOut" },
              }
          : undefined
      }
      transition={animationsEnabled ? { duration: 0.25, ease: "easeOut" } : undefined}
      whileTap={animationsEnabled ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`flex items-center justify-center rounded-2xl bg-[var(--card-bg-solid)] border ${isCenter ? "border-[var(--accent3)] shadow-[0_4px_15px_-5px_var(--accent3-transparent)] z-10 text-[var(--accent3)]" : "border-[var(--border-color)] md:hover:border-[var(--accent3)] text-[var(--text-primary)]"} transition-[border-color,color,box-shadow] duration-200 ease-out relative group shrink-0 ${isHorizontal ? "flex-row gap-1 ps-1.5 pe-2 w-[100px] min-w-[90px] min-h-[44px] h-fit py-2" : "flex-col w-[72px] min-w-min px-2 min-h-[72px] h-fit py-2"}`}
      title={macro.title}
    >
      <MacroButtonIcon
        icon={macro.icon}
        isHorizontal={isHorizontal}
        activeScaleClass={isCenter ? "scale-110" : "md:group-hover:scale-110"}
        playExtraClass={isCenter ? "opacity-100 scale-110" : "opacity-70 md:group-hover:scale-110"}
      />
      <span
        className={`${isHorizontal ? "text-[10px]" : "text-[10px] px-1"} leading-tight font-bold text-center transition-opacity duration-150 ease-out ${isCenter ? "opacity-100" : "opacity-60 md:group-hover:opacity-100"}`}
      >
        {macro.title}
      </span>
    </motion.button>
  );
}

export default function MacroSidebarButton({
  macro,
  isCenter = false,
  onClick,
  isHorizontal,
  animationsEnabled,
  direction = 1,
  isSimpleList = false,
  index = 0,
}: MacroSidebarButtonProps) {
  if (isSimpleList) {
    return (
      <SimpleMacroButton
        macro={macro}
        onClick={onClick}
        isHorizontal={isHorizontal}
        animationsEnabled={animationsEnabled}
        index={index}
      />
    );
  }

  return (
    <CarouselMacroButton
      macro={macro}
      isCenter={isCenter}
      onClick={onClick}
      isHorizontal={isHorizontal}
      animationsEnabled={animationsEnabled}
      direction={direction}
    />
  );
}
