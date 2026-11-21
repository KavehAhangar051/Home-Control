"use client";

import React from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { CompositedBezierParticle } from "@/components/motion/composited-bezier-particle";
import { useIsLitePerformanceTier } from "@/lib/hooks/use-performance-tier";
import { buildBezierWireGeometry, type BezierWireGeometry } from "./canvasGeometry";
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
  geometry: BezierWireGeometry | undefined;
}

interface CanvasWireParticlesItemProps {
  connection: CanvasWireConnection;
  sourceRect: CanvasNodeRect | undefined;
  targetRect: CanvasNodeRect | undefined;
  geometry: BezierWireGeometry | undefined;
}

const CanvasWireItem = React.memo(function CanvasWireItem({
  connection,
  sourceRect,
  targetRect,
  isHighlighted,
  geometry,
}: CanvasWireItemProps) {
  const isActive = useIoTStore((state) =>
    Boolean(connection.pin && state.pinsState[connection.pin]),
  );

  if (!sourceRect || !targetRect || !geometry) return null;

  const { path, startX, startY, endX, endY } = geometry;

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
  geometry,
}: CanvasWireParticlesItemProps) {
  const isActive = useIoTStore((state) =>
    Boolean(connection.pin && state.pinsState[connection.pin]),
  );

  if (!isActive || !sourceRect || !targetRect || !geometry) return null;

  const curve = geometry;

  return (
    <>
      <CompositedBezierParticle
        curve={curve}
        durationMs={1300}
        className="flex size-3.5 items-center justify-center rounded-full bg-accent3/30"
      >
        <span className="size-1.5 rounded-full bg-accent3" />
      </CompositedBezierParticle>
      <CompositedBezierParticle
        curve={curve}
        durationMs={1300}
        delayMs={-650}
        className="flex size-3.5 items-center justify-center rounded-full bg-accent3/30"
      >
        <span className="size-1.5 rounded-full bg-accent3" />
      </CompositedBezierParticle>
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

  const showParticles = animationsEnabled && !isLiteTier;
  const wireGeometryById = React.useMemo(() => {
    const geometryById = new Map<string, BezierWireGeometry>();

    for (const connection of connections) {
      const sourceRect = nodes[connection.sourceId];
      const targetRect = nodes[connection.targetId];

      if (sourceRect && targetRect) {
        geometryById.set(connection.id, buildBezierWireGeometry(sourceRect, targetRect));
      }
    }

    return geometryById;
  }, [connections, nodes]);

  if (connections.length === 0) return null;

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
            geometry={wireGeometryById.get(connection.id)}
            isHighlighted={
              selectedNodeId === connection.sourceId || selectedNodeId === connection.targetId
            }
          />
        ))}
      </svg>

      {showParticles && (
        <div
          aria-hidden="true"
          style={{ contain: "layout style" }}
          className="pointer-events-none absolute top-0 left-0 size-0 overflow-visible"
        >
          {connections.map((connection) => (
            <CanvasWireSignalParticle
              key={connection.id}
              connection={connection}
              sourceRect={nodes[connection.sourceId]}
              targetRect={nodes[connection.targetId]}
              geometry={wireGeometryById.get(connection.id)}
            />
          ))}
        </div>
      )}
    </>
  );
});
