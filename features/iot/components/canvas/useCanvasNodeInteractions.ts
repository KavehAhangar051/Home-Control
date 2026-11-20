"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  canvasSegmentNodeId,
  clampCanvasNodeSize,
  getPresetDimensions,
  snapCanvasCoordinate,
} from "./canvasGeometry";
import { replaceStoredCanvasNodes } from "./canvasStorage";
import type {
  CanvasNodeRect,
  CanvasResizeDirection,
  CanvasSizePreset,
  CanvasSubMode,
  CanvasViewport,
} from "./canvasTypes";
import {
  clearNodeDragTiltCssVar,
  computeDragTiltDeg,
  findNodeTiltElement,
  setNodeDragTiltCssVar,
} from "./nodeMotion";

const GROUP_NODE_PREFIX = "group:";

interface CascadeChildRect {
  id: string;
  rect: CanvasNodeRect;
}

function collectCascadeGroupChildren(
  nodeId: string,
  activeSubMode: CanvasSubMode,
  cascadeGroupDrag: boolean,
  segments: Segment[],
  nodesMap: Record<string, CanvasNodeRect>,
): CascadeChildRect[] {
  if (activeSubMode !== "graph" || !cascadeGroupDrag || !nodeId.startsWith(GROUP_NODE_PREFIX)) {
    return [];
  }

  const groupName = nodeId.slice(GROUP_NODE_PREFIX.length);
  const children: CascadeChildRect[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (resolveSegmentGroup(seg.group) === groupName) {
      const childId = canvasSegmentNodeId(seg.id);
      const rect = nodesMap[childId];

      if (rect) {
        children.push({ id: childId, rect });
      }
    }
  }

  return children;
}

interface ComputeResizedNodeRectOptions {
  startRect: CanvasNodeRect;
  snappedRightEdge: number;
  snappedBottomEdge: number;
  kind: "group" | "segment";
  activeSubMode: CanvasSubMode;
  direction: CanvasResizeDirection;
  dx: number;
  dy: number;
  snapToGrid: boolean;
}

export function computeResizedNodeRect({
  startRect,
  snappedRightEdge,
  snappedBottomEdge,
  kind,
  activeSubMode,
  direction,
  dx,
  dy,
  snapToGrid,
}: ComputeResizedNodeRectOptions): CanvasNodeRect {
  let rawWidth = startRect.width;
  let rawHeight = startRect.height;
  let rawX = startRect.x;
  let rawY = startRect.y;

  if (direction.includes("e")) rawWidth = startRect.width + dx;

  if (direction.includes("w")) rawWidth = startRect.width - dx;

  if (direction.includes("s")) rawHeight = startRect.height + dy;

  if (direction.includes("n")) rawHeight = startRect.height - dy;

  const clamped = clampCanvasNodeSize(kind, activeSubMode, rawWidth, rawHeight, snapToGrid);

  if (direction.includes("w")) rawX = snappedRightEdge - clamped.width;

  if (direction.includes("n")) rawY = snappedBottomEdge - clamped.height;

  return {
    ...startRect,
    x: snapCanvasCoordinate(rawX, snapToGrid),
    y: snapCanvasCoordinate(rawY, snapToGrid),
    width: clamped.width,
    height: clamped.height,
  };
}

export interface UseCanvasNodeInteractionsOptions {
  activeSubMode: CanvasSubMode;
  isLocked: boolean;
  snapToGrid: boolean;
  cascadeGroupDrag: boolean;
  segments: Segment[];
  nodesRef: React.RefObject<Record<string, CanvasNodeRect>>;
  viewportRef: React.RefObject<CanvasViewport>;
  topZIndexRef: React.RefObject<number>;
  setNodes: React.Dispatch<React.SetStateAction<Record<string, CanvasNodeRect>>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useCanvasNodeInteractions({
  activeSubMode,
  isLocked,
  snapToGrid,
  cascadeGroupDrag,
  segments,
  nodesRef,
  viewportRef,
  topZIndexRef,
  setNodes,
  setSelectedNodeId,
}: UseCanvasNodeInteractionsOptions) {
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);

  const bringNodeToFront = React.useCallback(
    (nodeId: string, options?: { skipPersist?: boolean }) => {
      setSelectedNodeId(nodeId);
      const prev = nodesRef.current;
      const current = prev[nodeId];

      if (!current) return;

      if (current.zIndex >= topZIndexRef.current) return;

      const nextZ = ++topZIndexRef.current;

      const updated = {
        ...prev,
        [nodeId]: { ...current, zIndex: nextZ },
      };

      nodesRef.current = updated;
      setNodes(updated);
      if (!options?.skipPersist) {
        replaceStoredCanvasNodes(activeSubMode, updated);
      }
    },
    [activeSubMode, nodesRef, setNodes, setSelectedNodeId, topZIndexRef],
  );

  const startNodeDrag = React.useCallback(
    (nodeId: string, e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || isLocked) return;

      e.stopPropagation();
      bringNodeToFront(nodeId, { skipPersist: true });

      const startRect = nodesRef.current[nodeId];

      if (!startRect) return;

      const activePointerId = e.pointerId;
      const isTouch = e.pointerType === "touch";
      const dragThreshold = isTouch ? 4.5 : 0;
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let lastClientX = e.clientX;
      let hasExceededThreshold = dragThreshold === 0;
      const zoom = viewportRef.current.zoom;
      const tiltEl = findNodeTiltElement(nodeId);

      if (hasExceededThreshold) {
        setDraggingNodeId(nodeId);
        setNodeDragTiltCssVar(tiltEl, 0);
      }

      const childInitialRects = collectCascadeGroupChildren(
        nodeId,
        activeSubMode,
        cascadeGroupDrag,
        segments,
        nodesRef.current,
      );

      const applyPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== activePointerId) return;

        const rawDx = moveEvent.clientX - startClientX;
        const rawDy = moveEvent.clientY - startClientY;

        if (!hasExceededThreshold) {
          if (Math.hypot(rawDx, rawDy) < dragThreshold) return;
          hasExceededThreshold = true;
          setDraggingNodeId(nodeId);
          setNodeDragTiltCssVar(tiltEl, 0);
        }

        const dx = rawDx / zoom;
        const dy = rawDy / zoom;
        const nextX = snapCanvasCoordinate(startRect.x + dx, snapToGrid);
        const nextY = snapCanvasCoordinate(startRect.y + dy, snapToGrid);
        const appliedDx = nextX - startRect.x;
        const appliedDy = nextY - startRect.y;

        setNodeDragTiltCssVar(tiltEl, computeDragTiltDeg(moveEvent.clientX - lastClientX));
        lastClientX = moveEvent.clientX;

        const prev = nodesRef.current;
        const current = prev[nodeId] ?? startRect;

        if (current.x === nextX && current.y === nextY) {
          return;
        }

        const updated = {
          ...prev,
          [nodeId]: { ...current, x: nextX, y: nextY },
        };

        for (let i = 0; i < childInitialRects.length; i++) {
          const child = childInitialRects[i];
          const childCurrent = prev[child.id] ?? child.rect;
          updated[child.id] = {
            ...childCurrent,
            x: snapCanvasCoordinate(child.rect.x + appliedDx, snapToGrid),
            y: snapCanvasCoordinate(child.rect.y + appliedDy, snapToGrid),
          };
        }

        nodesRef.current = updated;
        setNodes(updated);
      };

      let pendingMove: PointerEvent | null = null;
      let frameId: number | null = null;

      const flushPointerMove = () => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;

        const latestMove = pendingMove;
        pendingMove = null;

        if (latestMove) applyPointerMove(latestMove);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== activePointerId) return;
        pendingMove = moveEvent;

        if (frameId === null) {
          frameId = requestAnimationFrame(() => {
            frameId = null;
            const latestMove = pendingMove;
            pendingMove = null;

            if (latestMove) applyPointerMove(latestMove);
          });
        }
      };

      const finishDrag = () => {
        setDraggingNodeId(null);
        clearNodeDragTiltCssVar(tiltEl);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("pointerdown", handleMultiTouchAbort, true);
        window.removeEventListener("blur", handleAbort);
        if (hasExceededThreshold) {
          replaceStoredCanvasNodes(activeSubMode, nodesRef.current);
        }
      };

      const handlePointerUp = (endEvent: PointerEvent) => {
        if (endEvent.pointerId !== activePointerId) return;
        pendingMove = endEvent;
        flushPointerMove();
        finishDrag();
      };

      const handlePointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== activePointerId) return;
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        pendingMove = null;
        finishDrag();
      };

      const handleAbort = () => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        pendingMove = null;
        finishDrag();
      };

      const handleMultiTouchAbort = (downEvent: PointerEvent) => {
        if (downEvent.pointerType === "touch" && downEvent.pointerId !== activePointerId) {
          handleAbort();
        }
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
      window.addEventListener("pointerdown", handleMultiTouchAbort, true);
      window.addEventListener("blur", handleAbort);
    },
    [
      activeSubMode,
      bringNodeToFront,
      cascadeGroupDrag,
      isLocked,
      nodesRef,
      segments,
      setNodes,
      snapToGrid,
      viewportRef,
    ],
  );

  const startNodeResize = React.useCallback(
    (
      nodeId: string,
      kind: "group" | "segment",
      direction: CanvasResizeDirection,
      e: React.PointerEvent<HTMLElement>,
    ) => {
      if (e.button !== 0 || isLocked) return;

      e.stopPropagation();
      e.preventDefault();
      bringNodeToFront(nodeId, { skipPersist: true });

      const startRect = nodesRef.current[nodeId];

      if (!startRect) return;

      setDraggingNodeId(nodeId);

      const activePointerId = e.pointerId;
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const zoom = viewportRef.current.zoom;
      const snappedRightEdge = snapCanvasCoordinate(startRect.x + startRect.width, snapToGrid);
      const snappedBottomEdge = snapCanvasCoordinate(startRect.y + startRect.height, snapToGrid);

      const applyPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== activePointerId) return;

        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;
        const prev = nodesRef.current;
        const current = prev[nodeId] ?? startRect;

        const resized = computeResizedNodeRect({
          startRect,
          snappedRightEdge,
          snappedBottomEdge,
          kind,
          activeSubMode,
          direction,
          dx,
          dy,
          snapToGrid,
        });

        if (
          current.x === resized.x &&
          current.y === resized.y &&
          current.width === resized.width &&
          current.height === resized.height
        ) {
          return;
        }

        const updated = {
          ...prev,
          [nodeId]: { ...resized, zIndex: current.zIndex },
        };

        nodesRef.current = updated;
        setNodes(updated);
      };

      let pendingMove: PointerEvent | null = null;
      let frameId: number | null = null;

      const flushPointerMove = () => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;

        const latestMove = pendingMove;
        pendingMove = null;

        if (latestMove) applyPointerMove(latestMove);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== activePointerId) return;
        pendingMove = moveEvent;

        if (frameId === null) {
          frameId = requestAnimationFrame(() => {
            frameId = null;
            const latestMove = pendingMove;
            pendingMove = null;

            if (latestMove) applyPointerMove(latestMove);
          });
        }
      };

      const finishResize = () => {
        setDraggingNodeId(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("pointerdown", handleMultiTouchAbort, true);
        window.removeEventListener("blur", handleAbort);
        replaceStoredCanvasNodes(activeSubMode, nodesRef.current);
      };

      const handlePointerUp = (endEvent: PointerEvent) => {
        if (endEvent.pointerId !== activePointerId) return;
        pendingMove = endEvent;
        flushPointerMove();
        finishResize();
      };

      const handlePointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== activePointerId) return;
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        pendingMove = null;
        finishResize();
      };

      const handleAbort = () => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        pendingMove = null;
        finishResize();
      };

      const handleMultiTouchAbort = (downEvent: PointerEvent) => {
        if (downEvent.pointerType === "touch" && downEvent.pointerId !== activePointerId) {
          handleAbort();
        }
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
      window.addEventListener("pointerdown", handleMultiTouchAbort, true);
      window.addEventListener("blur", handleAbort);
    },
    [activeSubMode, bringNodeToFront, isLocked, nodesRef, setNodes, snapToGrid, viewportRef],
  );

  const applyNodeSizePreset = React.useCallback(
    (nodeId: string, kind: "group" | "segment", preset: CanvasSizePreset, segCount = 2) => {
      const dims = getPresetDimensions(kind, activeSubMode, preset, segCount);
      const prev = nodesRef.current;
      const curr = prev[nodeId];

      if (!curr) return;

      const next = {
        ...prev,
        [nodeId]: {
          ...curr,
          width: dims.width,
          height: dims.height,
        },
      };

      nodesRef.current = next;
      setNodes(next);
      replaceStoredCanvasNodes(activeSubMode, next);
    },
    [activeSubMode, nodesRef, setNodes],
  );

  return {
    draggingNodeId,
    bringNodeToFront,
    startNodeDrag,
    startNodeResize,
    applyNodeSizePreset,
  };
}
