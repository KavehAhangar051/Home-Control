"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import { isReadOnlyInputSegment } from "@/features/iot/utils/analogInput";
import {
  buildDefaultCanvasNodes,
  type CanvasViewportInsets,
  type CanvasViewportTier,
  canvasGroupNodeId,
  canvasSegmentNodeId,
  computeFitCanvasViewport,
  resolveCanvasViewportTier,
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
  CanvasSubMode,
  CanvasViewport,
  CanvasWireConnection,
} from "./canvasTypes";
import { useCanvasNodeInteractions } from "./useCanvasNodeInteractions";
import { useSheetViewportGestures } from "./useSheetViewportGestures";

export type { CanvasWorkspaceScope } from "./canvasStorage";

const DEFAULT_HOME_VIEWPORT: CanvasViewport = { x: 32, y: 24, zoom: 0.92 };
const MOBILE_CHROME_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;
const FIT_TABLET_PADDING = 36;
const FIT_DESKTOP_PADDING = 52;
const INITIAL_TOP_Z_INDEX = 30;
const MOBILE_FIT_INSETS: CanvasViewportInsets = { top: 60, right: 16, bottom: 96, left: 16 };

function resolveActiveSubMode(
  workspaceScope: CanvasWorkspaceScope,
  storedSubMode: CanvasSubMode | undefined,
): CanvasSubMode {
  if (workspaceScope === "workflows") return "graph";

  return storedSubMode === "segments" ? "segments" : "groups";
}

function resolveWindowViewportTier(): CanvasViewportTier {
  if (globalThis.window === undefined) return "desktop";

  return resolveCanvasViewportTier(globalThis.window.innerWidth);
}

interface ResolvedContainerDimensions {
  width: number;
  height: number;
  fitPadding: number | Partial<CanvasViewportInsets>;
}

function resolveContainerDimensions(
  element: HTMLDivElement | null,
  fallbackSize: { width: number; height: number },
): ResolvedContainerDimensions {
  const width = element ? element.clientWidth : fallbackSize.width;
  const height = element ? element.clientHeight : fallbackSize.height;
  const windowWidth = globalThis.window !== undefined ? globalThis.window.innerWidth : width;

  if (windowWidth < MOBILE_CHROME_BREAKPOINT) {
    return { width, height, fitPadding: MOBILE_FIT_INSETS };
  }

  const fitPadding = width < TABLET_BREAKPOINT ? FIT_TABLET_PADDING : FIT_DESKTOP_PADDING;

  return { width, height, fitPadding };
}

function areCanvasNodeRectsEqual(
  left: Record<string, CanvasNodeRect>,
  right: Record<string, CanvasNodeRect>,
): boolean {
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);

  if (leftIds.length !== rightIds.length) return false;

  for (let i = 0; i < leftIds.length; i++) {
    const id = leftIds[i];
    const a = left[id];
    const b = right[id];

    if (
      !b ||
      a.x !== b.x ||
      a.y !== b.y ||
      a.width !== b.width ||
      a.height !== b.height ||
      a.zIndex !== b.zIndex
    ) {
      return false;
    }
  }

  return true;
}

interface UseCanvasControllerProps {
  workspaceScope?: CanvasWorkspaceScope;
  groupsOrder: string[];
  segments: Segment[];
  selectedGroupFilter: string | null;
}

export function useCanvasController({
  workspaceScope = "home",
  groupsOrder,
  segments,
  selectedGroupFilter,
}: UseCanvasControllerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [settings, setSettings] = React.useState<StoredCanvasSettings>(() =>
    readStoredCanvasSettings(workspaceScope),
  );

  const settingsRef = React.useRef<StoredCanvasSettings>(settings);
  const activeSubMode = resolveActiveSubMode(workspaceScope, settings.subMode);

  const [nodes, setNodes] = React.useState<Record<string, CanvasNodeRect>>(
    () => readStoredCanvasNodes(activeSubMode) ?? {},
  );

  const nodesRef = React.useRef<Record<string, CanvasNodeRect>>(nodes);

  const [viewport, setViewportState] = React.useState<CanvasViewport>(
    () => readStoredCanvasViewport(activeSubMode) ?? DEFAULT_HOME_VIEWPORT,
  );

  const viewportRef = React.useRef<CanvasViewport>(viewport);

  React.useEffect(() => {
    settingsRef.current = settings;
    nodesRef.current = nodes;
    viewportRef.current = viewport;
  }, [settings, nodes, viewport]);

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const hasInitialFitRef = React.useRef<boolean>(Boolean(readStoredCanvasViewport(activeSubMode)));
  const topZIndexRef = React.useRef(INITIAL_TOP_Z_INDEX);

  const setViewport = React.useCallback(
    (updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => {
      const next = updater instanceof Function ? updater(viewportRef.current) : updater;
      const current = viewportRef.current;
      if (current.x === next.x && current.y === next.y && current.zoom === next.zoom) {
        writeStoredCanvasViewport(activeSubMode, next);
        return;
      }

      viewportRef.current = next;
      setViewportState(next);
      writeStoredCanvasViewport(activeSubMode, next);
    },
    [activeSubMode],
  );

  const setViewportTransient = React.useCallback(
    (updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => {
      const next = updater instanceof Function ? updater(viewportRef.current) : updater;
      const current = viewportRef.current;
      if (current.x === next.x && current.y === next.y && current.zoom === next.zoom) return;

      viewportRef.current = next;
      setViewportState(next);
    },
    [],
  );

  const {
    worldPlaneRef,
    gridLayerRef,
    initialGridStyle,
    containerSize,
    isPanning,
    animateToViewport,
    syncViewportToDom,
    handleZoomBy,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  } = useSheetViewportGestures({
    containerRef,
    viewportRef,
    setViewport,
    setViewportTransient,
    isLocked: settings.isLocked,
    onBackgroundClick: () => setSelectedNodeId(null),
    onPanEnd: (finalVp) => writeStoredCanvasViewport(activeSubMode, finalVp),
  });

  const updateSettings = React.useCallback(
    (patch: Partial<StoredCanvasSettings>) => {
      const prev = settingsRef.current;

      const next: StoredCanvasSettings = {
        ...prev,
        ...patch,
        subMode: resolveActiveSubMode(workspaceScope, patch.subMode ?? prev.subMode),
      };

      if (
        prev.subMode === next.subMode &&
        prev.snapToGrid === next.snapToGrid &&
        prev.isLocked === next.isLocked &&
        prev.cascadeGroupDrag === next.cascadeGroupDrag
      ) {
        return;
      }

      settingsRef.current = next;
      setSettings(next);
      writeStoredCanvasSettings(workspaceScope, next);
    },
    [workspaceScope],
  );

  // Reconcile stored nodes with current groupsOrder & segments without losing saved positions
  React.useEffect(() => {
    const stored = readStoredCanvasNodes(activeSubMode) ?? {};

    const defaults = buildDefaultCanvasNodes(
      activeSubMode,
      groupsOrder,
      segments,
      resolveWindowViewportTier(),
    );

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
    if (!areCanvasNodeRectsEqual(nodesRef.current, result.nodes)) {
      nodesRef.current = result.nodes;
      setNodes(result.nodes);
    }

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
        pin: seg.type === "placeholder" ? "" : seg.pin,
        isInput: isReadOnlyInputSegment(seg),
      });
    }

    return list;
  }, [activeSubMode, visibleSegments]);

  const handleFitView = React.useCallback(() => {
    const { width, height, fitPadding } = resolveContainerDimensions(
      containerRef.current,
      containerSize,
    );

    const nextViewport = computeFitCanvasViewport(
      nodesRef.current,
      visibleNodeIds,
      width,
      height,
      fitPadding,
    );

    animateToViewport(nextViewport);
  }, [animateToViewport, visibleNodeIds, containerSize]);

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

  const { draggingNodeId, bringNodeToFront, startNodeDrag, startNodeResize, applyNodeSizePreset } =
    useCanvasNodeInteractions({
      activeSubMode,
      isLocked: settings.isLocked,
      snapToGrid: settings.snapToGrid,
      cascadeGroupDrag: settings.cascadeGroupDrag,
      segments,
      nodesRef,
      viewportRef,
      topZIndexRef,
      setNodes,
      setSelectedNodeId,
    });

  const handlePanToWorldPoint = React.useCallback(
    (worldX: number, worldY: number) => {
      const curr = viewportRef.current;
      animateToViewport({
        ...curr,
        x: Math.round(containerSize.width / 2 - worldX * curr.zoom),
        y: Math.round(containerSize.height / 2 - worldY * curr.zoom),
      });
    },
    [animateToViewport, containerSize],
  );

  const handleResetLayout = React.useCallback(() => {
    clearStoredCanvasMode(activeSubMode);

    const fresh = buildDefaultCanvasNodes(
      activeSubMode,
      groupsOrder,
      segments,
      resolveWindowViewportTier(),
    );

    nodesRef.current = fresh;
    setNodes(fresh);
    replaceStoredCanvasNodes(activeSubMode, fresh);

    const { width, height, fitPadding } = resolveContainerDimensions(
      containerRef.current,
      containerSize,
    );

    animateToViewport(computeFitCanvasViewport(fresh, visibleNodeIds, width, height, fitPadding));
  }, [activeSubMode, animateToViewport, groupsOrder, segments, containerSize, visibleNodeIds]);

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
        syncViewportToDom(storedVpForNext);
      } else {
        hasInitialFitRef.current = false;
      }

      updateSettings({ subMode: resolvedMode });
    },
    [workspaceScope, updateSettings, syncViewportToDom],
  );

  return {
    containerRef,
    worldPlaneRef,
    gridLayerRef,
    initialGridStyle,
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
  };
}
