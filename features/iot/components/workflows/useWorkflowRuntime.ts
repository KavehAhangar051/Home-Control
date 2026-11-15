"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { evaluateWorkflowGraph } from "./workflowEngine";
import type { WorkflowDefinition, WorkflowNode } from "./workflowTypes";

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

function pruneStaleTimerLatches(latchedIds: Set<string>, triggeredTimerIds: string[]): void {
  const currentlyTriggeredSet = new Set(triggeredTimerIds);

  for (const latchedId of Array.from(latchedIds)) {
    if (!currentlyTriggeredSet.has(latchedId)) {
      latchedIds.delete(latchedId);
    }
  }
}

function buildWorkflowNodeMap(nodes: WorkflowNode[]): Map<string, WorkflowNode> {
  const nodeById = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  return nodeById;
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

  // Clean up timer intervals/timeouts whenever the active workflow changes or unmounts
  React.useEffect(() => {
    void activeWorkflowId;
    clearRuntimeResources();

    return () => {
      clearRuntimeResources();
    };
  }, [activeWorkflowId, clearRuntimeResources]);

  // Periodically tick when active workflow has an enabled schedule trigger
  React.useEffect(() => {
    if (!activeWorkflow?.enabled || globalThis.window === undefined) return;

    const hasSchedule = activeWorkflow.nodes.some((n) => n.kind === "trigger_schedule");

    if (!hasSchedule) return;

    const intervalId = globalThis.window.setInterval(() => {
      setScheduleNow(new Date());
    }, 30000);

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
      }, 1500);
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
      const duration = Math.max(1, node.timerSeconds ?? 5);
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
          }, 1200);
        }
      }, 1000);

      activeTimersRef.current.set(node.id, intervalId);
    },
    [scheduleTimeout, updateScopedMap],
  );

  // Reactive execution when active workflow is enabled or manual pulse fires
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

    const nodeById = buildWorkflowNodeMap(activeWorkflow.nodes);

    for (const timerNodeId of evaluation.triggeredTimerIds) {
      if (latchedTimerInputsRef.current.has(timerNodeId)) continue;

      const node = nodeById.get(timerNodeId);

      if (node) {
        latchedTimerInputsRef.current.add(timerNodeId);
        scheduleTimeout(() => startTimerNode(node), 0);
      }
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
          dispatchPinState(act.targetPin, act.actionOn);
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
        dispatchPinState(act.targetPin, act.actionOn);
      }
    }
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

    const triggerIds = new Set<string>();
    const nodeById = buildWorkflowNodeMap(activeWorkflow.nodes);

    for (const node of activeWorkflow.nodes) {
      if (node.kind === "trigger_manual" || node.kind === "trigger_schedule") {
        triggerIds.add(node.id);
      }
    }

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

    for (const timerId of summary.triggeredTimerIds) {
      const node = nodeById.get(timerId);

      if (node) startTimerNode(node);
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
