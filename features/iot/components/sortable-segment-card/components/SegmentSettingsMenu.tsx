import { AnimatePresence, m, useReducedMotion } from "motion/react";
import React from "react";
import { createPortal } from "react-dom";
import { DeleteButton } from "@/components/ui/delete-button";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  adcValueToPercent,
  adcValueToVoltage,
  clampAdcResolution,
  clampAdcValue,
  getAdcMaxValue,
  isAnalogInputSegment,
  isReadOnlyInputSegment,
} from "@/features/iot/utils/analogInput";
import {
  analogDutyToPercent,
  clampAnalogValue,
  clampPwmFrequency,
  clampPwmResolution,
  getAnalogMaxDuty,
  isAnalogOutputSegment,
} from "@/features/iot/utils/analogOutput";
import { getSegmentIcon, hasIcon } from "@/features/iot/utils/icons";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import type { SegmentData } from "../core/types";
import type { SegmentMenuPosition } from "../hooks/useCardHeaderLayout";
import AnalogInputConfigEditor from "./AnalogInputConfigEditor";
import SegmentControls from "./SegmentControls";

interface SegmentSettingsMenuProps {
  segment: SegmentData;
  isSettingsOpen: boolean;
  onCloseMenu: () => void;
  menuPosition: SegmentMenuPosition | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  showIconInMenu: boolean;
  isPinOn: boolean;
  isUltraCompact: boolean;
  onRemove: (id: string) => void;
  onUpdateSegmentMode?: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, autoOff: number) => void;
  mode: "switch" | "push";
  countdown?: number | null;
  autoOffMenuProps: {
    showAutoOffMenu: boolean;
    setShowAutoOffMenu: (val: boolean) => void;
    autoOffButtonRef: React.RefObject<HTMLButtonElement | null>;
    autoOffMenuRef: React.RefObject<HTMLDivElement | null>;
  };
}

/**
 * Popover settings panel for an individual Smart Home device segment.
 * Portaled to document.body so it always stacks above all segment cards,
 * group containers, and Trellis panels without clipping.
 */
export default function SegmentSettingsMenu({
  segment,
  isSettingsOpen,
  onCloseMenu,
  menuPosition,
  menuRef,
  isPinOn,
  onRemove,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  mode,
  countdown,
  autoOffMenuProps,
}: SegmentSettingsMenuProps) {
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const liveAnalogValue = useIoTStore((s) => s.pinsAnalogValue[segment.pin]);
  const livePwmResolution = useIoTStore((s) => s.pinsPwmResolution[segment.pin]);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);
  const isAnalogOutput = isAnalogOutputSegment(segment);
  const isAnalogInput = isAnalogInputSegment(segment);
  const isReadOnlyInput = isReadOnlyInputSegment(segment);

  const pwmRes = clampPwmResolution(livePwmResolution ?? segment.pwmResolution);
  const pwmFreq = clampPwmFrequency(segment.pwmFrequency);
  const maxDuty = getAnalogMaxDuty(pwmRes);
  const currentDuty =
    liveAnalogValue !== undefined
      ? clampAnalogValue(liveAnalogValue, pwmRes)
      : isPinOn
        ? clampAnalogValue(segment.analogValue ?? maxDuty, pwmRes)
        : 0;
  const currentPercent = analogDutyToPercent(currentDuty, pwmRes);

  const adcRes = clampAdcResolution(livePwmResolution ?? segment.adcResolution);
  const adcMax = getAdcMaxValue(adcRes);
  const adcRaw = clampAdcValue(liveAnalogValue ?? segment.analogValue ?? 0, adcRes);
  const adcPercent = adcValueToPercent(adcRaw, adcRes);
  const adcVoltage = adcValueToVoltage(adcRaw, adcRes);

  if (typeof document === "undefined") return null;

  const isPositioned = menuPosition !== null;
  const initialOffsetY = menuPosition?.placement === "top" ? 4 : -4;

  const menuNode = (
    <m.div
      key="segment-settings-menu"
      ref={menuRef}
      dir="rtl"
      className={`fixed z-[180] ${menuPosition?.placement === "top" ? "origin-bottom-left" : "origin-top-left"}`}
      style={{
        top: menuPosition ? `${menuPosition.top}px` : "-9999px",
        left: menuPosition ? `${menuPosition.left}px` : "-9999px",
        visibility: isPositioned ? "visible" : "hidden",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: initialOffsetY }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, scale: 0.96, y: initialOffsetY, transition: TRANSITION_EXIT_QUICK }
      }
      transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_QUICK}
    >
      <div
        className={`relative ${
          isAnalogInput ? "w-[280px] sm:w-[304px]" : "w-[256px] sm:w-[280px]"
        } bg-card-bg-solid backdrop-blur-xl border border-border-color rounded-2xl shadow-xl p-3.5 flex flex-col gap-3 cursor-default text-right`}
      >
        {/* Segment Identity & Pin Metadata */}
        <div className="flex items-center justify-between gap-2 border-b border-border-color pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                isPinOn ? "bg-accent3-transparent text-accent3" : "bg-muted text-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {segment.icon && !hasIcon(segment.icon) ? (
                <span className="text-xs leading-none flex items-center justify-center size-4">
                  {segment.icon}
                </span>
              ) : (
                React.createElement(getSegmentIcon(segment.icon), { className: "size-4" })
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block font-sans font-bold text-text-primary text-xs truncate">
                {segment.title}
              </span>
              <span className="block text-[10px] tabular-nums text-text-muted">
                پایه {segment.pin} ·{" "}
                {isAnalogOutput
                  ? `${currentPercent}% (${currentDuty}/${maxDuty})`
                  : isAnalogInput
                    ? `${adcPercent}% · ~${adcVoltage}V (${adcRaw}/${adcMax})`
                    : isPinOn
                      ? "روشن"
                      : "خاموش"}
              </span>
            </div>
          </div>
        </div>

        {/* PWM Hardware Metadata for analog_output */}
        {isAnalogOutput && (
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border-color bg-secondary px-2.5 py-2 text-[11px] tabular-nums">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">رزولوشن PWM</span>
              <span className="font-mono font-semibold text-text-primary" dir="ltr">
                {pwmRes}-bit (0..{maxDuty})
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">فرکانس LEDC</span>
              <span className="font-mono font-semibold text-text-primary" dir="ltr">
                {pwmFreq} Hz
              </span>
            </div>
          </div>
        )}

        {/* Live ADC1 Parameter Editor for analog_input */}
        {isAnalogInput && <AnalogInputConfigEditor segment={segment} onApplied={onCloseMenu} />}

        {/* Mode & Auto-Off Timer Controls */}
        {onUpdateSegmentMode && !isReadOnlyInput && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-text-secondary">
              {isAnalogOutput ? "تایمر خاموشی خودکار" : "حالت کلید و تایمر خودکار"}
            </span>
            <div className="flex items-center justify-between bg-secondary rounded-xl p-2 border border-border-color">
              <SegmentControls
                segment={segment}
                mode={mode}
                onUpdateSegmentMode={onUpdateSegmentMode}
                onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
                countdown={countdown}
                {...autoOffMenuProps}
              />
            </div>
          </div>
        )}

        {/* Destructive Action */}
        <div className="pt-1.5 border-t border-border-color">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-secondary">
            <span className="text-xs font-bold text-destructive truncate">
              حذف این قطعه از داشبورد
            </span>
            <DeleteButton
              size="sm"
              resetAfter={0}
              onConfirm={() => {
                onCloseMenu();
                onRemove(segment.id);
              }}
              label={`حذف قطعه ${segment.title}`}
            />
          </div>
        </div>
      </div>
    </m.div>
  );

  return createPortal(
    <AnimatePresence>{isSettingsOpen && menuNode}</AnimatePresence>,
    document.body,
  );
}
