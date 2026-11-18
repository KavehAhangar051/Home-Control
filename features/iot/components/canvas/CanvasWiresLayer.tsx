"use client";

import React from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useIsLitePerformanceTier } from "@/lib/hooks/use-performance-tier";
import { buildBezierWireGeometry } from "./canvasGeometry";
import type { CanvasNodeRect, CanvasWireConnection } from "./canvasTypes";

interface CanvasWiresLayerProps {
  connections: CanvasWireConnection[];
  nodes: Record<string, CanvasNodeRect>;
  selectedNodeId: string | null;
  animationsEnabled: boolean;
}

interface CanvasWireItemProps {
  connection: CanvasWireConnection;
  nodes: Record<string, CanvasNodeRect>;
  selectedNodeId: string | null;
  animationsEnabled: boolean;
  showParticles: boolean;
}

const CanvasWireItem = React.memo(function CanvasWireItem({
  connection,
  nodes,
  selectedNodeId,
  animationsEnabled,
  showParticles,
}: CanvasWireItemProps) {
  const isActive = useIoTStore((state) =>
    Boolean(connection.pin && state.pinsState[connection.pin]),
  );

  const sourceRect = nodes[connection.sourceId];
  const targetRect = nodes[connection.targetId];

  if (!sourceRect || !targetRect) return null;

  const { path, startX, startY, endX, endY } = buildBezierWireGeometry(sourceRect, targetRect);

  const isHighlighted =
    selectedNodeId === connection.sourceId || selectedNodeId === connection.targetId;

  const strokeColor = isActive
    ? connection.isInput
      ? "#10b981"
      : "var(--accent3)"
    : isHighlighted
      ? "var(--accent3)"
      : "var(--border-color)";

  return (
    <g>
      {(isActive || isHighlighted) && (
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
        strokeWidth={isActive || isHighlighted ? 2.5 : 1.75}
        strokeOpacity={isActive ? 0.92 : isHighlighted ? 0.78 : 0.55}
        strokeLinecap="round"
      />

      {isActive && animationsEnabled && (
        <>
          <path
            d={path}
            fill="none"
            stroke={connection.isInput ? "#34d399" : "var(--accent3)"}
            strokeWidth={2.5}
            strokeDasharray="6 10"
            strokeLinecap="round"
            className="animate-[dash_1.15s_linear_infinite]"
          />
          {showParticles && (
            <>
              <circle
                r={4.2}
                fill={connection.isInput ? "#10b981" : "var(--accent3)"}
                fillOpacity={0.3}
              >
                <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
              </circle>
              <circle r={2.3} fill={connection.isInput ? "#a7f3d0" : "#ffffff"}>
                <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
              </circle>
            </>
          )}
        </>
      )}

      <circle
        cx={startX}
        cy={startY}
        r={4}
        fill={isActive ? strokeColor : "var(--card-bg-solid)"}
        stroke={strokeColor}
        strokeWidth={2}
      />
      <circle
        cx={endX}
        cy={endY}
        r={4}
        fill={isActive ? strokeColor : "var(--card-bg-solid)"}
        stroke={strokeColor}
        strokeWidth={2}
      />
    </g>
  );
});

export default React.memo(function CanvasWiresLayer({
  connections,
  nodes,
  selectedNodeId,
  animationsEnabled,
}: CanvasWiresLayerProps) {
  const isLiteTier = useIsLitePerformanceTier();

  if (connections.length === 0) return null;

  const showParticles = animationsEnabled && !isLiteTier;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      style={{ width: 1, height: 1 }}
    >
      {connections.map((connection) => (
        <CanvasWireItem
          key={connection.id}
          connection={connection}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          animationsEnabled={animationsEnabled}
          showParticles={showParticles}
        />
      ))}
    </svg>
  );
});
