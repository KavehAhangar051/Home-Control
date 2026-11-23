"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Macro } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { defaultDeviceSyncGateway } from "@/features/iot/services/deviceGatewayAdapter";
import { onMqttStateChange } from "@/features/iot/services/mqtt/client";
import type { IDeviceSyncPort } from "@/features/iot/services/ports";
import { isReadOnlyInputSegment } from "@/features/iot/utils/analogInput";
import {
  clampAnalogValue,
  clampPwmResolution,
  getAnalogMaxDuty,
  isAnalogOutputSegment,
} from "@/features/iot/utils/analogOutput";
import { cancelAnalogRamp } from "@/features/iot/utils/analogRamp";
import { evaluateMacroExecution, type MacroExecutionPlan } from "@/features/iot/utils/macroEngine";
import { soundManager } from "@/lib/audio";

type SetPinsStateFn = (
  updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
) => void;

type ShowToastFn = (message: string, type: "success" | "error") => void;

export interface PinsStateMap {
  [pin: string]: boolean;
}

function clearTimerOverrides(pins: string[]): void {
  const store = useIoTStore.getState();
  const next = { ...store.autoOffRemaining };
  let changed = false;

  for (const pin of pins) {
    if (Object.hasOwn(next, pin)) {
      delete next[pin];
      changed = true;
    }
  }

  if (changed) store.setAutoOffRemaining(next);
}

export function rollbackSinglePinState(
  prev: PinsStateMap,
  pin: string,
  attemptedState: boolean,
  prevState: boolean | undefined,
): PinsStateMap {
  if (prev[pin] !== attemptedState) return prev;

  if (prevState === undefined) {
    const next: PinsStateMap = {};

    for (const key in prev) {
      if (Object.hasOwn(prev, key) && key !== pin) {
        next[key] = prev[key];
      }
    }

    return next;
  }

  return { ...prev, [pin]: prevState };
}

export function rollbackBatchPinState(
  prev: PinsStateMap,
  previousSnapshots: ReadonlyMap<string, boolean | undefined>,
  attemptedUpdates: Readonly<Record<string, boolean>>,
): PinsStateMap {
  let changed = false;

  for (const [pinKey] of previousSnapshots) {
    if (prev[pinKey] === attemptedUpdates[pinKey]) {
      changed = true;
      break;
    }
  }

  if (!changed) return prev;

  const next: PinsStateMap = {};

  for (const key in prev) {
    if (!Object.hasOwn(prev, key)) continue;

    if (previousSnapshots.has(key) && prev[key] === attemptedUpdates[key]) {
      const prevVal = previousSnapshots.get(key);

      if (prevVal !== undefined) {
        next[key] = prevVal;
      }
    } else {
      next[key] = prev[key];
    }
  }

  return next;
}

function resolveAnalogPinResolution(pin: string): number {
  const store = useIoTStore.getState();
  const liveRes = store.pinsPwmResolution[pin];
  if (liveRes !== undefined) return clampPwmResolution(liveRes);

  const segment = store.segments.find((s) => s.pin === pin);
  return clampPwmResolution(segment?.pwmResolution);
}

function resolveRestoredAnalogDuty(pin: string): number {
  const store = useIoTStore.getState();
  const resolution = resolveAnalogPinResolution(pin);
  const lastNonZero = store.pinsLastNonZeroValue[pin];

  if (lastNonZero !== undefined && lastNonZero > 0) {
    return clampAnalogValue(lastNonZero, resolution);
  }

  const segment = store.segments.find((s) => s.pin === pin);
  if (segment?.lastNonZeroValue !== undefined && segment.lastNonZeroValue > 0) {
    return clampAnalogValue(segment.lastNonZeroValue, resolution);
  }

  return getAnalogMaxDuty(resolution);
}

export async function executeSinglePinUpdate(
  pin: string,
  pinState: boolean,
  preventMqtt: boolean,
  timer: number | undefined,
  setPinsState: SetPinsStateFn,
  showToast: ShowToastFn,
  beginLoading: () => void,
  endLoading: () => void,
  syncGateway: IDeviceSyncPort = defaultDeviceSyncGateway,
): Promise<boolean> {
  if (!pin) return false;

  const initialStore = useIoTStore.getState();
  const prevState = initialStore.pinsState[pin];
  const segment = initialStore.segments.find((s) => s.pin === pin);

  if (isReadOnlyInputSegment(segment)) return false;

  cancelAnalogRamp(pin);
  beginLoading();
  const isAnalog = isAnalogOutputSegment(segment);
  const prevAnalogValue = initialStore.pinsAnalogValue[pin];

  const restoreAnalogRollback = () => {
    if (!isAnalog) return;

    useIoTStore.getState().setPinsAnalogValue((prev) => {
      if (prevAnalogValue === undefined) {
        if (!Object.hasOwn(prev, pin)) return prev;
        const next = { ...prev };
        delete next[pin];
        return next;
      }

      return prev[pin] === prevAnalogValue ? prev : { ...prev, [pin]: prevAnalogValue };
    });
  };

  try {
    setPinsState((prev) => (prev[pin] === pinState ? prev : { ...prev, [pin]: pinState }));

    if (isAnalog) {
      const nextAnalogDuty = pinState ? resolveRestoredAnalogDuty(pin) : 0;
      useIoTStore
        .getState()
        .setPinsAnalogValue((prev) =>
          prev[pin] === nextAnalogDuty ? prev : { ...prev, [pin]: nextAnalogDuty },
        );
    }

    const effectiveTimer = timer !== undefined ? timer : segment?.auto_off;

    const delivered = await syncGateway.syncSinglePin(pin, pinState, {
      preventMqtt,
      autoOff: effectiveTimer,
      isPushMode: segment?.mode === "push",
      showToast,
    });

    if (delivered === false) {
      setPinsState((prev) => rollbackSinglePinState(prev, pin, pinState, prevState));
      restoreAnalogRollback();

      return false;
    }

    clearTimerOverrides([pin]);
    return true;
  } catch (error) {
    console.error("Failed to update pin value:", error);
    setPinsState((prev) => rollbackSinglePinState(prev, pin, pinState, prevState));
    restoreAnalogRollback();

    return false;
  } finally {
    endLoading();
  }
}

export interface SetPinAnalogOptions {
  persistToCloud?: boolean;
  preventMqtt?: boolean;
  timer?: number;
  qosOverride?: 0 | 1 | 2;
  /** When true, streams an intermediate hardware ramp frame without mutating optimistic UI store state. */
  skipStoreUpdate?: boolean;
}

/**
 * Updates an `analog_output` PWM pin optimistically (updating `pinsAnalogValue`,
 * `pinsLastNonZeroValue` when > 0, and `pinsState`) and dispatches Opcode `0x0A` / Local WS.
 */
export async function executeAnalogPinUpdate(
  pin: string,
  value: number,
  options: SetPinAnalogOptions | undefined,
  setPinsState: SetPinsStateFn,
  showToast: ShowToastFn,
  beginLoading: () => void,
  endLoading: () => void,
  syncGateway: IDeviceSyncPort = defaultDeviceSyncGateway,
): Promise<boolean> {
  if (!pin) return false;

  const store = useIoTStore.getState();
  const segment = store.segments.find((s) => s.pin === pin);

  if (isReadOnlyInputSegment(segment)) return false;

  const resolution = resolveAnalogPinResolution(pin);
  const clampedValue = clampAnalogValue(value, resolution);
  const nextBoolState = clampedValue > 0;
  const effectiveTimer =
    options?.timer !== undefined ? options.timer : nextBoolState ? segment?.auto_off : 0;

  if (options?.skipStoreUpdate) {
    try {
      return await syncGateway.syncAnalogPin(pin, clampedValue, {
        preventMqtt: options.preventMqtt,
        autoOff: effectiveTimer,
        persistToCloud: false,
        qosOverride: options.qosOverride ?? 0,
        showToast,
      });
    } catch (error) {
      console.error("Failed to dispatch analog ramp step:", error);
      return false;
    }
  }

  cancelAnalogRamp(pin);
  const persistToCloud = options?.persistToCloud !== false;

  if (persistToCloud) beginLoading();

  const prevState = store.pinsState[pin];
  const prevAnalogValue = store.pinsAnalogValue[pin];

  try {
    store.setPinsAnalogValue((prev) =>
      prev[pin] === clampedValue ? prev : { ...prev, [pin]: clampedValue },
    );

    if (clampedValue > 0) {
      store.setPinsLastNonZeroValue((prev) =>
        prev[pin] === clampedValue ? prev : { ...prev, [pin]: clampedValue },
      );
    }

    setPinsState((prev) =>
      prev[pin] === nextBoolState ? prev : { ...prev, [pin]: nextBoolState },
    );

    const delivered = await syncGateway.syncAnalogPin(pin, clampedValue, {
      preventMqtt: options?.preventMqtt,
      autoOff: effectiveTimer,
      persistToCloud,
      qosOverride: options?.qosOverride,
      showToast,
    });

    if (delivered === false && persistToCloud) {
      setPinsState((prev) => rollbackSinglePinState(prev, pin, nextBoolState, prevState));
      useIoTStore.getState().setPinsAnalogValue((prev) => {
        if (prevAnalogValue === undefined) {
          if (!Object.hasOwn(prev, pin)) return prev;
          const next = { ...prev };
          delete next[pin];
          return next;
        }
        return prev[pin] === prevAnalogValue ? prev : { ...prev, [pin]: prevAnalogValue };
      });
      return false;
    }

    if (persistToCloud || clampedValue === 0) {
      clearTimerOverrides([pin]);
    }

    return delivered;
  } catch (error) {
    console.error("Failed to update analog pin value:", error);
    return false;
  } finally {
    if (persistToCloud) endLoading();
  }
}

export async function executeBatchPinUpdate(
  actions: Array<{ targetPin: string; actionOn: boolean }>,
  setPinsState: SetPinsStateFn,
  beginLoading: () => void,
  endLoading: () => void,
  syncGateway: IDeviceSyncPort = defaultDeviceSyncGateway,
): Promise<boolean> {
  if (actions.length === 0) return false;

  beginLoading();
  const initialStore = useIoTStore.getState();
  const initialPinsState = initialStore.pinsState;
  const previousSnapshots = new Map<string, boolean | undefined>();
  const stateUpdates: Record<string, boolean> = {};
  const analogUpdates: Record<string, number> = {};
  let hasAnalogUpdates = false;

  try {
    let soundPlayed = false;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      cancelAnalogRamp(action.targetPin);

      if (!previousSnapshots.has(action.targetPin)) {
        previousSnapshots.set(action.targetPin, initialPinsState[action.targetPin]);
      }

      if (action.actionOn !== initialPinsState[action.targetPin]) {
        soundPlayed = true;
      }

      stateUpdates[action.targetPin] = action.actionOn;

      const segment = initialStore.segments.find((s) => s.pin === action.targetPin);
      if (isAnalogOutputSegment(segment)) {
        analogUpdates[action.targetPin] = action.actionOn
          ? resolveRestoredAnalogDuty(action.targetPin)
          : 0;
        hasAnalogUpdates = true;
      }
    }

    if (soundPlayed) soundManager.playToggleOn();

    setPinsState((prev) => ({ ...prev, ...stateUpdates }));
    if (hasAnalogUpdates) {
      initialStore.setPinsAnalogValue((prev) => ({ ...prev, ...analogUpdates }));
    }

    const delivered = await syncGateway.syncBatchPins(actions);

    if (delivered === false) {
      setPinsState((prev) => rollbackBatchPinState(prev, previousSnapshots, stateUpdates));

      return false;
    }

    clearTimerOverrides(Object.keys(stateUpdates));
    return true;
  } catch (error) {
    console.error("Failed to update batch pin values:", error);
    setPinsState((prev) => rollbackBatchPinState(prev, previousSnapshots, stateUpdates));

    return false;
  } finally {
    endLoading();
  }
}

export interface MacroExecutionOutcome {
  plan: MacroExecutionPlan;
  delivered: boolean;
}

/**
 * Evaluates all per-action dashboard conditions on a custom button (macro),
 * dispatches only the passing digital (`0x08`) and analog PWM (`0x0A`) commands to ESP32,
 * and displays user-defined failure messages for any blocked action.
 */
export async function executeMacroActions(
  macro: Macro,
  setPinsState: SetPinsStateFn,
  showToast: ShowToastFn,
  beginLoading: () => void,
  endLoading: () => void,
  syncGateway: IDeviceSyncPort = defaultDeviceSyncGateway,
): Promise<MacroExecutionOutcome> {
  const store = useIoTStore.getState();
  const plan = evaluateMacroExecution(macro, {
    segments: store.segments,
    pinsState: store.pinsState,
    pinsAnalogValue: store.pinsAnalogValue,
    pinsPwmResolution: store.pinsPwmResolution,
    now: new Date(),
  });

  const dispatchPromises: Array<Promise<boolean>> = [];

  if (plan.digitalActions.length > 0) {
    dispatchPromises.push(
      executeBatchPinUpdate(
        plan.digitalActions,
        setPinsState,
        beginLoading,
        endLoading,
        syncGateway,
      ),
    );
  }

  if (plan.analogActions.length > 0) {
    if (plan.digitalActions.length === 0) {
      soundManager.playToggleOn();
    }

    for (let i = 0; i < plan.analogActions.length; i++) {
      const act = plan.analogActions[i];
      dispatchPromises.push(
        executeAnalogPinUpdate(
          act.targetPin,
          act.targetValue,
          { persistToCloud: true },
          setPinsState,
          showToast,
          beginLoading,
          endLoading,
          syncGateway,
        ),
      );
    }
  }

  if (plan.blockedActions.length > 0) {
    const uniqueMessages = Array.from(
      new Set(plan.blockedActions.map((item) => item.message.trim()).filter(Boolean)),
    );
    if (uniqueMessages.length > 0) {
      showToast(uniqueMessages.join(" • "), "error");
    }
  }

  if (dispatchPromises.length === 0) {
    return { plan, delivered: false };
  }

  const results = await Promise.all(dispatchPromises);
  const delivered = results.some(Boolean);

  return { plan, delivered };
}

export function usePinOperations() {
  const setPinsState = useIoTStore((state) => state.setPinsState);
  const showToast = useIoTStore((state) => state.showToast);
  // Keep in-flight tracking off React state so rapid relay clicks and PWM slider drags
  // never recreate DashboardContext and re-render the entire workspace tree twice per command.
  const inFlightCountRef = useRef(0);

  const beginLoading = useCallback(() => {
    inFlightCountRef.current += 1;
  }, []);

  const endLoading = useCallback(() => {
    inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadMqtt = () => {
      if (cancelled) return;
      void import("@/features/iot/services/mqtt/init").then(({ initMqtt }) => {
        if (!cancelled) {
          void initMqtt();
        }
      });
    };

    timeoutId = globalThis.setTimeout(() => {
      if (cancelled) return;

      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(loadMqtt, { timeout: 1000 });
      } else {
        loadMqtt();
      }
    }, 1500);

    const unsubscribe = onMqttStateChange((pin, state) => {
      setPinsState((prev) => (prev[pin] === state ? prev : { ...prev, [pin]: state }));
    });

    return () => {
      cancelled = true;

      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }

      unsubscribe();
    };
  }, [setPinsState]);

  const updatePinOnServer = useCallback(
    async (pin: string, pinState: boolean, preventMqtt: boolean = false, timer?: number) => {
      return executeSinglePinUpdate(
        pin,
        pinState,
        preventMqtt,
        timer,
        setPinsState,
        showToast,
        beginLoading,
        endLoading,
      );
    },
    [setPinsState, showToast, beginLoading, endLoading],
  );

  const handleTogglePin = useCallback(
    async (pin: string) => {
      const currentState = useIoTStore.getState().pinsState[pin];
      const nextState = !currentState;

      if (nextState) soundManager.playToggleOn();
      else soundManager.playToggleOff();

      return updatePinOnServer(pin, nextState, false);
    },
    [updatePinOnServer],
  );

  const handleSetPinState = useCallback(
    async (pin: string, state: boolean, preventMqtt: boolean = false) => {
      const currentState = useIoTStore.getState().pinsState[pin];

      if (state !== currentState) {
        if (state) soundManager.playToggleOn();
        else soundManager.playToggleOff();
      }

      return updatePinOnServer(pin, state, preventMqtt);
    },
    [updatePinOnServer],
  );

  const handleSetPinAnalogValue = useCallback(
    async (pin: string, value: number, options?: SetPinAnalogOptions) => {
      return executeAnalogPinUpdate(
        pin,
        value,
        options,
        setPinsState,
        showToast,
        beginLoading,
        endLoading,
      );
    },
    [setPinsState, showToast, beginLoading, endLoading],
  );

  const handleBatchPinState = useCallback(
    async (actions: Array<{ targetPin: string; actionOn: boolean }>) => {
      return executeBatchPinUpdate(actions, setPinsState, beginLoading, endLoading);
    },
    [setPinsState, beginLoading, endLoading],
  );

  const handleExecuteMacro = useCallback(
    async (macro: Macro) => {
      return executeMacroActions(macro, setPinsState, showToast, beginLoading, endLoading);
    },
    [setPinsState, showToast, beginLoading, endLoading],
  );

  const handleReadAnalogInput = useCallback(
    (pin: string): boolean => {
      if (!pin) return false;

      const delivered = defaultDeviceSyncGateway.readAnalogInput(pin);

      if (!delivered) {
        showToast("ارتباط با دستگاه (MQTT/سرور) برقرار نیست؛ خواندن آنی ارسال نشد.", "error");
      }

      return delivered;
    },
    [showToast],
  );

  return {
    isLoadingIoT: false,
    updatePinOnServer,
    handleTogglePin,
    handleSetPinState,
    handleSetPinAnalogValue,
    handleBatchPinState,
    handleExecuteMacro,
    handleReadAnalogInput,
  };
}
