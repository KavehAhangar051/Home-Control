"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { evaluateWorkflowGraph } from "./workflowEngine";
import type { WorkflowActionDispatch, WorkflowDefinition, WorkflowNode } from "./workflowTypes";

export interface UseWorkflowRuntimeOptions {
  activeWorkflow: WorkflowDefinition | null;
  segments: Segment[];
  pinsState: Record<string, boolean>;
  dispatchPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
  showToast?: (msg: string, type: "success" | "error") => void;
}

interface ScopedState<T> {
  workflowId: string | null;
  value: T;
}

const EMPTY_PULSE_IDS = new Set<string>();
const EMPTY_TIMER_OUTPUTS = new Map<string, boolean>();
const EMPTY_TIMER_COUNTDOWNS = new Map<string, number>();

const SCHEDULE_TICK_INTERVAL_MS = 30_000;
const MANUAL_PULSE_DURATION_MS = 1_500;
const DELAY_OUTPUT_PULSE_MS = 1_200;
const TIMER_TICK_INTERVAL_MS = 1_000;
const DEFAULT_TIMER_SECONDS = 5;

function pruneStaleTimerLatches(latchedIds: Set<string>, triggeredTimerIds: string[]): void {
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

function buildWorkflowNodeMap(nodes: WorkflowNode[]): Map<string, WorkflowNode> {
  const nodeById = new Map<string, WorkflowNode>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    nodeById.set(node.id, node);
  }

  return nodeById;
}

function collectTriggerNodeIds(nodes: WorkflowNode[]): Set<string> {
  const triggerIds = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.kind === "trigger_manual" || node.kind === "trigger_schedule") {
      triggerIds.add(node.id);
    }
  }

  return triggerIds;
}

function scheduleUnlatchedTimers(
  triggeredTimerIds: string[],
  nodes: WorkflowNode[],
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

function dispatchPendingWorkflowActions(
  pendingActions: WorkflowActionDispatch[],
  activeToggleNodesRef: React.RefObject<Set<string>>,
  lastDispatchedSignatureRef: React.RefObject<string>,
  pinsState: Record<string, boolean>,
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

/**
 * Deep workflow runtime evaluation & timer orchestration hook.
 * Encapsulates live DAG evaluation, schedule ticks, countdown timers (`delay` and `hold`),
 * manual pulse triggers, test execution, and deduplicated hardware pin action dispatch.
 */
export function useWorkflowRuntime({
  activeWorkflow,
  segments,
  pinsState,
  dispatchPinState,
  showToast,
}: UseWorkflowRuntimeOptions) {
  const activeWorkflowId = activeWorkflow?.id ?? null;

  const [manualPulseState, setManualPulseState] = React.useState<ScopedState<Set<string>>>(() => ({
    workflowId: null,
    value: new Set(),
  }));

  const [timerOutputsState, setTimerOutputsState] = React.useState<
    ScopedState<Map<string, boolean>>
  >(() => ({
    workflowId: null,
    value: new Map(),
  }));

  const [timerCountdownsState, setTimerCountdownsState] = React.useState<
    ScopedState<Map<string, number>>
  >(() => ({
    workflowId: null,
    value: new Map(),
  }));

  const [scheduleNow, setScheduleNow] = React.useState<Date>(() => new Date());

  const manualPulseIds =
    manualPulseState.workflowId === activeWorkflowId ? manualPulseState.value : EMPTY_PULSE_IDS;

  const timerOutputs =
    timerOutputsState.workflowId === activeWorkflowId
      ? timerOutputsState.value
      : EMPTY_TIMER_OUTPUTS;

  const timerCountdowns =
    timerCountdownsState.workflowId === activeWorkflowId
      ? timerCountdownsState.value
      : EMPTY_TIMER_COUNTDOWNS;

  const activeTimersRef = React.useRef<Map<string, number>>(new Map());
  const activeTimeoutsRef = React.useRef<Set<number>>(new Set());
  const latchedTimerInputsRef = React.useRef<Set<string>>(new Set());
  const activeToggleNodesRef = React.useRef<Set<string>>(new Set());
  const lastDispatchedSignatureRef = React.useRef("");
  const activeWorkflowIdRef = React.useRef<string | null>(activeWorkflowId);

  React.useEffect(() => {
    activeWorkflowIdRef.current = activeWorkflowId;
  }, [activeWorkflowId]);

  const clearRuntimeResources = React.useCallback(() => {
    for (const timerId of activeTimersRef.current.values()) {
      globalThis.window?.clearInterval(timerId);
    }

    activeTimersRef.current.clear();

    for (const timeoutId of activeTimeoutsRef.current) {
      globalThis.window?.clearTimeout(timeoutId);
    }

    activeTimeoutsRef.current.clear();
    latchedTimerInputsRef.current.clear();
    activeToggleNodesRef.current.clear();
    lastDispatchedSignatureRef.current = "";
  }, []);

  React.useEffect(() => {
    void activeWorkflowId;
    clearRuntimeResources();

    return () => {
      clearRuntimeResources();
    };
  }, [activeWorkflowId, clearRuntimeResources]);

  React.useEffect(() => {
    if (!activeWorkflow?.enabled || globalThis.window === undefined) return;

    const hasSchedule = activeWorkflow.nodes.some((n) => n.kind === "trigger_schedule");

    if (!hasSchedule) return;

    const intervalId = globalThis.window.setInterval(() => {
      setScheduleNow(new Date());
    }, SCHEDULE_TICK_INTERVAL_MS);

    return () => globalThis.window.clearInterval(intervalId);
  }, [activeWorkflow?.enabled, activeWorkflow?.nodes]);

  const evaluation = React.useMemo(() => {
    if (!activeWorkflow) {
      return {
        nodeOutputs: new Map<string, boolean>(),
        activeEdgeIds: new Set<string>(),
        pendingActions: [],
        triggeredTimerIds: [],
      };
    }

    return evaluateWorkflowGraph({
      workflow: activeWorkflow,
      segments,
      pinsState,
      manualPulseNodeIds: manualPulseIds,
      timerOutputs,
      nowDate: scheduleNow,
    });
  }, [activeWorkflow, segments, pinsState, manualPulseIds, timerOutputs, scheduleNow]);

  const scheduleTimeout = React.useCallback((fn: () => void, delayMs: number) => {
    if (globalThis.window === undefined) return;

    const timeoutId = globalThis.window.setTimeout(() => {
      activeTimeoutsRef.current.delete(timeoutId);
      fn();
    }, delayMs);

    activeTimeoutsRef.current.add(timeoutId);
  }, []);

  const schedulePulseClear = React.useCallback(
    (ownerWorkflowId: string | null, nodeIds: Iterable<string>) => {
      const idsToClear = Array.from(nodeIds);
      scheduleTimeout(() => {
        if (activeWorkflowIdRef.current !== ownerWorkflowId) return;

        setManualPulseState((prev) => {
          const base = prev.workflowId === ownerWorkflowId ? prev.value : new Set<string>();
          const next = new Set(base);

          for (const id of idsToClear) {
            next.delete(id);
          }

          return { workflowId: ownerWorkflowId, value: next };
        });
      }, MANUAL_PULSE_DURATION_MS);
    },
    [scheduleTimeout],
  );

  const updateScopedMap = React.useCallback(
    <V>(
      setter: React.Dispatch<React.SetStateAction<ScopedState<Map<string, V>>>>,
      ownerWorkflowId: string | null,
      mutate: (next: Map<string, V>) => void,
    ) => {
      setter((prev) => {
        const base = prev.workflowId === ownerWorkflowId ? prev.value : new Map<string, V>();
        const next = new Map(base);
        mutate(next);

        return { workflowId: ownerWorkflowId, value: next };
      });
    },
    [],
  );

  const startTimerNode = React.useCallback(
    (node: WorkflowNode) => {
      if (activeTimersRef.current.has(node.id) || globalThis.window === undefined) return;

      const ownerWorkflowId = activeWorkflowIdRef.current;
      const duration = Math.max(1, node.timerSeconds ?? DEFAULT_TIMER_SECONDS);
      const mode = node.timerMode ?? "delay";

      if (mode === "hold") {
        updateScopedMap(setTimerOutputsState, ownerWorkflowId, (next) => {
          next.set(node.id, true);
        });
      }

      let remaining = duration;
      updateScopedMap(setTimerCountdownsState, ownerWorkflowId, (next) => {
        next.set(node.id, remaining);
      });

      const intervalId = globalThis.window.setInterval(() => {
        if (activeWorkflowIdRef.current !== ownerWorkflowId) {
          globalThis.window.clearInterval(intervalId);
          activeTimersRef.current.delete(node.id);

          return;
        }

        remaining -= 1;

        if (remaining > 0) {
          updateScopedMap(setTimerCountdownsState, ownerWorkflowId, (next) => {
            next.set(node.id, remaining);
          });

          return;
        }

        globalThis.window.clearInterval(intervalId);
        activeTimersRef.current.delete(node.id);
        updateScopedMap(setTimerCountdownsState, ownerWorkflowId, (next) => {
          next.delete(node.id);
        });

        updateScopedMap(setTimerOutputsState, ownerWorkflowId, (next) => {
          next.set(node.id, mode === "delay");
        });

        if (mode === "delay") {
          scheduleTimeout(() => {
            if (activeWorkflowIdRef.current !== ownerWorkflowId) return;

            updateScopedMap(setTimerOutputsState, ownerWorkflowId, (next) => {
              next.delete(node.id);
            });
          }, DELAY_OUTPUT_PULSE_MS);
        }
      }, TIMER_TICK_INTERVAL_MS);

      activeTimersRef.current.set(node.id, intervalId);
    },
    [scheduleTimeout, updateScopedMap],
  );

  React.useEffect(() => {
    if (!activeWorkflow) return;

    const isPulsed = manualPulseIds.size > 0;

    if (!activeWorkflow.enabled && !isPulsed) {
      lastDispatchedSignatureRef.current = "";
      activeToggleNodesRef.current.clear();
      latchedTimerInputsRef.current.clear();

      return;
    }

    // Rising-edge timer latch: prevent continuous input from re-triggering delay loops
    pruneStaleTimerLatches(latchedTimerInputsRef.current, evaluation.triggeredTimerIds);

    scheduleUnlatchedTimers(
      evaluation.triggeredTimerIds,
      activeWorkflow.nodes,
      latchedTimerInputsRef.current,
      scheduleTimeout,
      startTimerNode,
    );

    dispatchPendingWorkflowActions(
      evaluation.pendingActions,
      activeToggleNodesRef,
      lastDispatchedSignatureRef,
      pinsState,
      dispatchPinState,
    );
  }, [
    activeWorkflow,
    dispatchPinState,
    evaluation.pendingActions,
    evaluation.triggeredTimerIds,
    manualPulseIds.size,
    pinsState,
    scheduleTimeout,
    startTimerNode,
  ]);

  const handleTriggerManualPulse = React.useCallback(
    (nodeId: string) => {
      const ownerWorkflowId = activeWorkflowIdRef.current;

      setManualPulseState((prev) => {
        const base = prev.workflowId === ownerWorkflowId ? prev.value : new Set<string>();
        const next = new Set(base);
        next.add(nodeId);

        return { workflowId: ownerWorkflowId, value: next };
      });

      schedulePulseClear(ownerWorkflowId, [nodeId]);
    },
    [schedulePulseClear],
  );

  const handleRunTest = React.useCallback(() => {
    if (!activeWorkflow) return;

    const ownerWorkflowId = activeWorkflow.id;
    const now = new Date();
    setScheduleNow(now);

    const triggerIds = collectTriggerNodeIds(activeWorkflow.nodes);

    if (triggerIds.size > 0) {
      setManualPulseState({ workflowId: ownerWorkflowId, value: triggerIds });
      schedulePulseClear(ownerWorkflowId, triggerIds);
      showToast?.("گردش کار ارزیابی و اجرا شد.", "success");

      return;
    }

    const summary = evaluateWorkflowGraph({
      workflow: activeWorkflow,
      segments,
      pinsState,
      manualPulseNodeIds: triggerIds,
      timerOutputs,
      nowDate: now,
    });

    if (summary.triggeredTimerIds.length > 0) {
      const nodeById = buildWorkflowNodeMap(activeWorkflow.nodes);

      for (const timerId of summary.triggeredTimerIds) {
        const node = nodeById.get(timerId);

        if (node) startTimerNode(node);
      }
    }

    for (const act of summary.pendingActions) {
      if (Boolean(pinsState[act.targetPin]) !== act.actionOn) {
        dispatchPinState(act.targetPin, act.actionOn);
      }
    }

    showToast?.("گردش کار ارزیابی و اجرا شد.", "success");
  }, [
    activeWorkflow,
    dispatchPinState,
    pinsState,
    schedulePulseClear,
    segments,
    showToast,
    startTimerNode,
    timerOutputs,
  ]);

  return {
    evaluation,
    timerCountdowns,
    handleTriggerManualPulse,
    handleRunTest,
  };
}
