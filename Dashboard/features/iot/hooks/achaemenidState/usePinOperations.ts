"use client";

import { useCallback, useEffect, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { defaultDeviceSyncGateway } from "@/features/iot/services/deviceGatewayAdapter";
import { initMqtt, onMqttStateChange } from "@/features/iot/services/mqttService";
import type { IDeviceSyncPort } from "@/features/iot/services/ports";
import { soundManager } from "@/lib/audio";

type SetPinsStateFn = (
  updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
) => void;

type ShowToastFn = (message: string, type: "success" | "error") => void;

export function rollbackSinglePinState(
  prev: Record<string, boolean>,
  pin: string,
  attemptedState: boolean,
  prevState: boolean | undefined,
): Record<string, boolean> {
  if (prev[pin] !== attemptedState) return prev;

  if (prevState === undefined) {
    const next = { ...prev };
    delete next[pin];

    return next;
  }

  return { ...prev, [pin]: prevState };
}

export function rollbackBatchPinState(
  prev: Record<string, boolean>,
  previousSnapshots: ReadonlyMap<string, boolean | undefined>,
  attemptedUpdates: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const next = { ...prev };
  let changed = false;

  for (const [pinKey, prevVal] of previousSnapshots) {
    if (next[pinKey] === attemptedUpdates[pinKey]) {
      changed = true;

      if (prevVal === undefined) {
        delete next[pinKey];
      } else {
        next[pinKey] = prevVal;
      }
    }
  }

  return changed ? next : prev;
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
    initMqtt();

    const unsubscribe = onMqttStateChange((pin, state) => {
      setPinsState((prev) => (prev[pin] === state ? prev : { ...prev, [pin]: state }));
    });

    return () => unsubscribe();
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
