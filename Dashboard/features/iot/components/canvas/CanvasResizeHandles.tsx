"use client";

import type React from "react";
import type { CanvasResizeDirection } from "./canvasTypes";

interface CanvasResizeHandlesProps {
  nodeId: string;
  kind: "group" | "segment";
  ariaLabel: string;
  isSelected: boolean;
  cornerRadiusClass?: string;
  onStartResize: (
    nodeId: string,
    kind: "group" | "segment",
    direction: CanvasResizeDirection,
    e: React.PointerEvent<HTMLElement>,
  ) => void;
}

/**
 * Shared touch- and mouse-friendly RTL corner & bottom-edge resize handles
 * for canvas group and segment nodes.
 */
export default function CanvasResizeHandles({
  nodeId,
  kind,
  ariaLabel,
  isSelected,
  cornerRadiusClass = "size-3.5 rounded-bl-[10px]",
  onStartResize,
}: CanvasResizeHandlesProps) {
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        data-canvas-resize="true"
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          if (e.button === 0) onStartResize(nodeId, kind, "sw", e);
        }}
        style={{ touchAction: "none" }}
        className="group/resize absolute -bottom-1.5 -left-1.5 z-30 size-9 cursor-nesw-resize sm:-bottom-1 sm:-left-1 sm:size-7"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[8px] left-[8px] border-b-2 border-l-2 transition-colors sm:bottom-[6px] sm:left-[6px] ${cornerRadiusClass} ${
            isSelected ? "border-accent3" : "border-text-muted/45 group-hover/resize:border-accent3"
          }`}
        />
      </button>

      <div
        data-canvas-resize="true"
        onPointerDown={(e) => {
          if (e.button === 0) onStartResize(nodeId, kind, "se", e);
        }}
        style={{ touchAction: "none" }}
        className="absolute -right-2 -bottom-2 z-30 size-8 cursor-nwse-resize sm:-right-1.5 sm:-bottom-1.5 sm:size-6"
      />

      <div
        data-canvas-resize="true"
        onPointerDown={(e) => {
          if (e.button === 0) onStartResize(nodeId, kind, "s", e);
        }}
        style={{ touchAction: "none" }}
        className="absolute inset-x-6 -bottom-1.5 z-20 h-3.5 cursor-ns-resize sm:inset-x-5 sm:-bottom-1 sm:h-2.5"
      />
    </>
  );
}
