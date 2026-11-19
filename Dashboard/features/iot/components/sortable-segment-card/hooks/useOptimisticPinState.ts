"use client";

import { useCallback, useOptimistic, useTransition } from "react";

interface UseOptimisticPinStateParams {
  isPinOn: boolean;
  onTogglePin: (pin: string) => unknown;
  onSetPinState?: (pin: string, state: boolean, preventMqtt?: boolean) => unknown;
}

/**
 * Wraps authoritative ESP32/MQTT pin state with React 19 `useOptimistic` + `useTransition`.
 * Immediately paints the toggled state on press while awaiting device confirmation,
 * automatically rolling back to `isPinOn` if the command fails or is rejected.
 */
export function useOptimisticPinState({
  isPinOn,
  onTogglePin,
  onSetPinState,
}: UseOptimisticPinStateParams) {
  const [optimisticPinOn, setOptimisticPinOn] = useOptimistic<boolean, boolean>(
    isPinOn,
    (_current, nextState) => nextState,
  );
  const [isPending, startTransition] = useTransition();

  const handleTogglePinOptimistic = useCallback(
    (pin: string) => {
      const nextState = !optimisticPinOn;

      startTransition(async () => {
        setOptimisticPinOn(nextState);
        await onTogglePin(pin);
      });
    },
    [onTogglePin, optimisticPinOn, setOptimisticPinOn],
  );

  const handleSetPinStateOptimistic = useCallback(
    (pin: string, state: boolean, preventMqtt?: boolean) => {
      if (!onSetPinState) return;

      startTransition(async () => {
        setOptimisticPinOn(state);
        await onSetPinState(pin, state, preventMqtt);
      });
    },
    [onSetPinState, setOptimisticPinOn],
  );

  return {
    effectivePinOn: optimisticPinOn,
    isPending,
    handleTogglePinOptimistic,
    handleSetPinStateOptimistic,
  };
}
