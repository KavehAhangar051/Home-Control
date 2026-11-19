"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  buildDefaultCanvasNodes,
  canvasGroupNodeId,
  canvasSegmentNodeId,
  computeFitCanvasViewport,
  getCanvasGridStyle,
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
const MOBILE_BREAKPOINT = 768;
const FIT_MOBILE_BREAKPOINT = 640;
const FIT_MOBILE_PADDING = 24;
const FIT_DESKTOP_PADDING = 52;
const INITIAL_TOP_Z_INDEX = 30;

function resolveActiveSubMode(
  workspaceScope: CanvasWorkspaceScope,
  storedSubMode: CanvasSubMode | undefined,
): CanvasSubMode {
  if (workspaceScope === "workflows") return "graph";

  return storedSubMode === "segments" ? "segments" : "groups";
}

function isMobileWindowViewport(): boolean {
  return globalThis.window !== undefined && globalThis.window.innerWidth < MOBILE_BREAKPOINT;
}

interface ResolvedContainerDimensions {
  width: number;
  height: number;
  fitPadding: number;
}

function resolveContainerDimensions(
  element: HTMLDivElement | null,
  fallbackSize: { width: number; height: number },
): ResolvedContainerDimensions {
  const width = element ? element.clientWidth : fallbackSize.width;
  const height = element ? element.clientHeight : fallbackSize.height;
  const fitPadding = width < FIT_MOBILE_BREAKPOINT ? FIT_MOBILE_PADDING : FIT_DESKTOP_PADDING;

  return { width, height, fitPadding };
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
      viewportRef.current = next;
      setViewportState(next);
      writeStoredCanvasViewport(activeSubMode, next);
    },
    [activeSubMode],
  );

  const setViewportTransient = React.useCallback(
    (updater: CanvasViewport | ((prev: CanvasViewport) => CanvasViewport)) => {
      const next = updater instanceof Function ? updater(viewportRef.current) : updater;
      viewportRef.current = next;
      setViewportState(next);
    },
    [],
  );

  const {
    containerSize,
    isPanning,
    animateToViewport,
    handleZoomBy,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  } = useSheetViewportGestures({
    containerRef,
    viewportRef,
    setViewport,
    setViewportTransient,
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
      isMobileWindowViewport(),
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
        pin: seg.type === "placeholder" ? "" : seg.pin,
        isInput: seg.type === "input",
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
      isMobileWindowViewport(),
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
