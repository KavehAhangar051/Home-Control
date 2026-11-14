"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import {
  buildDefaultCanvasNodes,
  canvasGroupNodeId,
  canvasSegmentNodeId,
  clampCanvasNodeSize,
  clampCanvasZoom,
  computeFitCanvasViewport,
  getCanvasGridStyle,
  getCanvasSettingsStorageKey,
  getCanvasStorageKey,
  getCanvasViewportStorageKey,
  getPresetDimensions,
  snapCanvasCoordinate,
  snapNodeRectToGrid,
} from "./canvasGeometry";
import { computeDragTiltDeg } from "./nodeMotion";
import type {
  CanvasNodeRect,
  CanvasResizeDirection,
  CanvasSizePreset,
  CanvasSubMode,
  CanvasViewport,
  CanvasWireConnection,
} from "./canvasTypes";

export type CanvasWorkspaceScope = "home" | "workflows";

interface StoredCanvasSettings {
  subMode: CanvasSubMode;
  snapToGrid: boolean;
  isLocked: boolean;
  cascadeGroupDrag: boolean;
}

interface CanvasDraggingState {
  nodeId: string;
  tiltDeg: number;
}

const memoryNodesCache = new Map<CanvasSubMode, Record<string, CanvasNodeRect>>();
const memoryViewportCache = new Map<CanvasSubMode, CanvasViewport>();

function readStoredSettings(scope: CanvasWorkspaceScope): StoredCanvasSettings {
  const defaultSubMode: CanvasSubMode = scope === "workflows" ? "graph" : "groups";

  if (typeof window === "undefined") {
    return {
      subMode: defaultSubMode,
      snapToGrid: true,
      isLocked: false,
      cascadeGroupDrag: true,
    };
  }

  try {
    const raw = window.localStorage.getItem(getCanvasSettingsStorageKey(scope));

    if (raw) {
      // SAFETY: JSON.parse output is validated field-by-field below
      const parsed = JSON.parse(raw) as Partial<StoredCanvasSettings>;
      const subMode: CanvasSubMode =
        scope === "workflows"
          ? "graph"
          : parsed.subMode === "segments" || parsed.subMode === "groups"
            ? parsed.subMode
            : "groups";

      return {
        subMode,
        snapToGrid: parsed.snapToGrid ?? true,
        isLocked: parsed.isLocked ?? false,
        cascadeGroupDrag: parsed.cascadeGroupDrag ?? true,
      };
    }
  } catch {
    // Ignore storage read errors
  }

  return {
    subMode: defaultSubMode,
    snapToGrid: true,
    isLocked: false,
    cascadeGroupDrag: true,
  };
}

function readStoredNodes(subMode: CanvasSubMode): Record<string, CanvasNodeRect> | null {
  const cached = memoryNodesCache.get(subMode);

  if (cached && Object.keys(cached).length > 0) {
    return cached;
  }

  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getCanvasStorageKey(subMode));

    if (!raw) return null;

    // SAFETY: localStorage payload is serialized from Record<string, CanvasNodeRect>
    const parsed = JSON.parse(raw) as Record<string, CanvasNodeRect>;

    if (parsed && !Array.isArray(parsed)) {
      memoryNodesCache.set(subMode, parsed);

      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }

  return null;
}

function writeStoredNodes(subMode: CanvasSubMode, nextNodes: Record<string, CanvasNodeRect>): void {
  const existing = readStoredNodes(subMode) ?? {};
  const merged = { ...existing, ...nextNodes };
  memoryNodesCache.set(subMode, merged);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getCanvasStorageKey(subMode), JSON.stringify(merged));
  } catch {
    // Ignore storage write errors
  }
}

function readStoredViewport(subMode: CanvasSubMode): CanvasViewport | null {
  const cached = memoryViewportCache.get(subMode);

  if (cached) return cached;

  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getCanvasViewportStorageKey(subMode));

    if (!raw) return null;

    // SAFETY: JSON.parse output is validated with Number.isFinite checks below
    const parsed = JSON.parse(raw) as Partial<CanvasViewport>;

    if (
      parsed.x !== undefined &&
      parsed.y !== undefined &&
      parsed.zoom !== undefined &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y) &&
      Number.isFinite(parsed.zoom)
    ) {
      const valid: CanvasViewport = {
        x: Math.round(parsed.x),
        y: Math.round(parsed.y),
        zoom: clampCanvasZoom(parsed.zoom),
      };
      memoryViewportCache.set(subMode, valid);

      return valid;
    }
  } catch {
    // Ignore storage read errors
  }

  return null;
}

function writeStoredViewport(subMode: CanvasSubMode, vp: CanvasViewport): void {
  memoryViewportCache.set(subMode, vp);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getCanvasViewportStorageKey(subMode), JSON.stringify(vp));
  } catch {
    // Ignore storage write errors
  }
}

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
  const [containerSize, setContainerSize] = React.useState({ width: 960, height: 600 });

  const [settings, setSettings] = React.useState<StoredCanvasSettings>(() =>
    readStoredSettings(workspaceScope),
  );

  const activeSubMode: CanvasSubMode =
    workspaceScope === "workflows"
      ? "graph"
      : settings.subMode === "segments"
        ? "segments"
        : "groups";

  const [nodes, setNodes] = React.useState<Record<string, CanvasNodeRect>>(
    () => readStoredNodes(activeSubMode) ?? {},
  );
  const nodesRef = React.useRef<Record<string, CanvasNodeRect>>(nodes);
  nodesRef.current = nodes;

  const [viewport, setViewportState] = React.useState<CanvasViewport>(
    () => readStoredViewport(activeSubMode) ?? { x: 32, y: 24, zoom: 0.92 },
  );
  const viewportRef = React.useRef<CanvasViewport>(viewport);
  viewportRef.current = viewport;

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [draggingState, setDraggingState] = React.useState<CanvasDraggingState | null>(null);
  const [isPanning, setIsPanning] = React.useState(false);
  const hasInitialFitRef = React.useRef<boolean>(Boolean(readStoredViewport(activeSubMode)));
  const topZIndexRef = React.useRef(30);

  const setViewport = React.useCallback(
    (updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => {
      setViewportState((prev) => {
        const next = updater instanceof Function ? updater(prev) : updater;
        viewportRef.current = next;
        writeStoredViewport(activeSubMode, next);

        return next;
      });
    },
    [activeSubMode],
  );

  const updateSettings = React.useCallback(
    (patch: Partial<StoredCanvasSettings>) => {
      setSettings((prev) => {
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

        try {
          window.localStorage.setItem(
            getCanvasSettingsStorageKey(workspaceScope),
            JSON.stringify(next),
          );
        } catch {
          // Ignore storage write failures
        }

        return next;
      });
    },
    [workspaceScope],
  );

  // Track container dimensions for fit-to-view
  React.useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const updateRect = () => {
      const rect = el.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // Reconcile stored nodes with current groupsOrder & segments without losing saved positions
  React.useEffect(() => {
    const stored = readStoredNodes(activeSubMode) ?? {};
    const isMobile = globalThis.window !== undefined && globalThis.window.innerWidth < 768;
    const defaults = buildDefaultCanvasNodes(activeSubMode, groupsOrder, segments, isMobile);

    setNodes((prev) => {
      const merged: Record<string, CanvasNodeRect> = {
        ...stored,
        ...prev,
      };
      let maxZ = topZIndexRef.current;
      let shouldPersist = false;

      for (const rect of Object.values(merged)) {
        if (rect && Number.isFinite(rect.zIndex)) {
          maxZ = Math.max(maxZ, rect.zIndex);
        }
      }

      for (const [id, defRect] of Object.entries(defaults)) {
        const existing = stored[id] ?? prev[id];

        if (existing) {
          const nodeKind = id.startsWith("group:") ? "group" : "segment";
          const resolved = settings.snapToGrid
            ? snapNodeRectToGrid(existing, nodeKind, activeSubMode)
            : existing;

          if (
            resolved.x !== existing.x ||
            resolved.y !== existing.y ||
            resolved.width !== existing.width ||
            resolved.height !== existing.height
          ) {
            shouldPersist = true;
          }

          merged[id] = resolved;
          maxZ = Math.max(maxZ, resolved.zIndex || 1);
        } else {
          merged[id] = defRect;
          maxZ = Math.max(maxZ, defRect.zIndex || 1);
          shouldPersist = true;
        }
      }

      topZIndexRef.current = maxZ + 1;
      nodesRef.current = merged;

      if (shouldPersist && (groupsOrder.length > 0 || segments.length > 0)) {
        writeStoredNodes(activeSubMode, merged);
      }

      return merged;
    });
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
      if ((s.group || "Test") === selectedGroupFilter) {
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
      const groupName = seg.group || "Test";
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
      setNodes((prev) => {
        const current = prev[nodeId];

        if (!current) return prev;

        const nextZ = ++topZIndexRef.current;

        if (current.zIndex === nextZ) return prev;

        const updated = {
          ...prev,
          [nodeId]: { ...current, zIndex: nextZ },
        };
        nodesRef.current = updated;
        writeStoredNodes(activeSubMode, updated);

        return updated;
      });
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
      let tiltResetTimer: number | null = null;
      const zoom = viewportRef.current.zoom;
      const isGroupInGraph = activeSubMode === "graph" && nodeId.startsWith("group:");
      const groupName = isGroupInGraph ? nodeId.slice("group:".length) : null;

      setDraggingState({ nodeId, tiltDeg: 0 });

      const childInitialRects: Array<{ id: string; rect: CanvasNodeRect }> = [];

      if (groupName && settings.cascadeGroupDrag) {
        for (const seg of segments) {
          if ((seg.group || "Test") === groupName) {
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

        const frameDeltaX = moveEvent.clientX - lastClientX;
        lastClientX = moveEvent.clientX;

        setDraggingState({
          nodeId,
          tiltDeg: computeDragTiltDeg(frameDeltaX, 2.2),
        });

        if (tiltResetTimer !== null) {
          globalThis.window?.clearTimeout(tiltResetTimer);
        }

        if (globalThis.window !== undefined) {
          tiltResetTimer = globalThis.window.setTimeout(() => {
            setDraggingState((prev) => (prev?.nodeId === nodeId ? { nodeId, tiltDeg: 0 } : prev));
          }, 90);
        }

        setNodes((prev) => {
          const current = prev[nodeId] ?? startRect;
          const updated: Record<string, CanvasNodeRect> = {
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
          writeStoredNodes(activeSubMode, updated);

          return updated;
        });
      };

      const handlePointerUp = () => {
        if (tiltResetTimer !== null) {
          globalThis.window?.clearTimeout(tiltResetTimer);
        }

        setDraggingState(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        writeStoredNodes(activeSubMode, nodesRef.current);
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

        setNodes((prev) => {
          const current = prev[nodeId] ?? startRect;
          const updated: Record<string, CanvasNodeRect> = {
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
          writeStoredNodes(activeSubMode, updated);

          return updated;
        });
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        writeStoredNodes(activeSubMode, nodesRef.current);
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
      setNodes((prev) => {
        const curr = prev[nodeId];

        if (!curr) return prev;

        const next = {
          ...prev,
          [nodeId]: {
            ...curr,
            width: dims.width,
            height: dims.height,
          },
        };
        nodesRef.current = next;
        writeStoredNodes(activeSubMode, next);

        return next;
      });
    },
    [activeSubMode],
  );

  const handleZoomBy = React.useCallback(
    (delta: number, focalClientX?: number, focalClientY?: number) => {
      setViewport((prev) => {
        const nextZoom = clampCanvasZoom(prev.zoom + delta);

        if (nextZoom === prev.zoom) return prev;

        const el = containerRef.current;
        const rect = el?.getBoundingClientRect();
        const anchorX =
          focalClientX !== undefined && rect ? focalClientX - rect.left : containerSize.width / 2;
        const anchorY =
          focalClientY !== undefined && rect ? focalClientY - rect.top : containerSize.height / 2;

        const worldX = (anchorX - prev.x) / prev.zoom;
        const worldY = (anchorY - prev.y) / prev.zoom;

        return {
          x: Math.round(anchorX - worldX * nextZoom),
          y: Math.round(anchorY - worldY * nextZoom),
          zoom: nextZoom,
        };
      });
    },
    [containerSize, setViewport],
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
    memoryNodesCache.delete(activeSubMode);
    memoryViewportCache.delete(activeSubMode);

    try {
      window.localStorage.removeItem(getCanvasStorageKey(activeSubMode));
      window.localStorage.removeItem(getCanvasViewportStorageKey(activeSubMode));
    } catch {
      // Ignore storage remove errors
    }

    const isMobile = window.innerWidth < 768;
    const fresh = buildDefaultCanvasNodes(activeSubMode, groupsOrder, segments, isMobile);
    nodesRef.current = fresh;
    setNodes(fresh);
    writeStoredNodes(activeSubMode, fresh);

    const el = containerRef.current;
    const w = el ? el.clientWidth : containerSize.width;
    const h = el ? el.clientHeight : containerSize.height;
    setViewport(computeFitCanvasViewport(fresh, visibleNodeIds, w, h, w < 640 ? 24 : 52));
  }, [activeSubMode, groupsOrder, segments, containerSize, visibleNodeIds, setViewport]);

  const handleChangeSubMode = React.useCallback(
    (nextMode: CanvasSubMode) => {
      if (workspaceScope === "workflows") return;

      const resolvedMode: CanvasSubMode = nextMode === "segments" ? "segments" : "groups";
      const storedNodesForNext = readStoredNodes(resolvedMode) ?? {};
      const storedVpForNext = readStoredViewport(resolvedMode);

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

  // Attach native non-passive wheel zoom and multi-touch pinch-to-zoom on sheet container
  React.useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // SAFETY: WheelEvent target in DOM is an Element/HTMLElement
      const target = e.target as HTMLElement | null;

      if (target?.closest("[data-canvas-scroll-area='true']") && !e.ctrlKey && !e.metaKey) {
        return;
      }

      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.1 : -0.1;
      handleZoomBy(zoomStep, e.clientX, e.clientY);
    };

    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchWorldX = 0;
    let pinchWorldY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        const curr = viewportRef.current;
        pinchStartZoom = curr.zoom;
        pinchWorldX = (midX - curr.x) / curr.zoom;
        pinchWorldY = (midY - curr.y) / curr.zoom;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist > 12) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const ratio = dist / pinchStartDist;
        const nextZoom = clampCanvasZoom(pinchStartZoom * ratio);
        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

        setViewport({
          x: Math.round(midX - pinchWorldX * nextZoom),
          y: Math.round(midY - pinchWorldY * nextZoom),
          zoom: nextZoom,
        });
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [handleZoomBy, setViewport]);

  const handleCanvasPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const isRightButton = e.button === 2;

      if (e.button !== 0 && e.button !== 1 && !isRightButton) return;

      // SAFETY: PointerEvent target in DOM is an HTMLElement
      const target = e.target as HTMLElement;

      if (target.closest("input, textarea, select, [contenteditable='true']")) return;

      if (!isRightButton && target.closest("[data-canvas-node='true']")) return;

      if (isRightButton) {
        e.preventDefault();
      } else {
        setSelectedNodeId(null);
      }

      setIsPanning(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const initialVpX = viewportRef.current.x;
      const initialVpY = viewportRef.current.y;

      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        setViewport((prev) => ({
          ...prev,
          x: Math.round(initialVpX + dx),
          y: Math.round(initialVpY + dy),
        }));
      };

      const onUp = () => {
        setIsPanning(false);
        writeStoredViewport(activeSubMode, viewportRef.current);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [activeSubMode, setViewport],
  );

  const handleCanvasContextMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    // SAFETY: MouseEvent target in DOM is an HTMLElement
    const target = e.target as HTMLElement | null;

    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

    e.preventDefault();
  }, []);

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
    draggingState,
    isPanning,
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
