import { useCallback, useSyncExternalStore } from "react";

const getServerSnapshot = () => false;

interface MediaQueryEntry {
  mql: MediaQueryList;
  listeners: Set<() => void>;
  handler: () => void;
}

const mediaQueryRegistry = new Map<string, MediaQueryEntry>();

function getOrCreateEntry(query: string): MediaQueryEntry {
  let entry = mediaQueryRegistry.get(query);

  if (!entry) {
    const mql = window.matchMedia(query);
    const listeners = new Set<() => void>();
    const handler = () => {
      for (const listener of listeners) {
        listener();
      }
    };
    entry = { mql, listeners, handler };
    mediaQueryRegistry.set(query, entry);
  }

  return entry;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const entry = getOrCreateEntry(query);

      if (entry.listeners.size === 0) {
        entry.mql.addEventListener("change", entry.handler);
      }

      entry.listeners.add(onStoreChange);

      return () => {
        entry.listeners.delete(onStoreChange);

        if (entry.listeners.size === 0) {
          entry.mql.removeEventListener("change", entry.handler);
          mediaQueryRegistry.delete(query);
        }
      };
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;

    return getOrCreateEntry(query).mql.matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
