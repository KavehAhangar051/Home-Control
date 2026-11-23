"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Check } from "@/components/ui/hugeicons-groups/controls";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface ProgressStepItem {
  id: string;
  title: string;
  description?: string;
}

export interface ProgressStepsProps {
  steps: readonly ProgressStepItem[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  /** Highest step index the user is allowed to jump to directly (defaults to currentStep). */
  maxReachableStep?: number;
  animationsEnabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface GrainParticle {
  t: number;
  speed: number;
  yOffset: number;
  driftY: number;
  radius: number;
  alpha: number;
  delay: number;
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

function toPersianStepNumber(num: number): string {
  return String(num)
    .split("")
    .map((ch) => {
      const idx = Number(ch);
      return Number.isNaN(idx) ? ch : PERSIAN_DIGITS[idx];
    })
    .join("");
}

/**
 * Dissolve-inspired particle-grain stream connector between two progress steps.
 * Streams micro-grains from the completed step toward the newly active step in RTL,
 * then immediately halts its rAF loop once all grains settle (zero idle CPU).
 */
function DissolveConnector({
  filled,
  burstDirection,
  burstId,
  reduceMotion,
}: {
  filled: boolean;
  burstDirection: "forward" | "backward" | null;
  burstId: number;
  reduceMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (reduceMotion || !burstDirection || burstId === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof document !== "undefined") {
      if (document.hidden) return;
      if (document.documentElement.dataset.perfTier === "lite") return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(24, Math.round(rect.width));
    const height = Math.max(20, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rootStyles = getComputedStyle(document.documentElement);
    const accentColor = rootStyles.getPropertyValue("--accent3").trim() || "#ededed";

    const isRtl = getComputedStyle(canvas).direction === "rtl";
    const goRightToLeft =
      (isRtl && burstDirection === "forward") || (!isRtl && burstDirection === "backward");

    const particleCount = Math.min(34, Math.max(18, Math.round(width / 5)));
    const particles: GrainParticle[] = Array.from({ length: particleCount }, (_, i) => ({
      t: 0,
      speed: 1.35 + ((i * 37) % 10) * 0.09,
      yOffset: (((i * 29) % 11) - 5) * 0.85,
      driftY: (((i * 19) % 9) - 4) * 0.55,
      radius: 0.9 + ((i * 13) % 4) * 0.35,
      alpha: 0.55 + ((i * 17) % 5) * 0.1,
      delay: ((i * 23) % 12) * 0.022,
    }));

    let rafId = 0;
    let startTime = 0;
    const centerY = height / 2;

    const draw = (timestamp: number) => {
      if (startTime === 0) startTime = timestamp;
      const elapsedSec = (timestamp - startTime) / 1000;

      ctx.clearRect(0, 0, width, height);

      let alive = false;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const localTime = elapsedSec - p.delay;

        if (localTime < 0) {
          alive = true;
          continue;
        }

        const progress = localTime * p.speed;

        if (progress >= 1) continue;

        alive = true;

        // Smooth cubic-out travel across the track with slight dissolve dispersion near the middle
        const eased = 1 - (1 - progress) ** 3;
        const x = goRightToLeft ? width * (1 - eased) : width * eased;
        const bell = Math.sin(progress * Math.PI);
        const y = centerY + p.yOffset * bell + p.driftY * eased;
        const opacity = p.alpha * bell;

        if (opacity <= 0.02) continue;

        ctx.globalAlpha = opacity;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      if (alive && elapsedSec < 1.15) {
        rafId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, width, height);
    };
  }, [burstDirection, burstId, reduceMotion]);

  return (
    <div aria-hidden="true" className="relative mx-1.5 flex h-7 flex-1 items-center sm:mx-2.5">
      <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-border-color">
        <m.div
          initial={false}
          animate={{ scaleX: filled ? 1 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.36, ease: EASE_OUT }}
          className="h-full w-full origin-right bg-accent3 will-change-transform [backface-visibility:hidden]"
        />
      </div>
      {!reduceMotion && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2"
        />
      )}
    </div>
  );
}

/**
 * Multi-step progress indicator inspired by Dissolve's ProgressSteps.
 * Displays numbered steps on a unified RTL track with particle-grain progress streaming,
 * contextual icon transitions on completion, and direct jump navigation for unlocked steps.
 */
export function ProgressSteps({
  steps,
  currentStep,
  onStepClick,
  maxReachableStep,
  animationsEnabled = true,
  className,
  ariaLabel = "مراحل تکمیل فرم",
}: ProgressStepsProps) {
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);
  const [transitionMeta, setTransitionMeta] = useState<{
    prevStep: number;
    connectorIndex: number;
    direction: "forward" | "backward";
    burstId: number;
  }>({
    prevStep: currentStep,
    connectorIndex: -1,
    direction: "forward",
    burstId: 0,
  });

  if (transitionMeta.prevStep !== currentStep) {
    const isForward = currentStep > transitionMeta.prevStep;
    setTransitionMeta({
      prevStep: currentStep,
      connectorIndex: isForward ? transitionMeta.prevStep : currentStep,
      direction: isForward ? "forward" : "backward",
      burstId: transitionMeta.burstId + 1,
    });
  }

  const reachable = Math.max(currentStep, maxReachableStep ?? currentStep);
  const activeStepItem = steps[currentStep];

  return (
    <nav aria-label={ariaLabel} className={cn("w-full space-y-2", className)} dir="rtl">
      <ol className="flex w-full items-start">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isClickable = Boolean(onStepClick) && index <= reachable && index !== currentStep;
          const isLast = index === steps.length - 1;
          const connectorBurst =
            transitionMeta.connectorIndex === index ? transitionMeta.direction : null;

          return (
            <Fragment key={step.id}>
              <li className="flex shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable && onStepClick) {
                      onStepClick(index);
                    }
                  }}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`مرحله ${index + 1}: ${step.title}`}
                  className={cn(
                    "group relative flex min-h-11 min-w-11 flex-col items-center justify-start gap-1.5 rounded-xl px-1 pt-0.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset",
                    isClickable ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex size-7 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-[background-color,border-color,color,box-shadow] duration-200",
                      isCompleted
                        ? "border-accent3 bg-accent3 text-accent3-foreground"
                        : isActive
                          ? "border-accent3 bg-card-bg-solid text-text-primary ring-4 ring-accent3/15"
                          : "border-border-color bg-bg-main text-text-muted",
                      isClickable && "group-hover:border-accent3 group-hover:text-text-primary",
                    )}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isCompleted ? (
                        <m.span
                          key="step-done"
                          initial={
                            reduceMotion ? false : { opacity: 0, scale: 0.25, filter: "blur(4px)" }
                          }
                          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                          exit={
                            reduceMotion
                              ? { opacity: 0, transition: { duration: 0 } }
                              : { opacity: 0, scale: 0.25, filter: "blur(4px)" }
                          }
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { type: "spring", duration: 0.3, bounce: 0 }
                          }
                          className="flex items-center justify-center"
                        >
                          <Check className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                        </m.span>
                      ) : (
                        <m.span
                          key="step-num"
                          initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={
                            reduceMotion
                              ? { opacity: 0, transition: { duration: 0 } }
                              : { opacity: 0, scale: 0.7 }
                          }
                          transition={
                            reduceMotion ? { duration: 0 } : { duration: 0.16, ease: EASE_OUT }
                          }
                          className="leading-none"
                        >
                          {toPersianStepNumber(index + 1)}
                        </m.span>
                      )}
                    </AnimatePresence>
                  </span>

                  <span
                    className={cn(
                      "max-w-[5.5rem] truncate text-[11px] leading-4 transition-colors sm:max-w-[8rem] sm:text-xs",
                      isActive
                        ? "font-semibold text-text-primary"
                        : isCompleted
                          ? "font-medium text-text-secondary"
                          : "font-normal text-text-muted",
                    )}
                  >
                    {step.title}
                  </span>
                </button>
              </li>

              {!isLast && (
                <DissolveConnector
                  filled={index < currentStep}
                  burstDirection={connectorBurst}
                  burstId={transitionMeta.burstId}
                  reduceMotion={reduceMotion}
                />
              )}
            </Fragment>
          );
        })}
      </ol>

      {activeStepItem?.description && (
        <p className="text-center text-[11px] leading-5 text-text-muted sm:text-xs">
          {activeStepItem.description}
        </p>
      )}
    </nav>
  );
}
