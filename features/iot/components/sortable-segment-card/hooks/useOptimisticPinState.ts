"use client";

import { useCallback, useState } from "react";

interface UseOptimisticPinStateParams {
  isPinOn: boolean;
  onTogglePin: (pin: string) => unknown;
  onSetPinState?: (pin: string, state: boolean, preventMqtt?: boolean) => unknown;
}

/**
 * Tracks per-card in-flight command state while delegating optimistic pin state
 * directly to `executeSinglePinUpdate` on `useIoTStore`.
 *
 * IMPORTANT: Do NOT wrap external Zustand store updates (`onTogglePin` / `onSetPinState`)
 * in React's `startTransition`. `DashboardWorkspace` is wrapped in Motion's `<AnimateView>`
 * (built on React 19.3 `<ViewTransition>`), which triggers a full-workspace browser
 * `document.startViewTransition()` whenever any `TransitionLane` commits inside its subtree
 * (e.g., when the Cloudflare pin-save request resolves and displays the toast).
 */
export function useOptimisticPinState({
  isPinOn,
  onTogglePin,
  onSetPinState,
}: UseOptimisticPinStateParams) {
  const [pendingCount, setPendingCount] = useState(0);

  const handleTogglePinOptimistic = useCallback(
    (pin: string) => {
      setPendingCount((c) => c + 1);
      void Promise.resolve(onTogglePin(pin)).finally(() => {
        setPendingCount((c) => Math.max(0, c - 1));
      });
    },
    [onTogglePin],
  );

  const handleSetPinStateOptimistic = useCallback(
    (pin: string, state: boolean, preventMqtt?: boolean) => {
      if (!onSetPinState) return;

      setPendingCount((c) => c + 1);
      void Promise.resolve(onSetPinState(pin, state, preventMqtt)).finally(() => {
        setPendingCount((c) => Math.max(0, c - 1));
      });
    },
    [onSetPinState],
  );

  return {
    effectivePinOn: isPinOn,
    isPending: pendingCount > 0,
    handleTogglePinOptimistic,
    handleSetPinStateOptimistic,
  };
}
