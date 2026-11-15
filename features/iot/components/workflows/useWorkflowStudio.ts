"use client";

import React from "react";
import { useSheetViewportGestures } from "@/features/iot/components/canvas/useSheetViewportGestures";
import type { Segment } from "@/features/iot/hooks/store/types";
import { type ConnectingWireDraft, useWorkflowInteractions } from "./useWorkflowInteractions";
import { useWorkflowRuntime } from "./useWorkflowRuntime";
import {
  computeFitWorkflowViewport,
  createEmptyWorkflow,
  createWorkflowNode,
  getWorkflowGridStyle,
  normalizeWorkflowNodeLabel,
  readStoredWorkflowState,
  snapWorkflowNodeToGrid,
  writeStoredWorkflowState,
} from "./workflowEngine";
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowPaletteDragPayload,
  WorkflowStudioState,
  WorkflowViewport,
} from "./workflowTypes";

export type { ConnectingWireDraft };

interface UseWorkflowStudioOptions {
  segments: Segment[];
  pinsState: Record<string, boolean>;
  onSetPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
  showToast?: (msg: string, type: "success" | "error") => void;
}

export function useWorkflowStudio({
  segments,
  pinsState,
  onSetPinState,
  showToast,
}: UseWorkflowStudioOptions) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [studioState, setStudioState] = React.useState<WorkflowStudioState>(() =>
    readStoredWorkflowState(),
  );

  const studioRef = React.useRef(studioState);
  studioRef.current = studioState;

  const [isPaletteOpen, setIsPaletteOpen] = React.useState(() =>
    globalThis.window !== undefined ? globalThis.window.innerWidth >= 768 : true,
  );

  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [isLocked, setIsLocked] = React.useState(false);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | null>(null);

  const didMountStorageRef = React.useRef(false);

  React.useEffect(() => {
    if (!didMountStorageRef.current) {
      didMountStorageRef.current = true;

      return;
    }

    writeStoredWorkflowState(studioState);
  }, [studioState]);

  const persistState = React.useCallback(
    (updater: (prev: WorkflowStudioState) => WorkflowStudioState) => {
      setStudioState((prev) => {
        const next = updater(prev);
        studioRef.current = next;

        return next;
      });
    },
    [],
  );

  const activeWorkflow = React.useMemo<WorkflowDefinition | null>(() => {
    if (studioState.workflows.length === 0) return null;

    return (
      studioState.workflows.find((w) => w.id === studioState.activeWorkflowId) ??
      studioState.workflows[0] ??
      null
    );
  }, [studioState.workflows, studioState.activeWorkflowId]);

  const activeWorkflowRef = React.useRef(activeWorkflow);
  activeWorkflowRef.current = activeWorkflow;

  const viewportRef = React.useRef<WorkflowViewport>(
    activeWorkflow?.viewport ?? { x: 48, y: 48, zoom: 1 },
  );

  viewportRef.current = activeWorkflow?.viewport ?? { x: 48, y: 48, zoom: 1 };

  const updateActiveWorkflow = React.useCallback(
    (updater: (wf: WorkflowDefinition) => WorkflowDefinition) => {
      persistState((prev) => {
        const targetId = prev.activeWorkflowId ?? prev.workflows[0]?.id;

        if (!targetId) return prev;

        const nextWorkflows: WorkflowDefinition[] = [];

        for (const wf of prev.workflows) {
          if (wf.id === targetId) {
            nextWorkflows.push({
              ...updater(wf),
              updatedAt: Date.now(),
            });
          } else {
            nextWorkflows.push(wf);
          }
        }

        return {
          ...prev,
          workflows: nextWorkflows,
        };
      });
    },
    [persistState],
  );

  const setViewport = React.useCallback(
    (updater: WorkflowViewport | ((prev: WorkflowViewport) => WorkflowViewport)) => {
      updateActiveWorkflow((wf) => {
        const nextVp = updater instanceof Function ? updater(wf.viewport) : updater;
        viewportRef.current = nextVp;

        return {
          ...wf,
          viewport: nextVp,
        };
      });
    },
    [updateActiveWorkflow],
  );

  // Align any legacy/off-grid workflow nodes onto the 16px lattice and normalize legacy gate labels
  React.useEffect(() => {
    if (!activeWorkflow) return;

    let hasChanges = false;
    const normalizedNodes: WorkflowNode[] = [];

    for (const n of activeWorkflow.nodes) {
      const snapped = snapToGrid ? snapWorkflowNodeToGrid(n) : n;
      const nextLabel = normalizeWorkflowNodeLabel(snapped);

      if (
        snapped.x !== n.x ||
        snapped.y !== n.y ||
        snapped.width !== n.width ||
        snapped.height !== n.height ||
        nextLabel !== n.label
      ) {
        hasChanges = true;
      }

      normalizedNodes.push(
        nextLabel !== snapped.label ? { ...snapped, label: nextLabel } : snapped,
      );
    }

    if (!hasChanges) return;

    updateActiveWorkflow((wf) => ({
      ...wf,
      nodes: normalizedNodes,
    }));
  }, [snapToGrid, activeWorkflow, updateActiveWorkflow]);

  const handleUpdateNode = React.useCallback(
    (nodeId: string, patch: Partial<WorkflowNode>) => {
      updateActiveWorkflow((wf) => {
        const nextNodes: WorkflowNode[] = [];

        for (const n of wf.nodes) {
          nextNodes.push(n.id === nodeId ? { ...n, ...patch } : n);
        }

        return { ...wf, nodes: nextNodes };
      });
    },
    [updateActiveWorkflow],
  );

  const {
    draggingNodeId,
    dragTiltDeg,
    connectingFromId,
    setConnectingFromId,
    connectingDraft,
    bringNodeToFront,
    startNodeDrag,
    startNodeResize,
    handleStartPortConnect,
    handleCompletePortConnect,
  } = useWorkflowInteractions({
    containerRef,
    activeWorkflow,
    activeWorkflowRef,
    isLocked,
    snapToGrid,
    updateActiveWorkflow,
    handleUpdateNode,
    setSelectedNodeId,
    setSelectedEdgeId,
    showToast,
  });

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
    onBackgroundClick: () => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingFromId(null);
    },
  });

  const { evaluation, timerCountdowns, handleTriggerManualPulse, handleRunTest } =
    useWorkflowRuntime({
      activeWorkflow,
      segments,
      pinsState,
      onSetPinState,
      showToast,
    });

  const handleStartDesigningFirstWorkflow = React.useCallback(() => {
    const first = createEmptyWorkflow("گردش کار ۱");
    persistState(() => ({
      workflows: [first],
      activeWorkflowId: first.id,
    }));
    setIsPaletteOpen(true);
  }, [persistState]);

  const handleCreateWorkflow = React.useCallback(() => {
    persistState((prev) => {
      const next = createEmptyWorkflow(`گردش کار ${prev.workflows.length + 1}`);

      return {
        workflows: [...prev.workflows, next],
        activeWorkflowId: next.id,
      };
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [persistState]);

  const handleSelectWorkflow = React.useCallback(
    (id: string) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingFromId(null);
      persistState((prev) => ({
        ...prev,
        activeWorkflowId: id,
      }));
    },
    [persistState, setConnectingFromId],
  );

  const handleRenameWorkflow = React.useCallback(
    (id: string, name: string) => {
      persistState((prev) => {
        const nextList: WorkflowDefinition[] = [];

        for (const wf of prev.workflows) {
          nextList.push(wf.id === id ? { ...wf, name, updatedAt: Date.now() } : wf);
        }

        return { ...prev, workflows: nextList };
      });
    },
    [persistState],
  );

  const handleDeleteWorkflow = React.useCallback(
    (id: string) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingFromId(null);
      persistState((prev) => {
        const remaining: WorkflowDefinition[] = [];

        for (const wf of prev.workflows) {
          if (wf.id !== id) remaining.push(wf);
        }

        return {
          workflows: remaining,
          activeWorkflowId: remaining[0]?.id ?? null,
        };
      });
    },
    [persistState, setConnectingFromId],
  );

  const handleToggleEnabled = React.useCallback(
    (id: string, enabled: boolean) => {
      persistState((prev) => {
        const nextList: WorkflowDefinition[] = [];

        for (const wf of prev.workflows) {
          nextList.push(wf.id === id ? { ...wf, enabled, updatedAt: Date.now() } : wf);
        }

        return { ...prev, workflows: nextList };
      });
    },
    [persistState],
  );

  const handleAddNode = React.useCallback(
    (payload: WorkflowPaletteDragPayload, dropWorldX?: number, dropWorldY?: number) => {
      if (!activeWorkflow) return;

      const vp = activeWorkflow.viewport;
      const offset = (activeWorkflow.nodes.length % 5) * 32;
      const fallbackWorldX = Math.round((containerSize.width / 2 - vp.x) / vp.zoom) - 112 + offset;
      const fallbackWorldY = Math.round((containerSize.height / 2 - vp.y) / vp.zoom) - 80 + offset;

      let maxZ = 1;

      for (const n of activeWorkflow.nodes) {
        maxZ = Math.max(maxZ, n.zIndex + 1);
      }

      const newNode = createWorkflowNode({
        payload,
        x: dropWorldX ?? fallbackWorldX,
        y: dropWorldY ?? fallbackWorldY,
        zIndex: maxZ,
        segments,
        snapToGrid,
      });

      updateActiveWorkflow((wf) => ({
        ...wf,
        nodes: [...wf.nodes, newNode],
      }));
      setSelectedNodeId(newNode.id);

      if (globalThis.window !== undefined && globalThis.window.innerWidth < 768) {
        setIsPaletteOpen(false);
      }
    },
    [activeWorkflow, containerSize, segments, snapToGrid, updateActiveWorkflow],
  );

  const handleDeleteNode = React.useCallback(
    (nodeId: string) => {
      updateActiveWorkflow((wf) => {
        const nextNodes: WorkflowNode[] = [];

        for (const n of wf.nodes) {
          if (n.id !== nodeId) nextNodes.push(n);
        }

        const nextEdges: WorkflowEdge[] = [];

        for (const edge of wf.edges) {
          if (edge.sourceId !== nodeId && edge.targetId !== nodeId) {
            nextEdges.push(edge);
          }
        }

        return { ...wf, nodes: nextNodes, edges: nextEdges };
      });

      if (selectedNodeId === nodeId) setSelectedNodeId(null);

      if (connectingFromId === nodeId) setConnectingFromId(null);
    },
    [connectingFromId, selectedNodeId, setConnectingFromId, updateActiveWorkflow],
  );

  const handleDeleteEdge = React.useCallback(
    (edgeId: string) => {
      updateActiveWorkflow((wf) => {
        const nextEdges: WorkflowEdge[] = [];

        for (const edge of wf.edges) {
          if (edge.id !== edgeId) nextEdges.push(edge);
        }

        return { ...wf, edges: nextEdges };
      });
      setSelectedEdgeId(null);
    },
    [updateActiveWorkflow],
  );

  const handleFitView = React.useCallback(() => {
    if (!activeWorkflow) return;

    const el = containerRef.current;
    const w = el ? el.clientWidth : containerSize.width;
    const h = el ? el.clientHeight : containerSize.height;
    setViewport(computeFitWorkflowViewport(activeWorkflow.nodes, w, h));
  }, [activeWorkflow, containerSize.height, containerSize.width, setViewport]);

  const backgroundGridStyle = React.useMemo(() => {
    const vp = activeWorkflow?.viewport ?? { x: 0, y: 0, zoom: 1 };

    return getWorkflowGridStyle(vp.x, vp.y, vp.zoom);
  }, [activeWorkflow?.viewport]);

  return {
    containerRef,
    workflows: studioState.workflows,
    activeWorkflow,
    isPaletteOpen,
    setIsPaletteOpen,
    snapToGrid,
    setSnapToGrid,
    isLocked,
    setIsLocked,
    selectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    isPanning,
    draggingNodeId,
    dragTiltDeg,
    connectingFromId,
    setConnectingFromId,
    connectingDraft,
    evaluation,
    timerCountdowns,
    backgroundGridStyle,
    handleStartDesigningFirstWorkflow,
    handleCreateWorkflow,
    handleSelectWorkflow,
    handleRenameWorkflow,
    handleDeleteWorkflow,
    handleToggleEnabled,
    handleAddNode,
    handleUpdateNode,
    handleDeleteNode,
    handleDeleteEdge,
    handleStartPortConnect,
    handleCompletePortConnect,
    handleTriggerManualPulse,
    handleRunTest,
    bringNodeToFront,
    startNodeDrag,
    startNodeResize,
    handleZoomBy,
    handleFitView,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  };
}
