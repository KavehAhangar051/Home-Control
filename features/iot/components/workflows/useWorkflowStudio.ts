"use client";

import React from "react";
import {
  clampCanvasZoom,
  snapCanvasCoordinate,
} from "@/features/iot/components/canvas/canvasGeometry";
import {
  computeDragTiltDeg,
  findMagneticInputPort,
} from "@/features/iot/components/canvas/nodeMotion";
import type { Segment } from "@/features/iot/hooks/store/types";
import {
  canConnectWorkflowPorts,
  clampWorkflowNodeSize,
  computeFitWorkflowViewport,
  createEmptyWorkflow,
  createWorkflowId,
  createWorkflowNode,
  evaluateWorkflowGraph,
  getWorkflowGridStyle,
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

interface DraggingNodeState {
  nodeId: string;
  tiltDeg: number;
}

export interface ConnectingWireDraft {
  sourceId: string;
  pointerWorldX: number;
  pointerWorldY: number;
  magneticTargetId: string | null;
}

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
  const [containerSize, setContainerSize] = React.useState({ width: 960, height: 600 });

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
  const [isPanning, setIsPanning] = React.useState(false);
  const [draggingState, setDraggingState] = React.useState<DraggingNodeState | null>(null);
  const [recentlyConnectedNodeId, setRecentlyConnectedNodeId] = React.useState<string | null>(null);
  const recentConnectTimerRef = React.useRef<number | null>(null);

  // Port wiring state (supports both drag-to-connect with magnetic port snap and tap-to-connect)
  const [connectingFromId, setConnectingFromId] = React.useState<string | null>(null);
  const [connectingDraft, setConnectingDraft] = React.useState<ConnectingWireDraft | null>(null);

  // Runtime execution state for triggers & timers
  const [manualPulseIds, setManualPulseIds] = React.useState<Set<string>>(() => new Set());
  const [timerOutputs, setTimerOutputs] = React.useState<Map<string, boolean>>(() => new Map());

  const [timerCountdowns, setTimerCountdowns] = React.useState<Map<string, number>>(
    () => new Map(),
  );

  const activeTimersRef = React.useRef<Map<string, number>>(new Map());
  const activeToggleNodesRef = React.useRef<Set<string>>(new Set());
  const lastDispatchedSignatureRef = React.useRef("");
  const [minuteTick, setMinuteTick] = React.useState(0);

  const persistState = React.useCallback(
    (updater: (prev: WorkflowStudioState) => WorkflowStudioState) => {
      setStudioState((prev) => {
        const next = updater(prev);
        studioRef.current = next;
        writeStoredWorkflowState(next);

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

  const hasActiveWorkflow = Boolean(activeWorkflow);

  // Align any legacy/off-grid workflow nodes onto the 16px lattice when snapToGrid is enabled
  React.useEffect(() => {
    if (!snapToGrid || !activeWorkflow) return;

    let hasOffGrid = false;
    const snappedNodes: WorkflowNode[] = [];

    for (const n of activeWorkflow.nodes) {
      const snapped = snapWorkflowNodeToGrid(n);

      if (
        snapped.x !== n.x ||
        snapped.y !== n.y ||
        snapped.width !== n.width ||
        snapped.height !== n.height
      ) {
        hasOffGrid = true;
      }

      snappedNodes.push(snapped);
    }

    if (!hasOffGrid) return;

    updateActiveWorkflow((wf) => ({
      ...wf,
      nodes: snappedNodes,
    }));
  }, [snapToGrid, activeWorkflow, updateActiveWorkflow]);

  // ResizeObserver for canvas container
  React.useEffect(() => {
    if (!hasActiveWorkflow) return;

    const el = containerRef.current;

    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, [hasActiveWorkflow]);

  // Clean up running timers on unmount
  React.useEffect(() => {
    const activeTimers = activeTimersRef.current;

    return () => {
      for (const timerId of activeTimers.values()) {
        globalThis.window?.clearInterval(timerId);
      }

      activeTimers.clear();

      if (recentConnectTimerRef.current !== null) {
        globalThis.window?.clearTimeout(recentConnectTimerRef.current);
      }
    };
  }, []);

  // Periodically tick when active workflow has an enabled schedule trigger
  React.useEffect(() => {
    if (!activeWorkflow?.enabled || globalThis.window === undefined) return;

    const hasSchedule = activeWorkflow.nodes.some((n) => n.kind === "trigger_schedule");

    if (!hasSchedule) return;

    const intervalId = globalThis.window.setInterval(() => {
      setMinuteTick((prev) => prev + 1);
    }, 30000);

    return () => globalThis.window.clearInterval(intervalId);
  }, [activeWorkflow?.enabled, activeWorkflow?.nodes]);

  // Evaluate active workflow graph continuously for visual feedback
  const evaluation = React.useMemo(() => {
    if (!activeWorkflow) {
      return {
        nodeOutputs: new Map<string, boolean>(),
        activeEdgeIds: new Set<string>(),
        pendingActions: [],
        triggeredTimerIds: [],
      };
    }

    const nowDate = minuteTick >= 0 ? new Date() : new Date();

    return evaluateWorkflowGraph({
      workflow: activeWorkflow,
      segments,
      pinsState,
      manualPulseNodeIds: manualPulseIds,
      timerOutputs,
      nowDate,
    });
  }, [activeWorkflow, segments, pinsState, manualPulseIds, timerOutputs, minuteTick]);

  // Start timer countdowns when triggered
  const startTimerNode = React.useCallback((node: WorkflowNode) => {
    if (activeTimersRef.current.has(node.id) || globalThis.window === undefined) return;

    const duration = Math.max(1, node.timerSeconds ?? 5);
    const mode = node.timerMode ?? "delay";

    if (mode === "hold") {
      setTimerOutputs((prev) => {
        const next = new Map(prev);
        next.set(node.id, true);

        return next;
      });
    }

    let remaining = duration;
    setTimerCountdowns((prev) => {
      const next = new Map(prev);
      next.set(node.id, remaining);

      return next;
    });

    const intervalId = globalThis.window.setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        setTimerCountdowns((prev) => {
          const next = new Map(prev);
          next.set(node.id, remaining);

          return next;
        });

        return;
      }

      globalThis.window.clearInterval(intervalId);
      activeTimersRef.current.delete(node.id);
      setTimerCountdowns((prev) => {
        const next = new Map(prev);
        next.delete(node.id);

        return next;
      });

      setTimerOutputs((prev) => {
        const next = new Map(prev);
        next.set(node.id, mode === "delay");

        return next;
      });

      if (mode === "delay") {
        globalThis.window.setTimeout(() => {
          setTimerOutputs((prev) => {
            const next = new Map(prev);
            next.delete(node.id);

            return next;
          });
        }, 1200);
      }
    }, 1000);

    activeTimersRef.current.set(node.id, intervalId);
  }, []);

  // Reactive execution when active workflow is enabled or manual pulse fires
  React.useEffect(() => {
    if (!activeWorkflow) return;

    const isPulsed = manualPulseIds.size > 0;

    if (!activeWorkflow.enabled && !isPulsed) {
      lastDispatchedSignatureRef.current = "";
      activeToggleNodesRef.current.clear();

      return;
    }

    for (const timerNodeId of evaluation.triggeredTimerIds) {
      const node = activeWorkflow.nodes.find((n) => n.id === timerNodeId);

      if (node) startTimerNode(node);
    }

    if (evaluation.pendingActions.length === 0) {
      lastDispatchedSignatureRef.current = "";
      activeToggleNodesRef.current.clear();

      return;
    }

    const nextActiveToggles = new Set<string>();
    const signatureParts: string[] = [];

    for (const act of evaluation.pendingActions) {
      if (act.actionMode === "toggle") {
        nextActiveToggles.add(act.nodeId);

        if (!activeToggleNodesRef.current.has(act.nodeId)) {
          onSetPinState(act.targetPin, act.actionOn);
        }
      } else {
        signatureParts.push(`${act.targetPin}:${act.actionOn ? "1" : "0"}`);
      }
    }

    activeToggleNodesRef.current = nextActiveToggles;

    if (signatureParts.length === 0) {
      lastDispatchedSignatureRef.current = "";

      return;
    }

    const signature = signatureParts.join("|");

    if (signature === lastDispatchedSignatureRef.current) return;

    lastDispatchedSignatureRef.current = signature;

    for (const act of evaluation.pendingActions) {
      if (act.actionMode !== "toggle" && Boolean(pinsState[act.targetPin]) !== act.actionOn) {
        onSetPinState(act.targetPin, act.actionOn);
      }
    }
  }, [
    activeWorkflow,
    evaluation.pendingActions,
    evaluation.triggeredTimerIds,
    manualPulseIds.size,
    onSetPinState,
    pinsState,
    startTimerNode,
  ]);

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
    [persistState],
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
    [persistState],
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
    [connectingFromId, selectedNodeId, updateActiveWorkflow],
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

  const connectNodes = React.useCallback(
    (sourceId: string, targetId: string) => {
      const currentWorkflow = activeWorkflowRef.current;

      if (!currentWorkflow) return;

      if (
        !canConnectWorkflowPorts(currentWorkflow.edges, currentWorkflow.nodes, sourceId, targetId)
      ) {
        showToast?.("این اتصال مجاز نیست (حلقه یا تکراری است).", "error");

        return;
      }

      const newEdge: WorkflowEdge = {
        id: createWorkflowId("edge"),
        sourceId,
        targetId,
      };

      updateActiveWorkflow((wf) => ({
        ...wf,
        edges: [...wf.edges, newEdge],
      }));

      setRecentlyConnectedNodeId(targetId);

      if (recentConnectTimerRef.current !== null) {
        globalThis.window?.clearTimeout(recentConnectTimerRef.current);
      }

      if (globalThis.window !== undefined) {
        recentConnectTimerRef.current = globalThis.window.setTimeout(() => {
          setRecentlyConnectedNodeId(null);
          recentConnectTimerRef.current = null;
        }, 1500);
      }
    },
    [showToast, updateActiveWorkflow],
  );

  const handleStartPortConnect = React.useCallback(
    (sourceNodeId: string, e: React.PointerEvent<HTMLButtonElement>) => {
      const currentWorkflow = activeWorkflowRef.current;

      if (e.button !== 0 || !currentWorkflow) return;

      e.stopPropagation();
      e.preventDefault();

      const el = containerRef.current;

      if (!el) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let hasDragged = false;
      let latestMagneticTargetId: string | null = null;
      const vp = currentWorkflow.viewport;
      const rect = el.getBoundingClientRect();

      const onMove = (moveEvent: PointerEvent) => {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 6) {
          hasDragged = true;
        }

        const worldX = (moveEvent.clientX - rect.left - vp.x) / vp.zoom;
        const worldY = (moveEvent.clientY - rect.top - vp.y) / vp.zoom;
        const wf = activeWorkflowRef.current;

        const match = wf
          ? findMagneticInputPort({
              nodes: wf.nodes,
              edges: wf.edges,
              sourceId: sourceNodeId,
              pointerWorldX: worldX,
              pointerWorldY: worldY,
              snapRadius: 42,
            })
          : null;

        latestMagneticTargetId = match?.targetId ?? null;

        setConnectingDraft({
          sourceId: sourceNodeId,
          pointerWorldX: match ? match.anchorX : worldX,
          pointerWorldY: match ? match.anchorY : worldY,
          magneticTargetId: latestMagneticTargetId,
        });
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setConnectingDraft(null);

        if (!hasDragged) {
          setConnectingFromId((prev) => (prev === sourceNodeId ? null : sourceNodeId));

          return;
        }

        const under = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const portEl = under?.closest("[data-workflow-port='in']");
        const targetId = latestMagneticTargetId ?? portEl?.getAttribute("data-node-id");

        if (targetId) {
          connectNodes(sourceNodeId, targetId);
          setConnectingFromId(null);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [connectNodes],
  );

  const handleCompletePortConnect = React.useCallback(
    (targetNodeId: string, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (!connectingFromId) return;

      connectNodes(connectingFromId, targetNodeId);
      setConnectingFromId(null);
    },
    [connectingFromId, connectNodes],
  );

  const handleTriggerManualPulse = React.useCallback((nodeId: string) => {
    setManualPulseIds((prev) => {
      const next = new Set(prev);
      next.add(nodeId);

      return next;
    });

    globalThis.window?.setTimeout(() => {
      setManualPulseIds((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);

        return next;
      });
    }, 1500);
  }, []);

  const handleRunTest = React.useCallback(() => {
    if (!activeWorkflow) return;

    const triggerIds = new Set<string>();

    for (const node of activeWorkflow.nodes) {
      if (node.kind === "trigger_manual" || node.kind === "trigger_schedule") {
        triggerIds.add(node.id);
      }
    }

    if (triggerIds.size > 0) {
      setManualPulseIds(triggerIds);
      globalThis.window?.setTimeout(() => {
        setManualPulseIds(new Set());
      }, 1500);
      showToast?.("گردش کار ارزیابی و اجرا شد.", "success");

      return;
    }

    const summary = evaluateWorkflowGraph({
      workflow: activeWorkflow,
      segments,
      pinsState,
      manualPulseNodeIds: triggerIds,
      timerOutputs,
    });

    for (const timerId of summary.triggeredTimerIds) {
      const node = activeWorkflow.nodes.find((n) => n.id === timerId);

      if (node) startTimerNode(node);
    }

    for (const act of summary.pendingActions) {
      if (Boolean(pinsState[act.targetPin]) !== act.actionOn) {
        onSetPinState(act.targetPin, act.actionOn);
      }
    }

    showToast?.("گردش کار ارزیابی و اجرا شد.", "success");
  }, [activeWorkflow, onSetPinState, pinsState, segments, showToast, startTimerNode, timerOutputs]);

  const bringNodeToFront = React.useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      updateActiveWorkflow((wf) => {
        let maxZ = 1;

        for (const n of wf.nodes) {
          maxZ = Math.max(maxZ, n.zIndex);
        }

        const nextNodes: WorkflowNode[] = [];

        for (const n of wf.nodes) {
          nextNodes.push(n.id === nodeId ? { ...n, zIndex: maxZ + 1 } : n);
        }

        return { ...wf, nodes: nextNodes };
      });
    },
    [updateActiveWorkflow],
  );

  const startNodeDrag = React.useCallback(
    (nodeId: string, e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || isLocked || !activeWorkflow) return;

      e.stopPropagation();
      bringNodeToFront(nodeId);

      const startNode = activeWorkflow.nodes.find((n) => n.id === nodeId);

      if (!startNode) return;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let lastClientX = e.clientX;
      let tiltResetTimer: number | null = null;
      const zoom = activeWorkflow.viewport.zoom;

      setDraggingState({ nodeId, tiltDeg: 0 });

      const onMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;
        const nextX = snapCanvasCoordinate(startNode.x + dx, snapToGrid);
        const nextY = snapCanvasCoordinate(startNode.y + dy, snapToGrid);
        const frameDeltaX = moveEvent.clientX - lastClientX;
        lastClientX = moveEvent.clientX;

        setDraggingState({
          nodeId,
          tiltDeg: computeDragTiltDeg(frameDeltaX),
        });

        if (tiltResetTimer !== null) {
          globalThis.window?.clearTimeout(tiltResetTimer);
        }

        if (globalThis.window !== undefined) {
          tiltResetTimer = globalThis.window.setTimeout(() => {
            setDraggingState((prev) => (prev?.nodeId === nodeId ? { nodeId, tiltDeg: 0 } : prev));
          }, 90);
        }

        handleUpdateNode(nodeId, { x: nextX, y: nextY });
      };

      const onUp = () => {
        if (tiltResetTimer !== null) {
          globalThis.window?.clearTimeout(tiltResetTimer);
        }

        setDraggingState(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [activeWorkflow, bringNodeToFront, handleUpdateNode, isLocked, snapToGrid],
  );

  const startNodeResize = React.useCallback(
    (nodeId: string, e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || isLocked || !activeWorkflow) return;

      e.stopPropagation();
      e.preventDefault();
      bringNodeToFront(nodeId);

      const startNode = activeWorkflow.nodes.find((n) => n.id === nodeId);

      if (!startNode) return;

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const zoom = activeWorkflow.viewport.zoom;
      const snappedRightEdge = snapCanvasCoordinate(startNode.x + startNode.width, snapToGrid);

      const onMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;

        const clamped = clampWorkflowNodeSize(
          startNode.kind,
          startNode.width - dx,
          startNode.height + dy,
          snapToGrid,
        );

        const nextX = snapCanvasCoordinate(snappedRightEdge - clamped.width, snapToGrid);

        handleUpdateNode(nodeId, {
          x: nextX,
          width: clamped.width,
          height: clamped.height,
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [activeWorkflow, bringNodeToFront, handleUpdateNode, isLocked, snapToGrid],
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

  const handleZoomBy = React.useCallback(
    (delta: number, focalClientX?: number, focalClientY?: number) => {
      setViewport((prev) => {
        const nextZoom = clampCanvasZoom(prev.zoom + delta);

        if (nextZoom === prev.zoom) return prev;

        const rect = containerRef.current?.getBoundingClientRect();

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
    [containerSize.height, containerSize.width, setViewport],
  );

  const handleFitView = React.useCallback(() => {
    if (!activeWorkflow) return;

    const el = containerRef.current;
    const w = el ? el.clientWidth : containerSize.width;
    const h = el ? el.clientHeight : containerSize.height;
    setViewport(computeFitWorkflowViewport(activeWorkflow.nodes, w, h));
  }, [activeWorkflow, containerSize.height, containerSize.width, setViewport]);

  // Wheel & Two-Finger Pinch Zoom listeners
  React.useEffect(() => {
    const el = containerRef.current;

    if (!el || !activeWorkflow) return;

    const onWheel = (e: WheelEvent) => {
      // SAFETY: WheelEvent target in DOM is an HTMLElement
      const target = e.target as HTMLElement | null;

      if (target?.closest("[data-canvas-scroll-area='true']") && !e.ctrlKey && !e.metaKey) {
        return;
      }

      e.preventDefault();
      handleZoomBy(e.deltaY < 0 ? 0.1 : -0.1, e.clientX, e.clientY);
    };

    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchWorldX = 0;
    let pinchWorldY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && activeWorkflowRef.current) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = el.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        const curr = activeWorkflowRef.current.viewport;
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
  }, [activeWorkflow, handleZoomBy, setViewport]);

  const handleCanvasPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const isRightButton = e.button === 2;

      if ((e.button !== 0 && e.button !== 1 && !isRightButton) || !activeWorkflow) return;

      // SAFETY: PointerEvent target in DOM is an HTMLElement
      const target = e.target as HTMLElement;

      if (target.closest("input, textarea, select, [contenteditable='true']")) return;

      if (!isRightButton && target.closest("[data-canvas-node='true']")) return;

      if (isRightButton) {
        e.preventDefault();
      } else {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectingFromId(null);
      }

      setIsPanning(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const initialVp = activeWorkflow.viewport;

      const onMove = (moveEvent: PointerEvent) => {
        setViewport((prev) => ({
          ...prev,
          x: Math.round(initialVp.x + (moveEvent.clientX - startX)),
          y: Math.round(initialVp.y + (moveEvent.clientY - startY)),
        }));
      };

      const onUp = () => {
        setIsPanning(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [activeWorkflow, setViewport],
  );

  const handleCanvasContextMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    // SAFETY: MouseEvent target in DOM is an HTMLElement
    const target = e.target as HTMLElement | null;

    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

    e.preventDefault();
  }, []);

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
    draggingState,
    recentlyConnectedNodeId,
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
