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

/**
 * Renders a GPU-composited luminous perimeter spark that glides seamlessly around a
 * rounded node's concentric border without affecting layout or pointer events.
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

  const dashClass = speed === "pulse" ? "animate-node-spark-fast" : "animate-node-spark";

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
    >
      {/* Subtle outer halo streak */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={radius}
        ry={radius}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeOpacity={0.28}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="18 82"
        className={dashClass}
      />

      {/* Crisp bright core comet */}
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={radius}
        ry={radius}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeOpacity={0.95}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="14 86"
        className={dashClass}
      />
    </svg>
  );
});
