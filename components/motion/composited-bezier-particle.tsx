"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

export interface CubicBezierCurve {
  startX: number;
  startY: number;
  control1X: number;
  control1Y: number;
  control2X: number;
  control2Y: number;
  endX: number;
  endY: number;
}

interface CompositedBezierParticleProps {
  curve: CubicBezierCurve;
  durationMs: number;
  delayMs?: number;
  className: string;
  children?: ReactNode;
}

interface Point {
  x: number;
  y: number;
  distance: number;
}

const SAMPLE_COUNT = 64;
const FADE_LENGTH = 0.08;
const PARTICLE_ANCHOR = 7;
const activeAnimations = new Set<Animation>();
let visibilityListenerAttached = false;

function syncAnimationVisibility(): void {
  for (const animation of activeAnimations) {
    if (document.hidden) {
      animation.pause();
    } else {
      animation.play();
    }
  }
}

function registerVisibilityAwareAnimation(animation: Animation): () => void {
  activeAnimations.add(animation);

  if (!visibilityListenerAttached) {
    document.addEventListener("visibilitychange", syncAnimationVisibility);
    visibilityListenerAttached = true;
  }

  if (document.hidden) animation.pause();

  return () => {
    activeAnimations.delete(animation);

    if (activeAnimations.size === 0 && visibilityListenerAttached) {
      document.removeEventListener("visibilitychange", syncAnimationVisibility);
      visibilityListenerAttached = false;
    }
  };
}

function evaluateBezier(curve: CubicBezierCurve, t: number): Point {
  const inverse = 1 - t;
  const inverseSquared = inverse * inverse;
  const tSquared = t * t;

  return {
    x:
      inverseSquared * inverse * curve.startX +
      3 * inverseSquared * t * curve.control1X +
      3 * inverse * tSquared * curve.control2X +
      tSquared * t * curve.endX,
    y:
      inverseSquared * inverse * curve.startY +
      3 * inverseSquared * t * curve.control1Y +
      3 * inverse * tSquared * curve.control2Y +
      tSquared * t * curve.endY,
    distance: 0,
  };
}

/**
 * Samples a cubic Bezier once and creates equal-distance transform keyframes.
 * The browser can composite the resulting transform/opacity animation without
 * recalculating the path or updating React on every frame.
 */
function createTransformKeyframes(curve: CubicBezierCurve): Keyframe[] {
  const samples: Point[] = [];
  let totalLength = 0;

  for (let index = 0; index <= SAMPLE_COUNT; index++) {
    const point = evaluateBezier(curve, index / SAMPLE_COUNT);
    const previous = samples[index - 1];

    if (previous) {
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      totalLength += Math.hypot(dx, dy);
    }

    point.distance = totalLength;
    samples.push(point);
  }

  if (totalLength === 0) {
    return [
      {
        transform: `translate3d(${curve.startX - PARTICLE_ANCHOR}px, ${curve.startY - PARTICLE_ANCHOR}px, 0)`,
        opacity: 0,
      },
    ];
  }

  const keyframes: Keyframe[] = [];
  let sampleIndex = 1;

  for (let index = 0; index <= SAMPLE_COUNT; index++) {
    const progress = index / SAMPLE_COUNT;
    const targetDistance = totalLength * progress;

    while (
      sampleIndex < SAMPLE_COUNT &&
      samples[sampleIndex].distance < targetDistance
    ) {
      sampleIndex++;
    }

    const before = samples[sampleIndex - 1];
    const after = samples[sampleIndex];
    const span = after.distance - before.distance;
    const localProgress = span > 0 ? (targetDistance - before.distance) / span : 0;
    const x = before.x + (after.x - before.x) * localProgress;
    const y = before.y + (after.y - before.y) * localProgress;
    const opacity = Math.min(1, progress / FADE_LENGTH, (1 - progress) / FADE_LENGTH);

    keyframes.push({
      transform: `translate3d(${x - PARTICLE_ANCHOR}px, ${y - PARTICLE_ANCHOR}px, 0)`,
      opacity: Math.max(0, opacity),
    });
  }

  return keyframes;
}

export function CompositedBezierParticle({
  curve,
  durationMs,
  delayMs = 0,
  className,
  children,
}: CompositedBezierParticleProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const {
    startX,
    startY,
    control1X,
    control1Y,
    control2X,
    control2Y,
    endX,
    endY,
  } = curve;

  useEffect(() => {
    const element = elementRef.current;

    if (!element || prefersReducedMotion !== false) return;

    if (typeof element.animate !== "function") {
      element.style.opacity = "1";
      return;
    }

    const animation = element.animate(
      createTransformKeyframes({
        startX,
        startY,
        control1X,
        control1Y,
        control2X,
        control2Y,
        endX,
        endY,
      }),
      {
        duration: durationMs,
        delay: delayMs,
        iterations: Number.POSITIVE_INFINITY,
        easing: "linear",
      },
    );
    const unregister = registerVisibilityAwareAnimation(animation);

    return () => {
      unregister();
      animation.cancel();
    };
  }, [
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
    prefersReducedMotion,
  ]);

  return (
    <span
      ref={elementRef}
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 left-0 ${className}`}
      style={{
        transform: `translate3d(${curve.startX - PARTICLE_ANCHOR}px, ${curve.startY - PARTICLE_ANCHOR}px, 0)`,
        opacity: prefersReducedMotion === false ? 0 : 1,
      }}
    >
      {children}
    </span>
  );
}
