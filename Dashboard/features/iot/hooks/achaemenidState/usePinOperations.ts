"use client";

import { useCallback, useEffect, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { defaultDeviceSyncGateway } from "@/features/iot/services/deviceGatewayAdapter";
import { onMqttStateChange } from "@/features/iot/services/mqtt/client";
import type { IDeviceSyncPort } from "@/features/iot/services/ports";
import { soundManager } from "@/lib/audio";

type SetPinsStateFn = (
  updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
) => void;

type ShowToastFn = (message: string, type: "success" | "error") => void;

export interface PinsStateMap {
  [pin: string]: boolean;
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

  beginLoading();
  const prevState = useIoTStore.getState().pinsState[pin];

  try {
    setPinsState((prev) => (prev[pin] === pinState ? prev : { ...prev, [pin]: pinState }));
    const segment = useIoTStore.getState().segments.find((s) => s.pin === pin);
    const effectiveTimer = timer !== undefined ? timer : segment?.auto_off;

    const delivered = await syncGateway.syncSinglePin(pin, pinState, {
      preventMqtt,
      autoOff: effectiveTimer,
      isPushMode: segment?.mode === "push",
      showToast,
    });

    if (delivered === false) {
      setPinsState((prev) => rollbackSinglePinState(prev, pin, pinState, prevState));

      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update pin value:", error);
    setPinsState((prev) => rollbackSinglePinState(prev, pin, pinState, prevState));

    return false;
  } finally {
    endLoading();
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
  const initialPinsState = useIoTStore.getState().pinsState;
  const previousSnapshots = new Map<string, boolean | undefined>();
  const stateUpdates: Record<string, boolean> = {};

  try {
    let soundPlayed = false;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      if (!previousSnapshots.has(action.targetPin)) {
        previousSnapshots.set(action.targetPin, initialPinsState[action.targetPin]);
      }

      if (action.actionOn !== initialPinsState[action.targetPin]) {
        soundPlayed = true;
      }

      stateUpdates[action.targetPin] = action.actionOn;
    }

    if (soundPlayed) soundManager.playToggleOn();

    setPinsState((prev) => ({ ...prev, ...stateUpdates }));
    const delivered = await syncGateway.syncBatchPins(actions);

    if (delivered === false) {
      setPinsState((prev) => rollbackBatchPinState(prev, previousSnapshots, stateUpdates));

      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update batch pin values:", error);
    setPinsState((prev) => rollbackBatchPinState(prev, previousSnapshots, stateUpdates));

    return false;
  } finally {
    endLoading();
  }
}

export function usePinOperations() {
  const setPinsState = useIoTStore((state) => state.setPinsState);
  const showToast = useIoTStore((state) => state.showToast);
  const [inFlightCount, setInFlightCount] = useState(0);

  const beginLoading = useCallback(() => {
    setInFlightCount((c) => c + 1);
  }, []);

  const endLoading = useCallback(() => {
    setInFlightCount((c) => Math.max(0, c - 1));
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

  const handleBatchPinState = useCallback(
    async (actions: Array<{ targetPin: string; actionOn: boolean }>) => {
      return executeBatchPinUpdate(actions, setPinsState, beginLoading, endLoading);
    },
    [setPinsState, beginLoading, endLoading],
  );

  return {
    isLoadingIoT: inFlightCount > 0,
    updatePinOnServer,
    handleTogglePin,
    handleSetPinState,
    handleBatchPinState,
  };
}
