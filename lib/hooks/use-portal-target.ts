"use client";

import React from "react";

const getServerSnapshot = (): HTMLElement | null => null;

/**
 * Subscribes to a DOM portal target element by ID using `useSyncExternalStore`
 * so SSR stays consistent (`null`) and client mounting avoids `setState` inside `useEffect`.
 */
export function usePortalTarget(elementId: string): HTMLElement | null {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof document === "undefined") {
        return () => {};
      }

      if (document.getElementById(elementId)) {
        const rafId = requestAnimationFrame(onStoreChange);

        return () => cancelAnimationFrame(rafId);
      }

      const observer = new MutationObserver(() => {
        if (document.getElementById(elementId)) {
          observer.disconnect();
          onStoreChange();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      return () => observer.disconnect();
    },
    [elementId],
  );

  const getSnapshot = React.useCallback((): HTMLElement | null => {
    if (typeof document === "undefined") return null;

    return document.getElementById(elementId);
  }, [elementId]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
