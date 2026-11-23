"use client";
/**
 * ProgressSteps for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as
 * the React Native version; the steps themselves live in progress-steps.core.ts.
 *
 * Numbered steps joined by a line: move forward and the current disc streams along the line in
 * grains, filling it, then gathers on the next step. Move back and it streams home.
 *
 * <ProgressSteps steps={['Account', 'Profile', 'Payment', 'Done']} current={step} />
 *
 * <ProgressSteps steps={5} current={step} size="sm" onStepPress={(i) => i < step && setStep(i)} />
 */
import type { CSSProperties } from "react";
import {
  createProgressSteps,
  type ProgressStepsProps as CoreProps,
  type ProgressStepsSize,
} from "./progress-steps.core";
import { useDissolveCore } from "./react";

export type { ProgressStepsSize };

export type ProgressStepsProps = Omit<CoreProps, "steps" | "current"> & {
  /** The steps: their labels, or how many there are (no labels then). Two or more. */
  steps: string[] | number;
  /** The current step, from 0. steps.length marks them all done. */
  current: number;
  /** Outer classes (width, margins...). It stretches to its parent by default. */
  className?: string;
  style?: CSSProperties;
};

export function ProgressSteps({ className, style, ...props }: ProgressStepsProps) {
  const { host } = useDissolveCore(createProgressSteps, props);
  return <div ref={host} className={className} style={style} />;
}
