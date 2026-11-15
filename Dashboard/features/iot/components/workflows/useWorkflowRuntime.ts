"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { evaluateWorkflowGraph } from "./workflowEngine";
import type { WorkflowDefinition, WorkflowNode } from "./workflowTypes";

export interface UseWorkflowRuntimeOptions {
  activeWorkflow: WorkflowDefinition | null;
  segments: Segment[];
  pinsState: Record<string, boolean>;
  onSetPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
  showToast?: (msg: string, type: "success" | "error") => void;
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
  onSetPinState,
  showToast,
}: UseWorkflowRuntimeOptions) {
  const [manualPulseIds, setManualPulseIds] = React.useState<Set<string>>(() => new Set());
  const [timerOutputs, setTimerOutputs] = React.useState<Map<string, boolean>>(() => new Map());

  const [timerCountdowns, setTimerCountdowns] = React.useState<Map<string, number>>(
    () => new Map(),
  );

  const [scheduleNow, setScheduleNow] = React.useState<Date>(() => new Date());

  const activeTimersRef = React.useRef<Map<string, number>>(new Map());
  const activeTimeoutsRef = React.useRef<Set<number>>(new Set());
  const latchedTimerInputsRef = React.useRef<Set<string>>(new Set());
  const activeToggleNodesRef = React.useRef<Set<string>>(new Set());
  const lastDispatchedSignatureRef = React.useRef("");
  const activeWorkflowId = activeWorkflow?.id ?? null;
  const activeWorkflowIdRef = React.useRef<string | null>(activeWorkflowId);
  activeWorkflowIdRef.current = activeWorkflowId;

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

  // Reset and isolate runtime state whenever the active workflow changes or unmounts
  React.useEffect(() => {
    clearRuntimeResources();
    setManualPulseIds(new Set());
    setTimerOutputs(new Map());
    setTimerCountdowns(new Map());

    if (activeWorkflowId !== undefined) {
      setScheduleNow(new Date());
    }

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

  const startTimerNode = React.useCallback(
    (node: WorkflowNode) => {
      if (activeTimersRef.current.has(node.id) || globalThis.window === undefined) return;

      const ownerWorkflowId = activeWorkflowIdRef.current;
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
        if (activeWorkflowIdRef.current !== ownerWorkflowId) {
          globalThis.window.clearInterval(intervalId);
          activeTimersRef.current.delete(node.id);

          return;
        }

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
          scheduleTimeout(() => {
            if (activeWorkflowIdRef.current !== ownerWorkflowId) return;

            setTimerOutputs((prev) => {
              const next = new Map(prev);
              next.delete(node.id);

              return next;
            });
          }, 1200);
        }
      }, 1000);

      activeTimersRef.current.set(node.id, intervalId);
    },
    [scheduleTimeout],
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

    // Rising-edge timer latch: prevent continuous input (e.g. active schedule minute) from re-triggering delay loops
    const currentlyTriggeredSet = new Set(evaluation.triggeredTimerIds);

    for (const latchedId of Array.from(latchedTimerInputsRef.current)) {
      if (!currentlyTriggeredSet.has(latchedId)) {
        latchedTimerInputsRef.current.delete(latchedId);
      }
    }

    for (const timerNodeId of evaluation.triggeredTimerIds) {
      if (latchedTimerInputsRef.current.has(timerNodeId)) continue;

      const node = activeWorkflow.nodes.find((n) => n.id === timerNodeId);

      if (node) {
        latchedTimerInputsRef.current.add(timerNodeId);
        startTimerNode(node);
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

  const handleTriggerManualPulse = React.useCallback(
    (nodeId: string) => {
      const ownerWorkflowId = activeWorkflowIdRef.current;

      setManualPulseIds((prev) => {
        const next = new Set(prev);
        next.add(nodeId);

        return next;
      });

      scheduleTimeout(() => {
        if (activeWorkflowIdRef.current !== ownerWorkflowId) return;

        setManualPulseIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);

          return next;
        });
      }, 1500);
    },
    [scheduleTimeout],
  );

  const handleRunTest = React.useCallback(() => {
    if (!activeWorkflow) return;

    const ownerWorkflowId = activeWorkflow.id;
    const now = new Date();
    setScheduleNow(now);

    const triggerIds = new Set<string>();

    for (const node of activeWorkflow.nodes) {
      if (node.kind === "trigger_manual" || node.kind === "trigger_schedule") {
        triggerIds.add(node.id);
      }
    }

    if (triggerIds.size > 0) {
      setManualPulseIds(triggerIds);
      scheduleTimeout(() => {
        if (activeWorkflowIdRef.current !== ownerWorkflowId) return;

        setManualPulseIds((prev) => {
          const next = new Set(prev);

          for (const id of triggerIds) {
            next.delete(id);
          }

          return next;
        });
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
      nowDate: now,
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
  }, [
    activeWorkflow,
    onSetPinState,
    pinsState,
    scheduleTimeout,
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
