"use client";

import React from "react";
import { snapCanvasCoordinate } from "@/features/iot/components/canvas/canvasGeometry";
import {
  computeDragTiltDeg,
  findMagneticInputPort,
} from "@/features/iot/components/canvas/nodeMotion";
import { canConnectWorkflowPorts, clampWorkflowNodeSize, createWorkflowId } from "./workflowEngine";
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
  updateActiveWorkflow: (updater: (wf: WorkflowDefinition) => WorkflowDefinition) => void;
  handleUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast?: (msg: string, type: "success" | "error") => void;
}

/**
 * Deep workflow node & port interaction controller.
 * Encapsulates z-order promotion, node drag with physics tilt, concentric node resize,
 * and magnetic port wiring (both drag-to-connect and tap-to-connect).
 */
export function useWorkflowInteractions({
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
}: UseWorkflowInteractionsOptions) {
  const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
  const [dragTiltDeg, setDragTiltDeg] = React.useState(0);
  const [connectingFromId, setConnectingFromId] = React.useState<string | null>(null);
  const [connectingDraft, setConnectingDraft] = React.useState<ConnectingWireDraft | null>(null);

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
    [setSelectedEdgeId, setSelectedNodeId, updateActiveWorkflow],
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
      const zoom = activeWorkflow.viewport.zoom;
      setDraggingNodeId(nodeId);
      setDragTiltDeg(0);

      const onMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / zoom;
        const dy = (moveEvent.clientY - startClientY) / zoom;
        const nextX = snapCanvasCoordinate(startNode.x + dx, snapToGrid);
        const nextY = snapCanvasCoordinate(startNode.y + dy, snapToGrid);

        setDragTiltDeg(computeDragTiltDeg(moveEvent.clientX - lastClientX));
        lastClientX = moveEvent.clientX;
        handleUpdateNode(nodeId, { x: nextX, y: nextY });
      };

      const onUp = () => {
        setDraggingNodeId(null);
        setDragTiltDeg(0);
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

  const connectNodes = React.useCallback(
    (sourceId: string, targetId: string, targetPortIndex?: number) => {
      if (!activeWorkflow) return;

      if (
        !canConnectWorkflowPorts(activeWorkflow.edges, activeWorkflow.nodes, sourceId, targetId)
      ) {
        showToast?.("این اتصال مجاز نیست (حلقه یا تکراری است).", "error");

        return;
      }

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
    [activeWorkflow, showToast, updateActiveWorkflow],
  );

  const handleStartPortConnect = React.useCallback(
    (sourceNodeId: string, e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || !activeWorkflow) return;

      e.stopPropagation();
      e.preventDefault();

      const el = containerRef.current;

      if (!el) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let hasDragged = false;
      let lastMagneticTargetId: string | null = null;
      const vp = activeWorkflow.viewport;
      const rect = el.getBoundingClientRect();

      const onMove = (moveEvent: PointerEvent) => {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 6) {
          hasDragged = true;
        }

        const rawWorldX = (moveEvent.clientX - rect.left - vp.x) / vp.zoom;
        const rawWorldY = (moveEvent.clientY - rect.top - vp.y) / vp.zoom;
        const currentWf = activeWorkflowRef.current ?? activeWorkflow;

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
    [activeWorkflow, activeWorkflowRef, connectNodes, containerRef],
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
    dragTiltDeg,
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
