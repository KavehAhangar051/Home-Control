import type { WorkflowActionDispatch, WorkflowNode } from "./workflowTypes";

export function pruneStaleTimerLatches(latchedIds: Set<string>, triggeredTimerIds: string[]): void {
  if (latchedIds.size === 0) return;

  if (triggeredTimerIds.length === 0) {
    latchedIds.clear();

    return;
  }

  const currentlyTriggeredSet = new Set(triggeredTimerIds);

  for (const latchedId of latchedIds) {
    if (!currentlyTriggeredSet.has(latchedId)) {
      latchedIds.delete(latchedId);
    }
  }
}

export function buildWorkflowNodeMap(nodes: readonly WorkflowNode[]): Map<string, WorkflowNode> {
  const nodeById = new Map<string, WorkflowNode>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    nodeById.set(node.id, node);
  }

  return nodeById;
}

export function collectTriggerNodeIds(nodes: readonly WorkflowNode[]): Set<string> {
  const triggerIds = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.kind === "trigger_manual" || node.kind === "trigger_schedule") {
      triggerIds.add(node.id);
    }
  }

  return triggerIds;
}

export function scheduleUnlatchedTimers(
  triggeredTimerIds: string[],
  nodes: readonly WorkflowNode[],
  latchedTimerInputs: Set<string>,
  scheduleTimeout: (fn: () => void, delayMs: number) => void,
  startTimerNode: (node: WorkflowNode) => void,
): void {
  if (triggeredTimerIds.length === 0) return;

  const nodeById = buildWorkflowNodeMap(nodes);

  for (let i = 0; i < triggeredTimerIds.length; i++) {
    const timerNodeId = triggeredTimerIds[i];

    if (latchedTimerInputs.has(timerNodeId)) continue;

    const node = nodeById.get(timerNodeId);

    if (node) {
      latchedTimerInputs.add(timerNodeId);
      scheduleTimeout(() => startTimerNode(node), 0);
    }
  }
}

export function dispatchPendingWorkflowActions(
  pendingActions: readonly WorkflowActionDispatch[],
  activeToggleNodesRef: { current: Set<string> },
  lastDispatchedSignatureRef: { current: string },
  pinsState: Readonly<Record<string, boolean>>,
  dispatchPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void,
): void {
  if (pendingActions.length === 0) {
    lastDispatchedSignatureRef.current = "";
    activeToggleNodesRef.current.clear();

    return;
  }

  const nextActiveToggles = new Set<string>();
  const signatureParts: string[] = [];

  for (let i = 0; i < pendingActions.length; i++) {
    const action = pendingActions[i];

    if (action.actionMode === "toggle") {
      nextActiveToggles.add(action.nodeId);

      if (!activeToggleNodesRef.current.has(action.nodeId)) {
        dispatchPinState(action.targetPin, action.actionOn);
      }
    } else {
      signatureParts.push(`${action.targetPin}:${action.actionOn ? "1" : "0"}`);
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

  for (let i = 0; i < pendingActions.length; i++) {
    const action = pendingActions[i];

    if (
      action.actionMode !== "toggle" &&
      Boolean(pinsState[action.targetPin]) !== action.actionOn
    ) {
      dispatchPinState(action.targetPin, action.actionOn);
    }
  }
}
