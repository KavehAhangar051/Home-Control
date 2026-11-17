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
        aria-label={ariaLabel}
        onPointerDown={(e) => {
          if (e.button === 0) onStartResize(nodeId, kind, "sw", e);
        }}
        style={{ touchAction: "none" }}
        className="group/resize absolute -bottom-1 -left-1 z-30 size-7 cursor-nesw-resize"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[6px] left-[6px] border-b-2 border-l-2 transition-colors ${cornerRadiusClass} ${
            isSelected ? "border-accent3" : "border-text-muted/45 group-hover/resize:border-accent3"
          }`}
        />
      </button>

      <div
        onPointerDown={(e) => {
          if (e.button === 0) onStartResize(nodeId, kind, "se", e);
        }}
        style={{ touchAction: "none" }}
        className="absolute -right-1.5 -bottom-1.5 z-30 size-6 cursor-nwse-resize"
      />

      <div
        onPointerDown={(e) => {
          if (e.button === 0) onStartResize(nodeId, kind, "s", e);
        }}
        style={{ touchAction: "none" }}
        className="absolute inset-x-5 -bottom-1 z-20 h-2.5 cursor-ns-resize"
      />
    </>
  );
}
