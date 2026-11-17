"use client";

import React from "react";
import { useSheetViewportGestures } from "@/features/iot/components/canvas/useSheetViewportGestures";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useMediaQuery } from "@/features/iot/hooks/useMediaQuery";
import { type ConnectingWireDraft, useWorkflowInteractions } from "./useWorkflowInteractions";
import { useWorkflowRuntime } from "./useWorkflowRuntime";
import {
  computeFitWorkflowViewport,
  createEmptyWorkflow,
  createWorkflowNode,
  DEFAULT_WORKFLOW_VIEWPORT,
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

function patchWorkflowById(
  workflows: ReadonlyArray<WorkflowDefinition>,
  targetId: string,
  updater: (wf: WorkflowDefinition) => WorkflowDefinition,
): WorkflowDefinition[] {
  const nextWorkflows: WorkflowDefinition[] = [];

  for (let i = 0; i < workflows.length; i++) {
    const wf = workflows[i];

    if (wf.id === targetId) {
      nextWorkflows.push({
        ...updater(wf),
        updatedAt: Date.now(),
      });
    } else {
      nextWorkflows.push(wf);
    }
  }

  return nextWorkflows;
}

function normalizeWorkflowNodesList(
  nodes: WorkflowNode[],
  shouldSnap: boolean,
): { nodes: WorkflowNode[]; changed: boolean } {
  let changed = false;
  const normalizedNodes: WorkflowNode[] = [];

  for (const n of nodes) {
    const snapped = shouldSnap ? snapWorkflowNodeToGrid(n) : n;
    const nextLabel = normalizeWorkflowNodeLabel(snapped);

    if (
      snapped.x !== n.x ||
      snapped.y !== n.y ||
      snapped.width !== n.width ||
      snapped.height !== n.height ||
      nextLabel !== n.label
    ) {
      changed = true;
    }

    normalizedNodes.push(nextLabel !== snapped.label ? { ...snapped, label: nextLabel } : snapped);
  }

  return { nodes: normalizedNodes, changed };
}

function normalizeStoredStudioState(state: WorkflowStudioState): WorkflowStudioState {
  let anyChanged = false;
  const workflows = state.workflows.map((wf) => {
    const { nodes, changed } = normalizeWorkflowNodesList(wf.nodes, true);
    if (!changed) return wf;
    anyChanged = true;

    return { ...wf, nodes };
  });

  return anyChanged ? { ...state, workflows } : state;
}

interface UseWorkflowStudioOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  segments: Segment[];
  pinsState: Record<string, boolean>;
  onSetPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
  showToast?: (msg: string, type: "success" | "error") => void;
}

export function useWorkflowStudio({
  containerRef,
  segments,
  pinsState,
  onSetPinState,
  showToast,
}: UseWorkflowStudioOptions) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [studioState, setStudioState] = React.useState<WorkflowStudioState>(() =>
    normalizeStoredStudioState(readStoredWorkflowState()),
  );

  const [paletteOverride, setPaletteOverride] = React.useState<boolean | null>(null);
  const isPaletteOpen = paletteOverride ?? isDesktop;

  const setIsPaletteOpen = React.useCallback(
    (value: React.SetStateAction<boolean>) => {
      setPaletteOverride((prev) => {
        const current = prev ?? isDesktop;

        return typeof value === "function" ? value(current) : value;
      });
    },
    [isDesktop],
  );

  const [snapToGrid, setSnapToGridState] = React.useState(true);
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

  const activeWorkflow = React.useMemo<WorkflowDefinition | null>(() => {
    if (studioState.workflows.length === 0) return null;

    return (
      studioState.workflows.find((w) => w.id === studioState.activeWorkflowId) ??
      studioState.workflows[0] ??
      null
    );
  }, [studioState.workflows, studioState.activeWorkflowId]);

  const activeWorkflowRef = React.useRef(activeWorkflow);
  const viewportRef = React.useRef<WorkflowViewport>(
    activeWorkflow?.viewport ?? DEFAULT_WORKFLOW_VIEWPORT,
  );

  React.useEffect(() => {
    activeWorkflowRef.current = activeWorkflow;
    viewportRef.current = activeWorkflow?.viewport ?? DEFAULT_WORKFLOW_VIEWPORT;
  }, [activeWorkflow]);

  const updateActiveWorkflow = React.useCallback(
    (updater: (wf: WorkflowDefinition) => WorkflowDefinition) => {
      setStudioState((prev) => {
        const targetId = prev.activeWorkflowId ?? prev.workflows[0]?.id;

        if (!targetId) return prev;

        return {
          ...prev,
          workflows: patchWorkflowById(prev.workflows, targetId, updater),
        };
      });
    },
    [],
  );

  const setViewport = React.useCallback(
    (updater: WorkflowViewport | ((prev: WorkflowViewport) => WorkflowViewport)) => {
      updateActiveWorkflow((wf) => ({
        ...wf,
        viewport: updater instanceof Function ? updater(wf.viewport) : updater,
      }));
    },
    [updateActiveWorkflow],
  );

  const setSnapToGrid = React.useCallback(
    (nextSnap: boolean) => {
      setSnapToGridState(nextSnap);

      if (!nextSnap) return;

      updateActiveWorkflow((wf) => {
        const { nodes, changed } = normalizeWorkflowNodesList(wf.nodes, true);

        return changed ? { ...wf, nodes } : wf;
      });
    },
    [updateActiveWorkflow],
  );

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
    setViewportTransient: setViewport,
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
      dispatchPinState: onSetPinState,
      showToast,
    });

  const handleStartDesigningFirstWorkflow = React.useCallback(() => {
    const first = createEmptyWorkflow("گردش کار ۱");
    setStudioState({
      workflows: [first],
      activeWorkflowId: first.id,
    });
    setPaletteOverride(true);
  }, []);

  const handleCreateWorkflow = React.useCallback(() => {
    setStudioState((prev) => {
      const next = createEmptyWorkflow(`گردش کار ${prev.workflows.length + 1}`);

      return {
        workflows: [...prev.workflows, next],
        activeWorkflowId: next.id,
      };
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleSelectWorkflow = React.useCallback(
    (id: string) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingFromId(null);
      setStudioState((prev) => ({
        ...prev,
        activeWorkflowId: id,
      }));
    },
    [setConnectingFromId],
  );

  const handleRenameWorkflow = React.useCallback((id: string, name: string) => {
    setStudioState((prev) => ({
      ...prev,
      workflows: patchWorkflowById(prev.workflows, id, (wf) => ({ ...wf, name })),
    }));
  }, []);

  const handleDeleteWorkflow = React.useCallback(
    (id: string) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingFromId(null);
      setStudioState((prev) => {
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
    [setConnectingFromId],
  );

  const handleToggleEnabled = React.useCallback((id: string, enabled: boolean) => {
    setStudioState((prev) => ({
      ...prev,
      workflows: patchWorkflowById(prev.workflows, id, (wf) => ({ ...wf, enabled })),
    }));
  }, []);

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

      if (!isDesktop) {
        setPaletteOverride(false);
      }
    },
    [activeWorkflow, containerSize, isDesktop, segments, snapToGrid, updateActiveWorkflow],
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
  }, [activeWorkflow, containerRef, containerSize.height, containerSize.width, setViewport]);

  const backgroundGridStyle = React.useMemo(() => {
    const vp = activeWorkflow?.viewport ?? { x: 0, y: 0, zoom: 1 };

    return getWorkflowGridStyle(vp.x, vp.y, vp.zoom);
  }, [activeWorkflow?.viewport]);

  return {
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
