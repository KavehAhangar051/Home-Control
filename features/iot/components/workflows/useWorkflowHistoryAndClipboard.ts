"use client";

import React, { useEffect, useEffectEvent } from "react";
import {
  openJsonWithFilePicker,
  saveJsonWithFilePicker,
  shareJsonPayload,
} from "@/lib/fileTransfer";
import { triggerHaptic } from "@/lib/haptics";
import {
  cloneClipboardNodesAndEdges,
  parseImportedWorkflowsPayload,
  toggleNodeSubflowGroup,
} from "./workflowSubflowHelpers";
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowStudioState,
} from "./workflowTypes";

const MAX_UNDO_HISTORY = 40;

interface GraphSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowHistoryBucket {
  past: GraphSnapshot[];
  future: GraphSnapshot[];
}

interface ClipboardBuffer {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  pasteStep: number;
}

function isEditableInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;

  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

interface UseWorkflowHistoryAndClipboardOptions {
  activeWorkflow: WorkflowDefinition | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isLocked: boolean;
  snapToGrid: boolean;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  updateActiveWorkflow: (updater: (wf: WorkflowDefinition) => WorkflowDefinition) => void;
  setStudioState: React.Dispatch<React.SetStateAction<WorkflowStudioState>>;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  showToast?: (msg: string, type: "success" | "error") => void;
}

/**
 * Manages Workflow Studio Undo/Redo history, Copy/Paste/Duplicate clipboard,
 * Sub-flow Node Grouping (`Ctrl+G`), JSON File System Export/Import & Web Share,
 * and standard desktop keyboard shortcuts.
 */
export function useWorkflowHistoryAndClipboard({
  activeWorkflow,
  selectedNodeId,
  selectedEdgeId,
  isLocked,
  snapToGrid,
  setSelectedNodeId,
  setSelectedEdgeId,
  updateActiveWorkflow,
  setStudioState,
  onDeleteNode,
  onDeleteEdge,
  showToast,
}: UseWorkflowHistoryAndClipboardOptions) {
  const historyByWorkflowRef = React.useRef<Map<string, WorkflowHistoryBucket>>(new Map());
  const [, bumpHistoryVersion] = React.useState(0);
  const [clipboard, setClipboard] = React.useState<ClipboardBuffer | null>(null);

  const activeBucket = activeWorkflow
    ? historyByWorkflowRef.current.get(activeWorkflow.id)
    : undefined;
  const canUndo = Boolean(activeBucket && activeBucket.past.length > 0);
  const canRedo = Boolean(activeBucket && activeBucket.future.length > 0);
  const hasClipboard = Boolean(clipboard && clipboard.nodes.length > 0);

  const recordUndoSnapshot = React.useCallback((wf: WorkflowDefinition | null) => {
    if (!wf) return;

    const map = historyByWorkflowRef.current;
    const bucket = map.get(wf.id) ?? { past: [], future: [] };
    const nextPast = [
      ...bucket.past.slice(-(MAX_UNDO_HISTORY - 1)),
      {
        nodes: wf.nodes.map((n) => ({ ...n })),
        edges: wf.edges.map((e) => ({ ...e })),
      },
    ];

    map.set(wf.id, { past: nextPast, future: [] });
    bumpHistoryVersion((v) => v + 1);
  }, []);

  const handleUndo = React.useCallback(() => {
    if (!activeWorkflow || isLocked) return;

    const bucket = historyByWorkflowRef.current.get(activeWorkflow.id);

    if (!bucket || bucket.past.length === 0) return;

    const previous = bucket.past[bucket.past.length - 1];
    const currentSnapshot: GraphSnapshot = {
      nodes: activeWorkflow.nodes.map((n) => ({ ...n })),
      edges: activeWorkflow.edges.map((e) => ({ ...e })),
    };

    historyByWorkflowRef.current.set(activeWorkflow.id, {
      past: bucket.past.slice(0, -1),
      future: [currentSnapshot, ...bucket.future].slice(0, MAX_UNDO_HISTORY),
    });

    updateActiveWorkflow((wf) => ({
      ...wf,
      nodes: previous.nodes,
      edges: previous.edges,
    }));
    bumpHistoryVersion((v) => v + 1);
    triggerHaptic("tap");
  }, [activeWorkflow, isLocked, updateActiveWorkflow]);

  const handleRedo = React.useCallback(() => {
    if (!activeWorkflow || isLocked) return;

    const bucket = historyByWorkflowRef.current.get(activeWorkflow.id);

    if (!bucket || bucket.future.length === 0) return;

    const [nextSnapshot, ...remainingFuture] = bucket.future;
    const currentSnapshot: GraphSnapshot = {
      nodes: activeWorkflow.nodes.map((n) => ({ ...n })),
      edges: activeWorkflow.edges.map((e) => ({ ...e })),
    };

    historyByWorkflowRef.current.set(activeWorkflow.id, {
      past: [...bucket.past, currentSnapshot].slice(-MAX_UNDO_HISTORY),
      future: remainingFuture,
    });

    updateActiveWorkflow((wf) => ({
      ...wf,
      nodes: nextSnapshot.nodes,
      edges: nextSnapshot.edges,
    }));
    bumpHistoryVersion((v) => v + 1);
    triggerHaptic("tap");
  }, [activeWorkflow, isLocked, updateActiveWorkflow]);

  const handleCopySelectedNode = React.useCallback(() => {
    if (!activeWorkflow || !selectedNodeId) return;

    const primary = activeWorkflow.nodes.find((n) => n.id === selectedNodeId);

    if (!primary) return;

    // When copying a sub-flow group container, include its nested child nodes and internal edges
    const copiedNodes =
      primary.kind === "group"
        ? [primary, ...activeWorkflow.nodes.filter((n) => n.parentGroupId === primary.id)]
        : [primary];

    const copiedNodeIds = new Set(copiedNodes.map((n) => n.id));
    const copiedEdges = activeWorkflow.edges.filter(
      (e) => copiedNodeIds.has(e.sourceId) && copiedNodeIds.has(e.targetId),
    );

    setClipboard({
      nodes: copiedNodes.map((n) => ({ ...n })),
      edges: copiedEdges.map((e) => ({ ...e })),
      pasteStep: 1,
    });
    triggerHaptic("tap");
    showToast?.(`«${primary.label}» کپی شد.`, "success");
  }, [activeWorkflow, selectedNodeId, showToast]);

  const handlePasteClipboard = React.useCallback(() => {
    if (!activeWorkflow || isLocked || !clipboard || clipboard.nodes.length === 0) return;

    recordUndoSnapshot(activeWorkflow);

    const { clonedNodes, clonedEdges, primaryNodeId } = cloneClipboardNodesAndEdges({
      sourceNodes: clipboard.nodes,
      sourceEdges: clipboard.edges,
      existingNodes: activeWorkflow.nodes,
      offsetStep: clipboard.pasteStep,
      snapToGrid,
    });

    updateActiveWorkflow((wf) => ({
      ...wf,
      nodes: [...wf.nodes, ...clonedNodes],
      edges: [...wf.edges, ...clonedEdges],
    }));

    setClipboard((prev) => (prev ? { ...prev, pasteStep: prev.pasteStep + 1 } : null));

    if (primaryNodeId) {
      setSelectedNodeId(primaryNodeId);
      setSelectedEdgeId(null);
    }

    triggerHaptic("tap");
  }, [
    activeWorkflow,
    clipboard,
    isLocked,
    recordUndoSnapshot,
    setSelectedEdgeId,
    setSelectedNodeId,
    snapToGrid,
    updateActiveWorkflow,
  ]);

  const handleDuplicateSelectedNode = React.useCallback(() => {
    if (!activeWorkflow || isLocked || !selectedNodeId) return;

    const primary = activeWorkflow.nodes.find((n) => n.id === selectedNodeId);

    if (!primary) return;

    recordUndoSnapshot(activeWorkflow);

    const sourceNodes =
      primary.kind === "group"
        ? [primary, ...activeWorkflow.nodes.filter((n) => n.parentGroupId === primary.id)]
        : [primary];

    const sourceIds = new Set(sourceNodes.map((n) => n.id));
    const sourceEdges = activeWorkflow.edges.filter(
      (e) => sourceIds.has(e.sourceId) && sourceIds.has(e.targetId),
    );

    const { clonedNodes, clonedEdges, primaryNodeId } = cloneClipboardNodesAndEdges({
      sourceNodes,
      sourceEdges,
      existingNodes: activeWorkflow.nodes,
      offsetStep: 1,
      snapToGrid,
    });

    updateActiveWorkflow((wf) => ({
      ...wf,
      nodes: [...wf.nodes, ...clonedNodes],
      edges: [...wf.edges, ...clonedEdges],
    }));

    if (primaryNodeId) {
      setSelectedNodeId(primaryNodeId);
      setSelectedEdgeId(null);
    }

    triggerHaptic("tap");
  }, [
    activeWorkflow,
    isLocked,
    recordUndoSnapshot,
    selectedNodeId,
    setSelectedEdgeId,
    setSelectedNodeId,
    snapToGrid,
    updateActiveWorkflow,
  ]);

  const activeWorkflowRef = React.useRef(activeWorkflow);
  React.useEffect(() => {
    activeWorkflowRef.current = activeWorkflow;
  }, [activeWorkflow]);

  const handleToggleSubflowGroup = React.useCallback(
    (targetNodeId?: string) => {
      const currentWorkflow = activeWorkflowRef.current;
      const resolvedId = targetNodeId ?? selectedNodeId;

      if (!currentWorkflow || isLocked || !resolvedId) return;

      recordUndoSnapshot(currentWorkflow);

      const result = toggleNodeSubflowGroup({
        workflow: currentWorkflow,
        targetNodeId: resolvedId,
        snapToGrid,
      });

      if (result.action === "noop") return;

      updateActiveWorkflow(() => result.workflow);
      triggerHaptic("tap");

      if (result.action === "grouped") {
        showToast?.("گره در باکس زیرمدار (Sub-flow) گروه‌بندی شد.", "success");
      } else {
        showToast?.("گره از باکس زیرمدار جدا شد.", "success");
      }
    },
    [isLocked, recordUndoSnapshot, selectedNodeId, showToast, snapToGrid, updateActiveWorkflow],
  );

  const handleExportWorkflow = React.useCallback(async () => {
    if (!activeWorkflow) return;

    try {
      const safeName = activeWorkflow.name.trim().replace(/\s+/g, "-") || "workflow";
      const result = await saveJsonWithFilePicker({
        filename: `${safeName}.workflow.json`,
        description: "فایل سناریوی گردش کار (JSON)",
        data: activeWorkflow,
      });

      if (result.saved) {
        triggerHaptic("success");
        showToast?.(`فایل گردش کار «${activeWorkflow.name}» ذخیره شد.`, "success");
      }
    } catch {
      triggerHaptic("error");
      showToast?.("خطا در ذخیره فایل گردش کار.", "error");
    }
  }, [activeWorkflow, showToast]);

  const handleShareWorkflow = React.useCallback(async () => {
    if (!activeWorkflow) return;

    try {
      const safeName = activeWorkflow.name.trim().replace(/\s+/g, "-") || "workflow";
      const result = await shareJsonPayload({
        title: `گردش کار: ${activeWorkflow.name}`,
        text: `سناریوی اتوماسیون و گیت منطقی «${activeWorkflow.name}»`,
        filename: `${safeName}.workflow.json`,
        data: activeWorkflow,
      });

      if (result.shared) {
        triggerHaptic("success");
        showToast?.(
          result.method === "clipboard"
            ? "JSON گردش کار در کلیپ‌بورد کپی شد."
            : "گردش کار به اشتراک گذاشته شد.",
          "success",
        );
      }
    } catch {
      triggerHaptic("error");
      showToast?.("خطا در اشتراک‌گذاری گردش کار.", "error");
    }
  }, [activeWorkflow, showToast]);

  const handleImportWorkflow = React.useCallback(async () => {
    try {
      const picked = await openJsonWithFilePicker({
        description: "فایل گردش کار (JSON)",
      });

      if (!picked) return;

      setStudioState((prev) => {
        const existingIds = new Set(prev.workflows.map((w) => w.id));
        const importedList = parseImportedWorkflowsPayload(picked.data, existingIds);

        return {
          workflows: [...prev.workflows, ...importedList],
          activeWorkflowId: importedList[0]?.id ?? prev.activeWorkflowId,
        };
      });

      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      triggerHaptic("success");
      showToast?.("سناریوی گردش کار با موفقیت وارد شد.", "success");
    } catch (error) {
      triggerHaptic("error");
      const msg = error instanceof Error ? error.message : "فایل گردش کار معتبر نیست.";
      showToast?.(msg, "error");
    }
  }, [setSelectedEdgeId, setSelectedNodeId, setStudioState, showToast]);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!activeWorkflow || isEditableInputTarget(event.target)) return;

    const isMod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (isMod && key === "z") {
      event.preventDefault();

      if (event.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }

      return;
    }

    if (isMod && key === "y") {
      event.preventDefault();
      handleRedo();

      return;
    }

    if (isMod && key === "c" && selectedNodeId) {
      event.preventDefault();
      handleCopySelectedNode();

      return;
    }

    if (isMod && key === "v" && hasClipboard) {
      event.preventDefault();
      handlePasteClipboard();

      return;
    }

    if (isMod && key === "d" && selectedNodeId) {
      event.preventDefault();
      handleDuplicateSelectedNode();

      return;
    }

    if (isMod && key === "g" && selectedNodeId) {
      event.preventDefault();
      handleToggleSubflowGroup(selectedNodeId);

      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && !isLocked) {
      if (selectedNodeId) {
        event.preventDefault();
        onDeleteNode(selectedNodeId);
      } else if (selectedEdgeId) {
        event.preventDefault();
        onDeleteEdge(selectedEdgeId);
      }
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    canUndo,
    canRedo,
    hasClipboard,
    recordUndoSnapshot,
    handleUndo,
    handleRedo,
    handleCopySelectedNode,
    handlePasteClipboard,
    handleDuplicateSelectedNode,
    handleToggleSubflowGroup,
    handleExportWorkflow,
    handleShareWorkflow,
    handleImportWorkflow,
  };
}
