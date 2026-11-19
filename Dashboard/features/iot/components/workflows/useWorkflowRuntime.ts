"use client";

import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { evaluateWorkflowGraph } from "./workflowEngine";
import {
  buildWorkflowNodeMap,
  collectTriggerNodeIds,
  dispatchPendingWorkflowActions,
  pruneStaleTimerLatches,
  scheduleUnlatchedTimers,
} from "./workflowRuntimeHelpers";
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

const SCHEDULE_TICK_INTERVAL_MS = 30_000;
const MANUAL_PULSE_DURATION_MS = 1_500;
const DELAY_OUTPUT_PULSE_MS = 1_200;
const TIMER_TICK_INTERVAL_MS = 1_000;
const DEFAULT_TIMER_SECONDS = 5;

interface ActiveTimerEntry {
  ownerWorkflowId: string | null;
  remaining: number;
  mode: "delay" | "hold";
}

function collectWorkflowReferencedPins(
  nodes: readonly WorkflowNode[] | undefined,
  segments: readonly Segment[],
): string[] {
  if (!nodes || nodes.length === 0 || segments.length === 0) return [];

  const segmentById = new Map<string, Segment>();

  for (let i = 0; i < segments.length; i++) {
    segmentById.set(segments[i].id, segments[i]);
  }

  const pins = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.kind === "segment" && node.segmentId) {
      const pin = segmentById.get(node.segmentId)?.pin;

      if (pin) pins.add(pin);
    } else if (node.kind === "group") {
      if (node.memberSegmentIds && node.memberSegmentIds.length > 0) {
        for (let j = 0; j < node.memberSegmentIds.length; j++) {
          const pin = segmentById.get(node.memberSegmentIds[j])?.pin;

          if (pin) pins.add(pin);
        }
      } else if (node.groupName) {
        for (let j = 0; j < segments.length; j++) {
          const seg = segments[j];

          if (seg.pin && seg.group === node.groupName) {
            pins.add(seg.pin);
          }
        }
      }
    }
  }

  return Array.from(pins);
}

/**
 * Deep workflow runtime evaluation & timer orchestration hook.
 * Encapsulates live DAG evaluation, schedule ticks, consolidated countdown timers (`delay` and `hold`),
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

  const activeTimerEntriesRef = React.useRef<Map<string, ActiveTimerEntry>>(new Map());
  const sharedTimerIntervalRef = React.useRef<number | null>(null);
  const activeTimeoutsRef = React.useRef<Set<number>>(new Set());
  const latchedTimerInputsRef = React.useRef<Set<string>>(new Set());
  const activeToggleNodesRef = React.useRef<Set<string>>(new Set());
  const lastDispatchedSignatureRef = React.useRef("");
  const activeWorkflowIdRef = React.useRef<string | null>(activeWorkflowId);

  React.useEffect(() => {
    activeWorkflowIdRef.current = activeWorkflowId;
  }, [activeWorkflowId]);

  const clearRuntimeResources = React.useCallback(() => {
    if (sharedTimerIntervalRef.current !== null) {
      globalThis.window?.clearInterval(sharedTimerIntervalRef.current);
      sharedTimerIntervalRef.current = null;
    }

    activeTimerEntriesRef.current.clear();

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

  const hasScheduleNode = Boolean(
    activeWorkflow?.enabled && activeWorkflow.nodes.some((n) => n.kind === "trigger_schedule"),
  );

  React.useEffect(() => {
    if (!hasScheduleNode || globalThis.window === undefined) return;

    const intervalId = globalThis.window.setInterval(() => {
      setScheduleNow(new Date());
    }, SCHEDULE_TICK_INTERVAL_MS);

    return () => globalThis.window.clearInterval(intervalId);
  }, [hasScheduleNode]);

  // Scope pinsState to only pins referenced by the active workflow so unrelated MQTT pin
  // updates never force a full DAG re-evaluation.
  const referencedPins = React.useMemo(
    () => collectWorkflowReferencedPins(activeWorkflow?.nodes, segments),
    [activeWorkflow?.nodes, segments],
  );

  const relevantPinsSignature = React.useMemo(() => {
    if (referencedPins.length === 0) return "";

    let sig = "";

    for (let i = 0; i < referencedPins.length; i++) {
      const pin = referencedPins[i];
      sig += `${pin}:${pinsState[pin] ? "1" : "0"};`;
    }

    return sig;
  }, [referencedPins, pinsState]);

  const scopedPinsState = React.useMemo(() => {
    if (!relevantPinsSignature) return {} as Record<string, boolean>;

    const next: Record<string, boolean> = {};
    const parts = relevantPinsSignature.split(";");

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!part) continue;

      const sep = part.lastIndexOf(":");
      next[part.slice(0, sep)] = part.charCodeAt(sep + 1) === 49;
    }

    return next;
  }, [relevantPinsSignature]);

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
      pinsState: scopedPinsState,
      manualPulseNodeIds: manualPulseIds,
      timerOutputs,
      nowDate: scheduleNow,
    });
  }, [activeWorkflow, segments, scopedPinsState, manualPulseIds, timerOutputs, scheduleNow]);

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

  const ensureSharedTimerTicker = React.useCallback(() => {
    if (sharedTimerIntervalRef.current !== null || globalThis.window === undefined) return;

    sharedTimerIntervalRef.current = globalThis.window.setInterval(() => {
      const entries = activeTimerEntriesRef.current;
      const currentWorkflowId = activeWorkflowIdRef.current;

      if (entries.size === 0) {
        if (sharedTimerIntervalRef.current !== null) {
          globalThis.window.clearInterval(sharedTimerIntervalRef.current);
          sharedTimerIntervalRef.current = null;
        }

        return;
      }

      const countdownUpdates: Array<{ nodeId: string; remaining: number | null }> = [];
      const outputUpdates: Array<{ nodeId: string; value: boolean }> = [];
      const completedDelayIds: string[] = [];

      for (const [nodeId, entry] of entries) {
        if (entry.ownerWorkflowId !== currentWorkflowId) {
          entries.delete(nodeId);
          continue;
        }

        entry.remaining -= 1;

        if (entry.remaining > 0) {
          countdownUpdates.push({ nodeId, remaining: entry.remaining });
        } else {
          entries.delete(nodeId);
          countdownUpdates.push({ nodeId, remaining: null });
          outputUpdates.push({ nodeId, value: entry.mode === "delay" });

          if (entry.mode === "delay") {
            completedDelayIds.push(nodeId);
          }
        }
      }

      if (entries.size === 0 && sharedTimerIntervalRef.current !== null) {
        globalThis.window.clearInterval(sharedTimerIntervalRef.current);
        sharedTimerIntervalRef.current = null;
      }

      if (countdownUpdates.length > 0) {
        updateScopedMap(setTimerCountdownsState, currentWorkflowId, (next) => {
          for (let i = 0; i < countdownUpdates.length; i++) {
            const update = countdownUpdates[i];

            if (update.remaining === null) {
              next.delete(update.nodeId);
            } else {
              next.set(update.nodeId, update.remaining);
            }
          }
        });
      }

      if (outputUpdates.length > 0) {
        updateScopedMap(setTimerOutputsState, currentWorkflowId, (next) => {
          for (let i = 0; i < outputUpdates.length; i++) {
            const update = outputUpdates[i];
            next.set(update.nodeId, update.value);
          }
        });
      }

      if (completedDelayIds.length > 0) {
        scheduleTimeout(() => {
          if (activeWorkflowIdRef.current !== currentWorkflowId) return;

          updateScopedMap(setTimerOutputsState, currentWorkflowId, (next) => {
            for (let i = 0; i < completedDelayIds.length; i++) {
              next.delete(completedDelayIds[i]);
            }
          });
        }, DELAY_OUTPUT_PULSE_MS);
      }
    }, TIMER_TICK_INTERVAL_MS);
  }, [scheduleTimeout, updateScopedMap]);

  const startTimerNode = React.useCallback(
    (node: WorkflowNode) => {
      if (activeTimerEntriesRef.current.has(node.id) || globalThis.window === undefined) return;

      const ownerWorkflowId = activeWorkflowIdRef.current;
      const duration = Math.max(1, node.timerSeconds ?? DEFAULT_TIMER_SECONDS);
      const mode = node.timerMode ?? "delay";

      if (mode === "hold") {
        updateScopedMap(setTimerOutputsState, ownerWorkflowId, (next) => {
          next.set(node.id, true);
        });
      }

      updateScopedMap(setTimerCountdownsState, ownerWorkflowId, (next) => {
        next.set(node.id, duration);
      });

      activeTimerEntriesRef.current.set(node.id, {
        ownerWorkflowId,
        remaining: duration,
        mode,
      });

      ensureSharedTimerTicker();
    },
    [ensureSharedTimerTicker, updateScopedMap],
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
      scopedPinsState,
      dispatchPinState,
    );
  }, [
    activeWorkflow,
    dispatchPinState,
    evaluation.pendingActions,
    evaluation.triggeredTimerIds,
    manualPulseIds.size,
    scopedPinsState,
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
