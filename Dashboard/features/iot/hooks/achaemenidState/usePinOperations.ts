"use client";

import { useCallback, useEffect, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { initMqtt, onMqttStateChange } from "@/features/iot/services/mqttService";
import { soundManager } from "@/lib/audio";
import { syncBatchPins, syncSinglePin } from "./core/pinSyncUtils";

type SetPinsStateFn = (
  updater: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>),
) => void;

type ShowToastFn = (message: string, type: "success" | "error") => void;

async function executeSinglePinUpdate(
  pin: string,
  pinState: boolean,
  preventMqtt: boolean,
  timer: number | undefined,
  setPinsState: SetPinsStateFn,
  showToast: ShowToastFn,
  beginLoading: () => void,
  endLoading: () => void,
): Promise<boolean> {
  if (!pin) return false;

  beginLoading();
  const prevState = useIoTStore.getState().pinsState[pin];

  try {
    setPinsState((prev) => (prev[pin] === pinState ? prev : { ...prev, [pin]: pinState }));
    const segment = useIoTStore.getState().segments.find((s) => s.pin === pin);
    const effectiveTimer = timer !== undefined ? timer : segment?.auto_off;

    const delivered = await syncSinglePin(pin, pinState, {
      preventMqtt,
      autoOff: effectiveTimer,
      isPushMode: segment?.mode === "push",
      showToast,
    });

    if (delivered === false) {
      setPinsState((prev) => {
        if (prev[pin] !== pinState) return prev;

        if (prevState === undefined) {
          const next = { ...prev };
          delete next[pin];

          return next;
        }

        return { ...prev, [pin]: prevState };
      });

      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update pin value:", error);
    setPinsState((prev) => {
      if (prev[pin] !== pinState) return prev;

      if (prevState === undefined) {
        const next = { ...prev };
        delete next[pin];

        return next;
      }

      return { ...prev, [pin]: prevState };
    });

    return false;
  } finally {
    endLoading();
  }
}

async function executeBatchPinUpdate(
  actions: Array<{ targetPin: string; actionOn: boolean }>,
  setPinsState: SetPinsStateFn,
  beginLoading: () => void,
  endLoading: () => void,
): Promise<boolean> {
  if (actions.length === 0) return false;

  beginLoading();
  const initialPinsState = useIoTStore.getState().pinsState;
  const previousSnapshots = new Map<string, boolean | undefined>();

  try {
    let soundPlayed = false;
    const stateUpdates: Record<string, boolean> = {};

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
    const delivered = await syncBatchPins(actions);

    if (delivered === false) {
      setPinsState((prev) => {
        const next = { ...prev };

        for (const [pinKey, prevVal] of previousSnapshots) {
          if (next[pinKey] === stateUpdates[pinKey]) {
            if (prevVal === undefined) {
              delete next[pinKey];
            } else {
              next[pinKey] = prevVal;
            }
          }
        }

        return next;
      });

      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update batch pin values:", error);

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
