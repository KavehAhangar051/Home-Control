"use client";

import { useCallback, useEffect, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { initMqtt, onMqttStateChange } from "@/features/iot/services/mqttService";
import { soundManager } from "@/lib/audio";
import { syncBatchPins, syncSinglePin } from "./core/pinSyncUtils";

interface UsePinOperationsProps {
  refetchIot: () => void;
}

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
  setIsLoadingIoT: (val: boolean) => void,
): Promise<void> {
  setIsLoadingIoT(true);

  try {
    setPinsState((prev) => ({ ...prev, [pin]: pinState }));
    const segment = useIoTStore.getState().segments.find((s) => s.pin === pin);
    const effectiveTimer = timer !== undefined ? timer : segment?.auto_off;

    await syncSinglePin(pin, pinState, {
      preventMqtt,
      autoOff: effectiveTimer,
      isPushMode: segment?.mode === "push",
      showToast,
    });
  } catch (error) {
    console.error("Failed to update pin value:", error);
  } finally {
    setIsLoadingIoT(false);
  }
}

async function executeBatchPinUpdate(
  actions: Array<{ targetPin: string; actionOn: boolean }>,
  setPinsState: SetPinsStateFn,
  setIsLoadingIoT: (val: boolean) => void,
): Promise<void> {
  setIsLoadingIoT(true);

  try {
    let soundPlayed = false;
    const stateUpdates: Record<string, boolean> = {};
    const pinsState = useIoTStore.getState().pinsState;

    for (const action of actions) {
      if (action.actionOn !== pinsState[action.targetPin]) {
        soundPlayed = true;
      }

      stateUpdates[action.targetPin] = action.actionOn;
    }

    if (soundPlayed) soundManager.playToggleOn();

    setPinsState((prev) => ({ ...prev, ...stateUpdates }));
    await syncBatchPins(actions);
  } catch (error) {
    console.error("Failed to update batch pin values:", error);
  } finally {
    setIsLoadingIoT(false);
  }
}

export function usePinOperations({ refetchIot: _refetchIot }: UsePinOperationsProps) {
  const setPinsState = useIoTStore((state) => state.setPinsState);
  const showToast = useIoTStore((state) => state.showToast);
  const [isLoadingIoT, setIsLoadingIoT] = useState(false);

  useEffect(() => {
    initMqtt();

    const unsubscribe = onMqttStateChange((pin, state) => {
      setPinsState((prev) => ({ ...prev, [pin]: state }));
    });

    return () => unsubscribe();
  }, [setPinsState]);

  const updatePinOnServer = useCallback(
    async (pin: string, pinState: boolean, preventMqtt: boolean = false, timer?: number) => {
      await executeSinglePinUpdate(
        pin,
        pinState,
        preventMqtt,
        timer,
        setPinsState,
        showToast,
        setIsLoadingIoT,
      );
    },
    [setPinsState, showToast],
  );

  const handleTogglePin = useCallback(
    async (pin: string) => {
      const currentState = useIoTStore.getState().pinsState[pin];
      const nextState = !currentState;

      if (nextState) soundManager.playToggleOn();
      else soundManager.playToggleOff();

      setPinsState((prev) => ({ ...prev, [pin]: nextState }));
      await updatePinOnServer(pin, nextState, false);
    },
    [setPinsState, updatePinOnServer],
  );

  const handleSetPinState = useCallback(
    async (pin: string, state: boolean, preventMqtt: boolean = false) => {
      const currentState = useIoTStore.getState().pinsState[pin];

      if (state !== currentState) {
        if (state) soundManager.playToggleOn();
        else soundManager.playToggleOff();
      }

      setPinsState((prev) => ({ ...prev, [pin]: state }));
      await updatePinOnServer(pin, state, preventMqtt);
    },
    [setPinsState, updatePinOnServer],
  );

  const handleBatchPinState = useCallback(
    async (actions: Array<{ targetPin: string; actionOn: boolean }>) => {
      await executeBatchPinUpdate(actions, setPinsState, setIsLoadingIoT);
    },
    [setPinsState],
  );

  return {
    isLoadingIoT,
    updatePinOnServer,
    handleTogglePin,
    handleSetPinState,
    handleBatchPinState,
  };
}
