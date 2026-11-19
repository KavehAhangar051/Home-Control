"use client";

import React from "react";
import { snapCanvasCoordinate } from "@/features/iot/components/canvas/canvasGeometry";
import {
  clearNodeDragTiltCssVar,
  computeDragTiltDeg,
  findMagneticInputPort,
  findNodeTiltElement,
  setNodeDragTiltCssVar,
} from "@/features/iot/components/canvas/nodeMotion";
import { canConnectWorkflowPorts, clampWorkflowNodeSize, createWorkflowId } from "./workflowEngine";
import { expandGroupBoundsToFitChild, findContainingGroupNode } from "./workflowSubflowHelpers";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "./workflowTypes";

export interface ConnectingWireDraft {
  sourceId: string;
  pointerWorldX: number;
  pointerWorldY: number;
  magneticTargetId?: string | null;
}

export interface UseWorkflowInteractionsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeWorkflow: WorkflowDefinition | null;
  activeWorkflowRef: React.RefObject<WorkflowDefinition | null>;
  isLocked: boolean;
  snapToGrid: boolean;
  updateActiveWorkflow: (
    updater: (wf: WorkflowDefinition) => WorkflowDefinition,
    options?: { transient?: boolean },
  ) => void;
  handleUpdateNodeTransient: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onRecordUndoSnapshot?: () => void;
  onCommitInteraction: () => void;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast?: (msg: string, type: "success" | "error") => void;
}

/**
 * Deep workflow node & port interaction controller.
 * Encapsulates z-order promotion, rAF-coalesced node drag with CSS-variable tilt,
 * synchronized sub-flow container dragging, drop-into-group auto-nesting,
 * concentric node resize, and rAF-coalesced magnetic port wiring.
 */
export function useWorkflowInteractions({
  containerRef,
  activeWorkflow: _activeWorkflow,
  activeWorkflowRef,
  isLocked,
  snapToGrid,
  updateActiveWorkflow,
  handleUpdateNodeTransient,
  onRecordUndoSnapshot,
  onCommitInteraction,
  setSelectedNodeId,
  setSelectedEdgeId,
  showToast,
}: UseWorkflowInteractionsOptions) {
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = React.useState<string | null>(null);
  const [connectingDraft, setConnectingDraft] = React.useState<ConnectingWireDraft | null>(null);

  const bringNodeToFront = React.useCallback(
    (nodeId: string, options?: { transient?: boolean }) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      updateActiveWorkflow(
        (wf) => {
          const clicked = wf.nodes.find((n) => n.id === nodeId);

          if (!clicked) return wf;

          let maxZ = 1;
          let countAtMaxZ = 0;

          for (const n of wf.nodes) {
            if (n.zIndex > maxZ) {
              maxZ = n.zIndex;
              countAtMaxZ = 1;
            } else if (n.zIndex === maxZ) {
              countAtMaxZ += 1;
            }
          }

          if (clicked.kind !== "group" && clicked.zIndex === maxZ && countAtMaxZ === 1) {
            return wf;
          }

          // If a sub-flow group container is selected, keep its child nodes above the container frame
          if (clicked.kind === "group") {
            const groupZ = maxZ + 1;

            return {
              ...wf,
              nodes: wf.nodes.map((n, idx) => {
                if (n.id === nodeId) return { ...n, zIndex: groupZ };

                if (n.parentGroupId === nodeId) return { ...n, zIndex: groupZ + 1 + idx };

                return n;
              }),
            };
          }

          return {
            ...wf,
            nodes: wf.nodes.map((n) => (n.id === nodeId ? { ...n, zIndex: maxZ + 1 } : n)),
          };
        },
        options?.transient ? { transient: true } : undefined,
      );
    },
    [setSelectedEdgeId, setSelectedNodeId, updateActiveWorkflow],
  );

  const startNodeDrag = React.useCallback(
    (nodeId: string, e: React.PointerEvent<HTMLElement>) => {
      const currentWorkflow = activeWorkflowRef.current;
      if (e.button !== 0 || isLocked || !currentWorkflow) return;

      e.stopPropagation();
      const startNode = currentWorkflow.nodes.find((n) => n.id === nodeId);

      if (!startNode) return;

      onRecordUndoSnapshot?.();
      bringNodeToFront(nodeId, { transient: true });

      // Capture any sub-flow child nodes belonging to this group container at drag start
      const childStartPositions = new Map<string, { x: number; y: number }>();

      if (startNode.kind === "group") {
        for (const n of currentWorkflow.nodes) {
          if (n.parentGroupId === nodeId) {
            childStartPositions.set(n.id, { x: n.x, y: n.y });
          }
        }
      }

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let lastClientX = e.clientX;
      let lastAppliedX = startNode.x;
      let lastAppliedY = startNode.y;
      const zoom = currentWorkflow.viewport.zoom;
      const tiltEl = findNodeTiltElement(nodeId);
      setDraggingNodeId(nodeId);
      setNodeDragTiltCssVar(tiltEl, 0);

      const applyPointerMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;
        const nextX = snapCanvasCoordinate(startNode.x + dx, snapToGrid);
        const nextY = snapCanvasCoordinate(startNode.y + dy, snapToGrid);
        const snappedDx = nextX - startNode.x;
        const snappedDy = nextY - startNode.y;

        setNodeDragTiltCssVar(tiltEl, computeDragTiltDeg(moveEvent.clientX - lastClientX));
        lastClientX = moveEvent.clientX;

        if (nextX === lastAppliedX && nextY === lastAppliedY) {
          return;
        }
        lastAppliedX = nextX;
        lastAppliedY = nextY;

        if (childStartPositions.size > 0) {
          updateActiveWorkflow(
            (wf) => ({
              ...wf,
              nodes: wf.nodes.map((n) => {
                if (n.id === nodeId) {
                  return { ...n, x: nextX, y: nextY };
                }

                const childStart = childStartPositions.get(n.id);

                if (childStart) {
                  return {
                    ...n,
                    x: snapCanvasCoordinate(childStart.x + snappedDx, snapToGrid),
                    y: snapCanvasCoordinate(childStart.y + snappedDy, snapToGrid),
                  };
                }

                return n;
              }),
            }),
            { transient: true },
          );
        } else {
          handleUpdateNodeTransient(nodeId, { x: nextX, y: nextY });
        }
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

      const onMove = (moveEvent: PointerEvent) => {
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
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);

        // Auto-parent non-group nodes dropped inside a sub-flow group container
        if (startNode.kind !== "group") {
          updateActiveWorkflow((wf) => {
            const latestNode = wf.nodes.find((n) => n.id === nodeId);

            if (!latestNode) return wf;

            const containerGroup = findContainingGroupNode(latestNode, wf.nodes);

            if (containerGroup && latestNode.parentGroupId !== containerGroup.id) {
              const expandedGroup = expandGroupBoundsToFitChild(
                containerGroup,
                latestNode,
                snapToGrid,
              );

              return {
                ...wf,
                nodes: wf.nodes.map((n) => {
                  if (n.id === containerGroup.id) return expandedGroup;

                  if (n.id === nodeId) {
                    return {
                      ...n,
                      parentGroupId: containerGroup.id,
                      zIndex: Math.max(n.zIndex, expandedGroup.zIndex + 1),
                    };
                  }

                  return n;
                }),
              };
            }

            return wf;
          });
        }

        onCommitInteraction();
      };

      const onUp = (endEvent: PointerEvent) => {
        pendingMove = endEvent;
        flushPointerMove();
        finishDrag();
      };

      const onCancel = () => {
        flushPointerMove();
        finishDrag();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [
      activeWorkflowRef,
      bringNodeToFront,
      handleUpdateNodeTransient,
      isLocked,
      onCommitInteraction,
      onRecordUndoSnapshot,
      snapToGrid,
      updateActiveWorkflow,
    ],
  );

  const startNodeResize = React.useCallback(
    (nodeId: string, e: React.PointerEvent<HTMLElement>) => {
      const currentWorkflow = activeWorkflowRef.current;
      if (e.button !== 0 || isLocked || !currentWorkflow) return;

      e.stopPropagation();
      e.preventDefault();

      const startNode = currentWorkflow.nodes.find((n) => n.id === nodeId);

      if (!startNode) return;

      onRecordUndoSnapshot?.();
      bringNodeToFront(nodeId, { transient: true });
      setDraggingNodeId(nodeId);

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      let lastAppliedX = startNode.x;
      let lastAppliedWidth = startNode.width;
      let lastAppliedHeight = startNode.height;
      const zoom = currentWorkflow.viewport.zoom;
      const snappedRightEdge = snapCanvasCoordinate(startNode.x + startNode.width, snapToGrid);

      const applyPointerMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;

        const clamped = clampWorkflowNodeSize(
          startNode.kind,
          startNode.width - dx,
          startNode.height + dy,
          snapToGrid,
        );

        const nextX = snapCanvasCoordinate(snappedRightEdge - clamped.width, snapToGrid);

        if (
          nextX === lastAppliedX &&
          clamped.width === lastAppliedWidth &&
          clamped.height === lastAppliedHeight
        ) {
          return;
        }
        lastAppliedX = nextX;
        lastAppliedWidth = clamped.width;
        lastAppliedHeight = clamped.height;

        handleUpdateNodeTransient(nodeId, {
          x: nextX,
          width: clamped.width,
          height: clamped.height,
        });
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

      const onMove = (moveEvent: PointerEvent) => {
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
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        onCommitInteraction();
      };

      const onUp = (endEvent: PointerEvent) => {
        pendingMove = endEvent;
        flushPointerMove();
        finishResize();
      };

      const onCancel = () => {
        flushPointerMove();
        finishResize();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [
      activeWorkflowRef,
      bringNodeToFront,
      handleUpdateNodeTransient,
      isLocked,
      onCommitInteraction,
      onRecordUndoSnapshot,
      snapToGrid,
    ],
  );

  const connectNodes = React.useCallback(
    (sourceId: string, targetId: string, targetPortIndex?: number) => {
      const currentWorkflow = activeWorkflowRef.current;
      if (!currentWorkflow) return;

      if (
        !canConnectWorkflowPorts(currentWorkflow.edges, currentWorkflow.nodes, sourceId, targetId)
      ) {
        showToast?.("این اتصال مجاز نیست (حلقه یا تکراری است).", "error");

        return;
      }

      onRecordUndoSnapshot?.();

      const newEdge: WorkflowEdge = {
        id: createWorkflowId("edge"),
        sourceId,
        targetId,
        targetPortIndex,
      };

      updateActiveWorkflow((wf) => ({
        ...wf,
        edges: [...wf.edges, newEdge],
      }));
    },
    [activeWorkflowRef, onRecordUndoSnapshot, showToast, updateActiveWorkflow],
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
      let lastMagneticTargetId: string | null = null;
      const vp = currentWorkflow.viewport;
      const rect = el.getBoundingClientRect();

      const applyPointerMove = (moveEvent: PointerEvent) => {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 6) {
          hasDragged = true;
        }

        const rawWorldX = (moveEvent.clientX - rect.left - vp.x) / vp.zoom;
        const rawWorldY = (moveEvent.clientY - rect.top - vp.y) / vp.zoom;
        const currentWf = activeWorkflowRef.current ?? currentWorkflow;

        const magneticMatch = findMagneticInputPort({
          nodes: currentWf.nodes,
          edges: currentWf.edges,
          sourceId: sourceNodeId,
          pointerWorldX: rawWorldX,
          pointerWorldY: rawWorldY,
        });

        lastMagneticTargetId = magneticMatch?.targetId ?? null;
        setConnectingDraft({
          sourceId: sourceNodeId,
          pointerWorldX: magneticMatch ? magneticMatch.anchorX : rawWorldX,
          pointerWorldY: magneticMatch ? magneticMatch.anchorY : rawWorldY,
          magneticTargetId: lastMagneticTargetId,
        });
      };

      let pendingMove: PointerEvent | null = null;
      let frameId: number | null = null;

      const onMove = (moveEvent: PointerEvent) => {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 6) {
          hasDragged = true;
        }

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

      const onUp = (upEvent: PointerEvent) => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        pendingMove = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setConnectingDraft(null);

        if (Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY) > 6) {
          hasDragged = true;
        }

        if (!hasDragged) {
          setConnectingFromId((prev) => (prev === sourceNodeId ? null : sourceNodeId));

          return;
        }

        const under = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const portEl = under?.closest("[data-workflow-port='in']");
        const targetId = portEl?.getAttribute("data-node-id") ?? lastMagneticTargetId;
        const portIdxRaw = portEl?.getAttribute("data-port-index");

        const parsedPortIdx =
          portIdxRaw !== null && portIdxRaw !== undefined ? Number(portIdxRaw) : undefined;

        if (targetId) {
          connectNodes(
            sourceNodeId,
            targetId,
            Number.isFinite(parsedPortIdx) ? parsedPortIdx : undefined,
          );
          setConnectingFromId(null);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [activeWorkflowRef, connectNodes, containerRef],
  );

  const handleCompletePortConnect = React.useCallback(
    (targetNodeId: string, e: React.MouseEvent<HTMLButtonElement>, targetPortIndex?: number) => {
      e.stopPropagation();

      if (!connectingFromId) return;

      connectNodes(connectingFromId, targetNodeId, targetPortIndex);
      setConnectingFromId(null);
    },
    [connectingFromId, connectNodes],
  );

  return {
    draggingNodeId,
    connectingFromId,
    setConnectingFromId,
    connectingDraft,
    bringNodeToFront,
    startNodeDrag,
    startNodeResize,
    handleStartPortConnect,
    handleCompletePortConnect,
  };
}
