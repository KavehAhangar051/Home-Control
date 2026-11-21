"use client";

import React from "react";

const getServerSnapshot = (): HTMLElement | null => null;

const registeredTargets = new Map<string, HTMLElement | null>();
const targetListeners = new Map<string, Set<() => void>>();

/**
 * Registers or unregisters a portal host element in O(1) time and notifies only
 * components subscribed to that specific `elementId`, avoiding a document-wide
 * `MutationObserver({ subtree: true })` on every DOM change (especially on mobile
 * where desktop-only portal hosts are intentionally unmounted).
 */
export function setPortalTarget(elementId: string, element: HTMLElement | null): void {
  const previous = registeredTargets.get(elementId) ?? null;

  if (element) {
    registeredTargets.set(elementId, element);
  } else {
    registeredTargets.delete(elementId);
  }

  if (previous === element) return;

  const listeners = targetListeners.get(elementId);

  if (!listeners) return;

  for (const listener of listeners) {
    listener();
  }
}

/**
 * Subscribes to a DOM portal target element by ID using `useSyncExternalStore`
 * so SSR stays consistent (`null`) and client mounting avoids `setState` inside `useEffect`
 * without attaching a `document.body` subtree MutationObserver.
 */
export function usePortalTarget(elementId: string): HTMLElement | null {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof document === "undefined") {
        return () => {};
      }

      let listeners = targetListeners.get(elementId);

      if (!listeners) {
        listeners = new Set();
        targetListeners.set(elementId, listeners);
      }

      listeners.add(onStoreChange);

      let rafId: number | null = null;

      if (registeredTargets.get(elementId) || document.getElementById(elementId)) {
        rafId = requestAnimationFrame(onStoreChange);
      }

      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);

        const activeListeners = targetListeners.get(elementId);

        if (activeListeners) {
          activeListeners.delete(onStoreChange);

          if (activeListeners.size === 0) {
            targetListeners.delete(elementId);
          }
        }
      };
    },
    [elementId],
  );

  const getSnapshot = React.useCallback((): HTMLElement | null => {
    if (typeof document === "undefined") return null;

    const registered = registeredTargets.get(elementId);

    if (registered?.isConnected) return registered;

    return document.getElementById(elementId);
  }, [elementId]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
