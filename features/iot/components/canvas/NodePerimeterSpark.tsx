"use client";

import React from "react";

interface NodePerimeterSparkProps {
  /** Whether the traveling perimeter spark is currently visible */
  active: boolean;
  /** Respects global user reduced-motion / animations toggle */
  animationsEnabled: boolean;
  /** Corner radius matching outer card (`16` for rounded-2xl, `24` for rounded-3xl) */
  radius: 16 | 24;
  /** Spark stroke color (CSS color or variable) */
  color?: string;
  /** Burst speed mode: `flow` for live signals, `pulse` for freshly connected burst */
  speed?: "flow" | "pulse";
}

const BORDER_MASK_STYLE: React.CSSProperties = {
  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
  WebkitMaskComposite: "xor",
  maskComposite: "exclude",
  contain: "strict",
};

/**
 * Renders a purely GPU-composited luminous perimeter spark that orbits smoothly around
 * a rounded node's concentric border via VRAM-promoted conic-gradient layers, eliminating
 * main-thread SVG `stroke-dashoffset` repaints.
 */
export default React.memo(function NodePerimeterSpark({
  active,
  animationsEnabled,
  radius,
  color = "var(--accent3)",
  speed = "flow",
}: NodePerimeterSparkProps) {
  if (!active || !animationsEnabled) {
    return null;
  }

  const spinClass = speed === "pulse" ? "animate-node-spark-fast" : "animate-node-spark";

  const haloGradient = `conic-gradient(from 0deg, transparent 0deg 262deg, color-mix(in oklab, ${color} 45%, transparent) 292deg, ${color} 336deg, transparent 360deg)`;
  const coreGradient = `conic-gradient(from 0deg, transparent 0deg 282deg, color-mix(in oklab, ${color} 65%, white) 334deg, transparent 360deg)`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      style={{
        borderRadius: radius,
        contain: "strict",
        transform: "translateZ(0)",
      }}
    >
      {/* Outer halo streak masked strictly to the border ring */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          ...BORDER_MASK_STYLE,
          borderRadius: radius,
          padding: 3.5,
        }}
      >
        <div
          className={`pointer-events-none absolute top-1/2 left-1/2 aspect-square will-change-transform [backface-visibility:hidden] ${spinClass}`}
          style={{
            width: "max(220%, 560px)",
            backgroundImage: haloGradient,
          }}
        />
      </div>

      {/* Crisp bright core comet */}
      <div
        className="pointer-events-none absolute inset-0 opacity-95"
        style={{
          ...BORDER_MASK_STYLE,
          borderRadius: radius,
          padding: 1.75,
        }}
      >
        <div
          className={`pointer-events-none absolute top-1/2 left-1/2 aspect-square will-change-transform [backface-visibility:hidden] ${spinClass}`}
          style={{
            width: "max(220%, 560px)",
            backgroundImage: coreGradient,
          }}
        />
      </div>
    </div>
  );
});
