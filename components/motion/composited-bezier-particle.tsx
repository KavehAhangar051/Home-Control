"use client";

/**
 * @file components/motion/composited-bezier-particle.tsx
 * @description Off-main-thread GPU-composited signal particle that glides along any cubic Bezier
 * wire using LUT-sampled equal-arc-length `translate3d` + `opacity` Web Animations API keyframes.
 * Runs at the display's full native refresh rate (60/120/144/240Hz) in VRAM with zero SVG SMIL
 * paint invalidations and a single shared `visibilitychange` controller.
 */

import { useReducedMotion } from "motion/react";
import React, { useEffect, useRef } from "react";
import { type CubicBezierCurve, sampleEqualArcCubicBezier } from "@/lib/gpuLut";
import { cn } from "@/lib/utils";

export interface CompositedBezierParticleProps {
  curve: CubicBezierCurve;
  durationMs: number;
  delayMs?: number;
  className?: string;
  children?: React.ReactNode;
}

const KEYFRAME_CACHE_LIMIT = 128;
const keyframeCache = new Map<string, Keyframe[]>();

const activeAnimations = new Set<Animation>();
let visibilityListenerAttached = false;

function handleSharedVisibilityChange(): void {
  const hidden = document.hidden;

  for (const animation of activeAnimations) {
    try {
      if (hidden) {
        animation.pause();
      } else if (animation.playState === "paused") {
        animation.play();
      }
    } catch {
      // Ignore animations already finished or detached.
    }
  }
}

function registerAnimation(animation: Animation): () => void {
  activeAnimations.add(animation);

  if (!visibilityListenerAttached && typeof document !== "undefined") {
    visibilityListenerAttached = true;
    document.addEventListener("visibilitychange", handleSharedVisibilityChange);
  }

  if (typeof document !== "undefined" && document.hidden) {
    try {
      animation.pause();
    } catch {
      // No-op in environments without WAAPI pause support.
    }
  }

  return () => {
    activeAnimations.delete(animation);

    if (
      activeAnimations.size === 0 &&
      visibilityListenerAttached &&
      typeof document !== "undefined"
    ) {
      visibilityListenerAttached = false;
      document.removeEventListener("visibilitychange", handleSharedVisibilityChange);
    }
  };
}

function getCurveKeyframes(curve: CubicBezierCurve): Keyframe[] {
  const key = `${curve.startX},${curve.startY},${curve.control1X},${curve.control1Y},${curve.control2X},${curve.control2Y},${curve.endX},${curve.endY}`;
  const cached = keyframeCache.get(key);
  if (cached) return cached;

  const points = sampleEqualArcCubicBezier(curve, 24);
  const lastIndex = points.length - 1;
  const keyframes: Keyframe[] = points.map((pt, index) => {
    const t = index / lastIndex;
    const opacity = t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1;

    return {
      transform: `translate3d(${pt.x}px, ${pt.y}px, 0) translate3d(-50%, -50%, 0)`,
      opacity: Math.round(opacity * 1000) / 1000,
    };
  });

  if (keyframeCache.size >= KEYFRAME_CACHE_LIMIT) {
    const oldestKey = keyframeCache.keys().next().value;
    if (oldestKey !== undefined) keyframeCache.delete(oldestKey);
  }

  keyframeCache.set(key, keyframes);

  return keyframes;
}

/**
 * Renders a GPU-composited particle traveling at constant arc-length velocity along a cubic Bezier.
 */
export const CompositedBezierParticle = React.memo(function CompositedBezierParticle({
  curve,
  durationMs,
  delayMs = 0,
  className,
  children,
}: CompositedBezierParticleProps) {
  const prefersReducedMotion = useReducedMotion();
  const particleRef = useRef<HTMLDivElement | null>(null);

  const { startX, startY, control1X, control1Y, control2X, control2Y, endX, endY } = curve;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const el = particleRef.current;
    if (!el || typeof el.animate !== "function") return;

    const keyframes = getCurveKeyframes({
      startX,
      startY,
      control1X,
      control1Y,
      control2X,
      control2Y,
      endX,
      endY,
    });

    const animation = el.animate(keyframes, {
      duration: Math.max(120, durationMs),
      delay: delayMs,
      iterations: Number.POSITIVE_INFINITY,
      easing: "linear",
    });

    const unregister = registerAnimation(animation);

    return () => {
      unregister();
      animation.cancel();
    };
  }, [
    prefersReducedMotion,
    startX,
    startY,
    control1X,
    control1Y,
    control2X,
    control2Y,
    endX,
    endY,
    durationMs,
    delayMs,
  ]);

  if (prefersReducedMotion) return null;

  return (
    <div
      ref={particleRef}
      aria-hidden="true"
      style={{
        transform: `translate3d(${startX}px, ${startY}px, 0) translate3d(-50%, -50%, 0)`,
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
        contain: "layout style",
      }}
      className={cn("pointer-events-none absolute top-0 left-0", className)}
    >
      {children}
    </div>
  );
});
