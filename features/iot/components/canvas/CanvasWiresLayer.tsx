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
}

interface CanvasWireParticlesItemProps {
  connection: CanvasWireConnection;
  sourceRect: CanvasNodeRect | undefined;
  targetRect: CanvasNodeRect | undefined;
}

const CanvasWireItem = React.memo(function CanvasWireItem({
  connection,
  sourceRect,
  targetRect,
  isHighlighted,
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

      {isActive && (
        <path
          d={path}
          fill="none"
          stroke="color-mix(in oklab, var(--accent3) 72%, white)"
          strokeWidth={2}
          strokeOpacity={0.45}
          strokeDasharray="6 10"
          strokeLinecap="round"
        />
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

const CanvasWireSignalParticle = React.memo(function CanvasWireSignalParticle({
  connection,
  sourceRect,
  targetRect,
}: CanvasWireParticlesItemProps) {
  const isActive = useIoTStore((state) =>
    Boolean(connection.pin && state.pinsState[connection.pin]),
  );

  if (!isActive || !sourceRect || !targetRect) return null;

  const { path } = buildBezierWireGeometry(sourceRect, targetRect);
  const particleStyle: React.CSSProperties = {
    offsetPath: `path("${path}")`,
    offsetAnchor: "50% 50%",
    offsetRotate: "0deg",
    animationDuration: "1.3s",
    transform: "translateZ(0)",
  };

  return (
    <>
      <span
        className="animate-wire-signal pointer-events-none absolute top-0 left-0 flex size-3.5 items-center justify-center rounded-full bg-accent3/30"
        style={particleStyle}
      >
        <span className="size-1.5 rounded-full bg-accent3" />
      </span>
      <span
        className="animate-wire-signal pointer-events-none absolute top-0 left-0 flex size-3.5 items-center justify-center rounded-full bg-accent3/30"
        style={{ ...particleStyle, animationDelay: "-0.65s" }}
      >
        <span className="size-1.5 rounded-full bg-accent3" />
      </span>
    </>
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
    <>
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
          />
        ))}
      </svg>

      {showParticles && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 size-0 overflow-visible"
        >
          {connections.map((connection) => (
            <CanvasWireSignalParticle
              key={connection.id}
              connection={connection}
              sourceRect={nodes[connection.sourceId]}
              targetRect={nodes[connection.targetId]}
            />
          ))}
        </div>
      )}
    </>
  );
});
