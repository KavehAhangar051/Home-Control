"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  buildDefaultCanvasNodes,
  canvasGroupNodeId,
  canvasSegmentNodeId,
  clampCanvasNodeSize,
  computeFitCanvasViewport,
  getCanvasGridStyle,
  getPresetDimensions,
  snapCanvasCoordinate,
} from "./canvasGeometry";
import {
  type CanvasWorkspaceScope,
  clearStoredCanvasMode,
  readStoredCanvasNodes,
  readStoredCanvasSettings,
  readStoredCanvasViewport,
  reconcileCanvasNodes,
  replaceStoredCanvasNodes,
  type StoredCanvasSettings,
  writeStoredCanvasSettings,
  writeStoredCanvasViewport,
} from "./canvasStorage";
import type {
  CanvasNodeRect,
  CanvasResizeDirection,
  CanvasSizePreset,
  CanvasSubMode,
  CanvasViewport,
  CanvasWireConnection,
} from "./canvasTypes";
import { computeDragTiltDeg } from "./nodeMotion";
import { useSheetViewportGestures } from "./useSheetViewportGestures";

export type { CanvasWorkspaceScope } from "./canvasStorage";

interface UseCanvasControllerProps {
  workspaceScope?: CanvasWorkspaceScope;
  groupsOrder: string[];
  segments: Segment[];
  pinsState: Record<string, boolean>;
  selectedGroupFilter: string | null;
}

export function useCanvasController({
  workspaceScope = "home",
  groupsOrder,
  segments,
  pinsState,
  selectedGroupFilter,
}: UseCanvasControllerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [settings, setSettings] = React.useState<StoredCanvasSettings>(() =>
    readStoredCanvasSettings(workspaceScope),
  );

  const settingsRef = React.useRef<StoredCanvasSettings>(settings);

  const activeSubMode: CanvasSubMode =
    workspaceScope === "workflows"
      ? "graph"
      : settings.subMode === "segments"
        ? "segments"
        : "groups";

  const [nodes, setNodes] = React.useState<Record<string, CanvasNodeRect>>(
    () => readStoredCanvasNodes(activeSubMode) ?? {},
  );

  const nodesRef = React.useRef<Record<string, CanvasNodeRect>>(nodes);

  const [viewport, setViewportState] = React.useState<CanvasViewport>(
    () => readStoredCanvasViewport(activeSubMode) ?? { x: 32, y: 24, zoom: 0.92 },
  );

  const viewportRef = React.useRef<CanvasViewport>(viewport);

  React.useEffect(() => {
    settingsRef.current = settings;
    nodesRef.current = nodes;
    viewportRef.current = viewport;
  }, [settings, nodes, viewport]);

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [dragTiltDeg, setDragTiltDeg] = React.useState(0);
  const hasInitialFitRef = React.useRef<boolean>(Boolean(readStoredCanvasViewport(activeSubMode)));
  const topZIndexRef = React.useRef(30);

  const setViewport = React.useCallback(
    (updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => {
      const next = updater instanceof Function ? updater(viewportRef.current) : updater;
      viewportRef.current = next;
      setViewportState(next);
      writeStoredCanvasViewport(activeSubMode, next);
    },
    [activeSubMode],
  );

  const {
    containerSize,
    isPanning,
    handleZoomBy,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  } = useSheetViewportGestures({
    containerRef,
    viewportRef,
    setViewport,
    onBackgroundClick: () => setSelectedNodeId(null),
    onPanEnd: (finalVp) => writeStoredCanvasViewport(activeSubMode, finalVp),
  });

  const updateSettings = React.useCallback(
    (patch: Partial<StoredCanvasSettings>) => {
      const prev = settingsRef.current;

      const next: StoredCanvasSettings = {
        ...prev,
        ...patch,
        subMode:
          workspaceScope === "workflows"
            ? "graph"
            : (patch.subMode ?? prev.subMode) === "segments"
              ? "segments"
              : "groups",
      };

      settingsRef.current = next;
      setSettings(next);
      writeStoredCanvasSettings(workspaceScope, next);
    },
    [workspaceScope],
  );

  // Reconcile stored nodes with current groupsOrder & segments without losing saved positions
  React.useEffect(() => {
    const stored = readStoredCanvasNodes(activeSubMode) ?? {};
    const isMobile = globalThis.window !== undefined && globalThis.window.innerWidth < 768;
    const defaults = buildDefaultCanvasNodes(activeSubMode, groupsOrder, segments, isMobile);

    const result = reconcileCanvasNodes({
      subMode: activeSubMode,
      defaults,
      storedNodes: stored,
      prevNodes: nodesRef.current,
      snapToGrid: settings.snapToGrid,
      baseTopZIndex: topZIndexRef.current,
      hasEntities: groupsOrder.length > 0 || segments.length > 0,
    });

    topZIndexRef.current = result.nextTopZIndex;
    nodesRef.current = result.nodes;
    setNodes(result.nodes);

    if (result.shouldPersist) {
      replaceStoredCanvasNodes(activeSubMode, result.nodes);
    }
  }, [activeSubMode, groupsOrder, segments, settings.snapToGrid]);

  const visibleGroups = React.useMemo(() => {
    if (!selectedGroupFilter) return groupsOrder;

    const filtered: string[] = [];

    for (const g of groupsOrder) {
      if (g === selectedGroupFilter) filtered.push(g);
    }

    return filtered;
  }, [groupsOrder, selectedGroupFilter]);

  const visibleSegments = React.useMemo(() => {
    if (!selectedGroupFilter) return segments;

    const filtered: Segment[] = [];

    for (const s of segments) {
      if (resolveSegmentGroup(s.group) === selectedGroupFilter) {
        filtered.push(s);
      }
    }

    return filtered;
  }, [segments, selectedGroupFilter]);

  const visibleNodeIds = React.useMemo(() => {
    const ids: string[] = [];

    if (activeSubMode === "graph" || activeSubMode === "groups") {
      for (const g of visibleGroups) {
        ids.push(canvasGroupNodeId(g));
      }
    }

    if (activeSubMode === "graph" || activeSubMode === "segments") {
      for (const s of visibleSegments) {
        ids.push(canvasSegmentNodeId(s.id));
      }
    }

    return ids;
  }, [activeSubMode, visibleGroups, visibleSegments]);

  const wireConnections = React.useMemo<CanvasWireConnection[]>(() => {
    if (activeSubMode !== "graph") return [];

    const list: CanvasWireConnection[] = [];

    for (const seg of visibleSegments) {
      const groupName = resolveSegmentGroup(seg.group);
      const sourceId = canvasGroupNodeId(groupName);
      const targetId = canvasSegmentNodeId(seg.id);

      list.push({
        id: `${sourceId}->${targetId}`,
        sourceId,
        targetId,
        groupName,
        segmentId: seg.id,
        isActive: seg.type !== "placeholder" && Boolean(seg.pin && pinsState[seg.pin]),
        isInput: seg.type === "input",
      });
    }

    return list;
  }, [activeSubMode, visibleSegments, pinsState]);

  const handleFitView = React.useCallback(() => {
    const el = containerRef.current;
    const w = el ? el.clientWidth : containerSize.width;
    const h = el ? el.clientHeight : containerSize.height;

    const nextViewport = computeFitCanvasViewport(
      nodesRef.current,
      visibleNodeIds,
      w,
      h,
      w < 640 ? 24 : 52,
    );

    setViewport(nextViewport);
  }, [visibleNodeIds, containerSize, setViewport]);

  // Fit view automatically ONLY if no stored viewport exists for this subMode yet
  React.useEffect(() => {
    if (visibleNodeIds.length === 0) return;

    const firstId = visibleNodeIds[0];

    if (!nodes[firstId]) return;

    if (!hasInitialFitRef.current) {
      hasInitialFitRef.current = true;
      handleFitView();
    }
  }, [nodes, visibleNodeIds, handleFitView]);

  const bringNodeToFront = React.useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const prev = nodesRef.current;
      const current = prev[nodeId];

      if (!current) return;

      const nextZ = ++topZIndexRef.current;

      if (current.zIndex === nextZ) return;

      const updated = {
        ...prev,
        [nodeId]: { ...current, zIndex: nextZ },
      };

      nodesRef.current = updated;
      setNodes(updated);
      replaceStoredCanvasNodes(activeSubMode, updated);
    },
    [activeSubMode],
  );

  /**
   * Starts dragging a Group or Segment node across the sheet and persists its final coordinates.
   */
  const startNodeDrag = React.useCallback(
    (nodeId: string, e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || settings.isLocked) return;

      e.stopPropagation();
      bringNodeToFront(nodeId);

      const startRect = nodesRef.current[nodeId];

      if (!startRect) return;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let lastClientX = e.clientX;
      const zoom = viewportRef.current.zoom;
      setDraggingNodeId(nodeId);
      setDragTiltDeg(0);
      const isGroupInGraph = activeSubMode === "graph" && nodeId.startsWith("group:");
      const groupName = isGroupInGraph ? nodeId.slice("group:".length) : null;

      const childInitialRects: Array<{ id: string; rect: CanvasNodeRect }> = [];

      if (groupName && settings.cascadeGroupDrag) {
        for (const seg of segments) {
          if (resolveSegmentGroup(seg.group) === groupName) {
            const childId = canvasSegmentNodeId(seg.id);
            const r = nodesRef.current[childId];

            if (r) {
              childInitialRects.push({ id: childId, rect: r });
            }
          }
        }
      }

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;
        const nextX = snapCanvasCoordinate(startRect.x + dx, settings.snapToGrid);
        const nextY = snapCanvasCoordinate(startRect.y + dy, settings.snapToGrid);
        const appliedDx = nextX - startRect.x;
        const appliedDy = nextY - startRect.y;

        setDragTiltDeg(computeDragTiltDeg(moveEvent.clientX - lastClientX));
        lastClientX = moveEvent.clientX;

        const prev = nodesRef.current;
        const current = prev[nodeId] ?? startRect;

        const updated = {
          ...prev,
          [nodeId]: {
            ...current,
            x: nextX,
            y: nextY,
          },
        };

        for (const child of childInitialRects) {
          const cCurr = prev[child.id] ?? child.rect;
          updated[child.id] = {
            ...cCurr,
            x: snapCanvasCoordinate(child.rect.x + appliedDx, settings.snapToGrid),
            y: snapCanvasCoordinate(child.rect.y + appliedDy, settings.snapToGrid),
          };
        }

        nodesRef.current = updated;
        setNodes(updated);
      };

      const handlePointerUp = () => {
        setDraggingNodeId(null);
        setDragTiltDeg(0);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        replaceStoredCanvasNodes(activeSubMode, nodesRef.current);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [
      settings.isLocked,
      settings.cascadeGroupDrag,
      settings.snapToGrid,
      activeSubMode,
      bringNodeToFront,
      segments,
    ],
  );

  /**
   * Starts resizing a Group or Segment node and persists its updated size & coordinates.
   */
  const startNodeResize = React.useCallback(
    (
      nodeId: string,
      kind: "group" | "segment",
      direction: CanvasResizeDirection,
      e: React.PointerEvent<HTMLElement>,
    ) => {
      if (e.button !== 0 || settings.isLocked) return;

      e.stopPropagation();
      e.preventDefault();
      bringNodeToFront(nodeId);

      const startRect = nodesRef.current[nodeId];

      if (!startRect) return;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const zoom = viewportRef.current.zoom;

      const snappedRightEdge = snapCanvasCoordinate(
        startRect.x + startRect.width,
        settings.snapToGrid,
      );

      const snappedBottomEdge = snapCanvasCoordinate(
        startRect.y + startRect.height,
        settings.snapToGrid,
      );

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;

        let rawWidth = startRect.width;
        let rawHeight = startRect.height;
        let rawX = startRect.x;
        let rawY = startRect.y;

        if (direction.includes("e")) {
          rawWidth = startRect.width + dx;
        }

        if (direction.includes("w")) {
          rawWidth = startRect.width - dx;
        }

        if (direction.includes("s")) {
          rawHeight = startRect.height + dy;
        }

        if (direction.includes("n")) {
          rawHeight = startRect.height - dy;
        }

        const clamped = clampCanvasNodeSize(
          kind,
          activeSubMode,
          rawWidth,
          rawHeight,
          settings.snapToGrid,
        );

        if (direction.includes("w")) {
          rawX = snappedRightEdge - clamped.width;
        }

        if (direction.includes("n")) {
          rawY = snappedBottomEdge - clamped.height;
        }

        const prev = nodesRef.current;
        const current = prev[nodeId] ?? startRect;

        const updated = {
          ...prev,
          [nodeId]: {
            ...current,
            x: snapCanvasCoordinate(rawX, settings.snapToGrid),
            y: snapCanvasCoordinate(rawY, settings.snapToGrid),
            width: clamped.width,
            height: clamped.height,
          },
        };

        nodesRef.current = updated;
        setNodes(updated);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        replaceStoredCanvasNodes(activeSubMode, nodesRef.current);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [settings.isLocked, settings.snapToGrid, activeSubMode, bringNodeToFront],
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
    [activeSubMode],
  );

  const handlePanToWorldPoint = React.useCallback(
    (worldX: number, worldY: number) => {
      setViewport((prev) => ({
        ...prev,
        x: Math.round(containerSize.width / 2 - worldX * prev.zoom),
        y: Math.round(containerSize.height / 2 - worldY * prev.zoom),
      }));
    },
    [containerSize, setViewport],
  );

  const handleResetLayout = React.useCallback(() => {
    clearStoredCanvasMode(activeSubMode);

    const isMobile = globalThis.window !== undefined && globalThis.window.innerWidth < 768;
    const fresh = buildDefaultCanvasNodes(activeSubMode, groupsOrder, segments, isMobile);
    nodesRef.current = fresh;
    setNodes(fresh);
    replaceStoredCanvasNodes(activeSubMode, fresh);

    const el = containerRef.current;
    const w = el ? el.clientWidth : containerSize.width;
    const h = el ? el.clientHeight : containerSize.height;
    setViewport(computeFitCanvasViewport(fresh, visibleNodeIds, w, h, w < 640 ? 24 : 52));
  }, [activeSubMode, groupsOrder, segments, containerSize, visibleNodeIds, setViewport]);

  const handleChangeSubMode = React.useCallback(
    (nextMode: CanvasSubMode) => {
      if (workspaceScope === "workflows") return;

      const resolvedMode: CanvasSubMode = nextMode === "segments" ? "segments" : "groups";
      const storedNodesForNext = readStoredCanvasNodes(resolvedMode) ?? {};
      const storedVpForNext = readStoredCanvasViewport(resolvedMode);

      setSelectedNodeId(null);
      nodesRef.current = storedNodesForNext;
      setNodes(storedNodesForNext);

      if (storedVpForNext) {
        hasInitialFitRef.current = true;
        setViewportState(storedVpForNext);
        viewportRef.current = storedVpForNext;
      } else {
        hasInitialFitRef.current = false;
      }

      updateSettings({ subMode: resolvedMode });
    },
    [workspaceScope, updateSettings],
  );

  const backgroundGridStyle = React.useMemo(
    () => getCanvasGridStyle(viewport.x, viewport.y, viewport.zoom),
    [viewport.x, viewport.y, viewport.zoom],
  );

  return {
    containerRef,
    containerSize,
    settings: {
      ...settings,
      subMode: activeSubMode,
    },
    updateSettings,
    nodes,
    viewport,
    setViewport,
    selectedNodeId,
    setSelectedNodeId,
    isPanning,
    draggingNodeId,
    dragTiltDeg,
    visibleGroups,
    visibleSegments,
    visibleNodeIds,
    wireConnections,
    bringNodeToFront,
    startNodeDrag,
    startNodeResize,
    applyNodeSizePreset,
    handleZoomBy,
    handleFitView,
    handlePanToWorldPoint,
    handleResetLayout,
    handleChangeSubMode,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
    backgroundGridStyle,
  };
}
