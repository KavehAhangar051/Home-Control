import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { m } from "motion/react";
import React from "react";
import { Card } from "@/components/ui/card";
import { SPRING_LAYOUT, TRANSITION_EXIT_STANDARD } from "@/lib/ease";
import type { SortableSegmentCardProps } from "../core/types";
import { useAutoOffTimer } from "../hooks/useAutoOffTimer";
import useSegmentButtonProps from "../hooks/useSegmentButtonProps";
import CardBody from "./CardBody";
import CardHeader from "./CardHeader";

interface ActiveCardProps
  extends Omit<SortableSegmentCardProps, "onSetupPlaceholder" | "isLoadingIoT"> {
  isCompact: boolean;
  isUltraCompact: boolean;
  isMobileTwoCol?: boolean;
  densityFactor?: number;
  attributes: DraggableAttributes | Record<string, string | number | boolean | undefined>;
  listeners: DraggableSyntheticListeners;
}

const CARD_MOTION_TRANSITION = SPRING_LAYOUT;
const CARD_MOTION_INITIAL = { opacity: 0, y: 12, scale: 0.97 } as const;
const CARD_MOTION_ANIMATE = { opacity: 1, y: 0, scale: 1 } as const;

const CARD_MOTION_EXIT = {
  opacity: 0,
  y: -10,
  scale: 0.97,
  transition: TRANSITION_EXIT_STANDARD,
} as const;

// SAFETY: React CSSProperties supports string-prefixed custom properties
const CARD_SPACING_STYLE: React.CSSProperties = { "--card-spacing": "0px" } as React.CSSProperties;

function ActiveCard({
  segment,
  isPinOn = false,
  onRemove,
  onTogglePin,
  onSetPinState,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  groupMaxCols,
  animationsEnabled = true,
  isCompact,
  isUltraCompact,
  isMobileTwoCol,
  densityFactor,
  attributes,
  listeners,
}: ActiveCardProps) {
  const mode = segment.mode || "switch";

  const buttonProps = useSegmentButtonProps({
    mode,
    pin: segment.pin,
    onTogglePin,
    onSetPinState,
  });

  const { countdown } = useAutoOffTimer({
    isPinOn,
    autoOff: segment.auto_off,
    mode,
    pin: segment.pin,
    onSetPinState,
  });

  const isInput = segment.type === "input";

  const activeSurfaceClass = isPinOn
    ? isInput
      ? "border-emerald-500 bg-[var(--card-bg)] shadow-xs"
      : "border-[var(--accent3)] bg-[var(--card-bg)] shadow-xs"
    : "border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xs";

  return (
    <m.div
      layout={animationsEnabled ? "position" : false}
      transition={animationsEnabled ? CARD_MOTION_TRANSITION : undefined}
      initial={animationsEnabled ? CARD_MOTION_INITIAL : false}
      animate={animationsEnabled ? CARD_MOTION_ANIMATE : false}
      exit={animationsEnabled ? CARD_MOTION_EXIT : undefined}
      className="relative h-full"
    >
      <Card
        className={`group relative flex h-full flex-col justify-between !overflow-visible !gap-0 !rounded-xl !p-0 !ring-0 border transition-[border-color,background-color,box-shadow] duration-200 ${activeSurfaceClass}`}
        style={CARD_SPACING_STYLE}
      >
        <CardHeader
          segment={segment}
          isPinOn={isPinOn}
          isUltraCompact={isUltraCompact}
          isCompact={isCompact}
          mode={mode}
          onRemove={onRemove}
          onUpdateSegmentMode={onUpdateSegmentMode}
          attributes={attributes}
          listeners={listeners}
          countdown={countdown}
          onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
          groupMaxCols={groupMaxCols}
        />

        <CardBody
          segment={segment}
          isPinOn={isPinOn}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          isMobileTwoCol={isMobileTwoCol}
          densityFactor={densityFactor}
          mode={mode}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
          countdown={countdown}
        />
      </Card>
    </m.div>
  );
}

export default React.memo(ActiveCard, (prev, next) => {
  return (
    prev.segment === next.segment &&
    prev.isPinOn === next.isPinOn &&
    prev.isCompact === next.isCompact &&
    prev.isUltraCompact === next.isUltraCompact &&
    prev.isMobileTwoCol === next.isMobileTwoCol &&
    prev.densityFactor === next.densityFactor &&
    prev.parentGroupsCols === next.parentGroupsCols &&
    prev.groupMaxCols === next.groupMaxCols &&
    prev.animationsEnabled === next.animationsEnabled
  );
});
