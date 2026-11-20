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
  sourceRect: CanvasNodeRect | undefined;
  targetRect: CanvasNodeRect | undefined;
  isHighlighted: boolean;
  animationsEnabled: boolean;
  showParticles: boolean;
}

const CanvasWireItem = React.memo(function CanvasWireItem({
  connection,
  sourceRect,
  targetRect,
  isHighlighted,
  animationsEnabled,
  showParticles,
}: CanvasWireItemProps) {
  const isActive = useIoTStore((state) =>
    Boolean(connection.pin && state.pinsState[connection.pin]),
  );

  if (!sourceRect || !targetRect) return null;

  const { path, startX, startY, endX, endY } = buildBezierWireGeometry(sourceRect, targetRect);

  const strokeColor = isActive || isHighlighted ? "var(--accent3)" : "var(--border-color)";

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
            stroke="var(--accent3)"
            strokeWidth={2.5}
            strokeDasharray="6 10"
            strokeLinecap="round"
            className="animate-[dash_1.15s_linear_infinite]"
          />
          {showParticles && (
            <>
              <circle r={4.2} fill="var(--accent3)" fillOpacity={0.3}>
                <animateMotion dur="1.3s" repeatCount="indefinite" path={path} />
              </circle>
              <circle r={2.3} fill="var(--accent3-foreground)">
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
          sourceRect={nodes[connection.sourceId]}
          targetRect={nodes[connection.targetId]}
          isHighlighted={
            selectedNodeId === connection.sourceId || selectedNodeId === connection.targetId
          }
          animationsEnabled={animationsEnabled}
          showParticles={showParticles}
        />
      ))}
    </svg>
  );
});
