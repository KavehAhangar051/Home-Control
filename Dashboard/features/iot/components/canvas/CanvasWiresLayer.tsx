"use client";

import React from "react";
import { buildBezierWireGeometry } from "./canvasGeometry";
import type { CanvasNodeRect, CanvasWireConnection } from "./canvasTypes";

interface CanvasWiresLayerProps {
  connections: CanvasWireConnection[];
  nodes: Record<string, CanvasNodeRect>;
  selectedNodeId: string | null;
  animationsEnabled: boolean;
}

export default React.memo(function CanvasWiresLayer({
  connections,
  nodes,
  selectedNodeId,
  animationsEnabled,
}: CanvasWiresLayerProps) {
  if (connections.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      style={{ width: 1, height: 1 }}
    >
      {connections.map((conn) => {
        const sourceRect = nodes[conn.sourceId];
        const targetRect = nodes[conn.targetId];

        if (!sourceRect || !targetRect) return null;

        const { path, startX, startY, endX, endY } = buildBezierWireGeometry(
          sourceRect,
          targetRect,
        );
        const isHighlighted = selectedNodeId === conn.sourceId || selectedNodeId === conn.targetId;
        const strokeColor = conn.isActive
          ? conn.isInput
            ? "#10b981"
            : "var(--accent3)"
          : isHighlighted
            ? "var(--accent3)"
            : "var(--border-color)";

        return (
          <g key={conn.id}>
            {(conn.isActive || isHighlighted) && (
              <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={5.5}
                strokeOpacity={0.18}
                strokeLinecap="round"
              />
            )}

            <path
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={conn.isActive || isHighlighted ? 2.5 : 1.75}
              strokeOpacity={conn.isActive ? 0.92 : isHighlighted ? 0.78 : 0.55}
              strokeLinecap="round"
            />

            {conn.isActive && animationsEnabled && (
              <>
                <path
                  d={path}
                  fill="none"
                  stroke={conn.isInput ? "#34d399" : "var(--accent3)"}
                  strokeWidth={2.5}
                  strokeDasharray="6 10"
                  strokeLinecap="round"
                  className="animate-[dash_1.15s_linear_infinite]"
                />
                <circle
                  r={4.2}
                  fill={conn.isInput ? "#10b981" : "var(--accent3)"}
                  fillOpacity={0.3}
                >
                  <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
                </circle>
                <circle r={2.3} fill={conn.isInput ? "#a7f3d0" : "#ffffff"}>
                  <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
                </circle>
              </>
            )}

            <circle
              cx={startX}
              cy={startY}
              r={4}
              fill={conn.isActive ? strokeColor : "var(--card-bg-solid)"}
              stroke={strokeColor}
              strokeWidth={2}
            />
            <circle
              cx={endX}
              cy={endY}
              r={4}
              fill={conn.isActive ? strokeColor : "var(--card-bg-solid)"}
              stroke={strokeColor}
              strokeWidth={2}
            />
          </g>
        );
      })}
    </svg>
  );
});
