import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type React from "react";
import { RangeSlider } from "@/components/motion/range-slider";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isAnalogOutputSegment } from "@/features/iot/utils/analogOutput";
import { DURATION, EASE_IN_OUT, TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import type { SegmentData } from "../core/types";

interface SegmentControlsProps {
  segment: SegmentData;
  mode: "switch" | "push";
  onUpdateSegmentMode: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, autoOff: number) => void;
  countdown?: number | null;
  showAutoOffMenu: boolean;
  setShowAutoOffMenu: (val: boolean) => void;
  autoOffButtonRef: React.RefObject<HTMLButtonElement | null>;
  autoOffMenuRef: React.RefObject<HTMLDivElement | null>;
}

const formatTime = (seconds: number) =>
  seconds === 0
    ? "غیرفعال"
    : seconds < 60
      ? `${seconds} ثانیه`
      : seconds % 60 === 0
        ? `${Math.floor(seconds / 60)} دقیقه`
        : `${Math.floor(seconds / 60)} دقیقه و ${seconds % 60} ثانیه`;

export default function SegmentControls({
  segment,
  mode,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  countdown,
  showAutoOffMenu,
  setShowAutoOffMenu,
  autoOffButtonRef,
  autoOffMenuRef,
}: SegmentControlsProps) {
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);
  const autoOffValue = segment.auto_off || 0;
  const isAnalog = isAnalogOutputSegment(segment);

  return (
    <div className="flex items-center gap-1.5 relative" onPointerDown={(e) => e.stopPropagation()}>
      {!isAnalog && (
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[mode]}
          onValueChange={(vals) => {
            const val = vals[0];

            if (val === "switch" || val === "push") {
              onUpdateSegmentMode(segment.id, val);
            }
          }}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value="switch"
                  className="h-6 px-2.5 text-[10px] font-sans font-bold cursor-pointer select-none aria-pressed:bg-accent3 aria-pressed:text-bg-main"
                >
                  سوئیچ
                </ToggleGroupItem>
              }
            />
            <TooltipContent>حالت کلید دائمی (روشن/خاموش)</TooltipContent>
          </Tooltip>

          {(!segment.auto_off || segment.auto_off === 0) && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value="push"
                    className="h-6 px-2.5 text-[10px] font-sans font-bold cursor-pointer select-none aria-pressed:bg-accent3 aria-pressed:text-bg-main"
                  >
                    شستی
                  </ToggleGroupItem>
                }
              />
              <TooltipContent>حالت شستی لحظه‌ای (فشاری)</TooltipContent>
            </Tooltip>
          )}
        </ToggleGroup>
      )}

      {onUpdateSegmentAutoOff && (
        <div
          className={`relative flex items-center ${isAnalog ? "" : "pr-1.5 border-r border-border"}`}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  ref={autoOffButtonRef}
                  pressed={showAutoOffMenu || autoOffValue > 0}
                  onPressedChange={() => setShowAutoOffMenu(!showAutoOffMenu)}
                  aria-label="تنظیم زمان خاموشی خودکار"
                  aria-expanded={showAutoOffMenu}
                  className={`h-6 min-w-6 px-1.5 gap-1 rounded-md transition-[background-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.96] cursor-pointer group/timer-btn ${
                    autoOffValue > 0
                      ? "text-accent3 bg-accent3/15 border border-accent3/30 aria-pressed:bg-accent3/15 data-[state=on]:bg-accent3/15"
                      : "text-muted-foreground bg-transparent aria-pressed:bg-muted md:hover:text-foreground md:hover:bg-muted"
                  }`}
                >
                  <m.svg
                    aria-hidden="true"
                    animate={autoOffValue > 0 ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
                    transition={
                      autoOffValue > 0
                        ? {
                            repeat: Infinity,
                            duration: DURATION.ambient,
                            ease: EASE_IN_OUT,
                            repeatDelay: 1,
                          }
                        : {}
                    }
                    className="size-3.5 shrink-0 transition-transform group-hover/timer-btn:rotate-12"
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </m.svg>
                  {countdown !== null && countdown !== undefined ? (
                    <span className="text-[10px] font-bold text-accent3 tabular-nums">
                      {countdown}s
                    </span>
                  ) : autoOffValue > 0 ? (
                    <span className="text-[9.5px] font-bold text-accent3 tabular-nums">
                      {autoOffValue}s
                    </span>
                  ) : null}
                </Toggle>
              }
            />
            <TooltipContent>تایمر خاموشی خودکار</TooltipContent>
          </Tooltip>
        </div>
      )}

      <AnimatePresence>
        {onUpdateSegmentAutoOff && showAutoOffMenu && (
          <m.div
            ref={autoOffMenuRef}
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: -4, scale: 0.96, transition: TRANSITION_EXIT_QUICK }
            }
            transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_QUICK}
            className="absolute top-[calc(100%+8px)] left-0 w-56 origin-top-left bg-card-bg-solid backdrop-blur-xl border border-border-color rounded-xl shadow-xl p-3 z-[120] cursor-default text-right"
          >
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[11px] font-bold text-text-primary tabular-nums">
                تایمر: {formatTime(autoOffValue)}
              </span>
              {autoOffValue > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdateSegmentAutoOff(segment.id, 0)}
                  className="text-[10px] font-bold text-destructive bg-secondary px-2 py-0.5 rounded-md md:hover:bg-destructive md:hover:text-destructive-foreground transition-colors cursor-pointer"
                >
                  غیرفعال
                </button>
              )}
            </div>
            <span className="block text-[11px] text-text-secondary mb-2">
              زمان خاموشی خودکار (ثانیه)
            </span>
            <RangeSlider
              min={0}
              max={600}
              step={1}
              value={autoOffValue}
              onValueChange={(val) => {
                onUpdateSegmentAutoOff(segment.id, val);

                if (val > 0 && mode === "push") onUpdateSegmentMode(segment.id, "switch");
              }}
              aria-label="زمان خاموشی خودکار بر حسب ثانیه"
              formatValueText={formatTime}
              className="h-9 border border-border-color/60"
            />
            <div
              dir="ltr"
              className="flex justify-between text-[10px] text-text-muted mt-1.5 px-0.5 tabular-nums"
            >
              <span>غیرفعال</span>
              <span>۱۰ دقیقه</span>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
