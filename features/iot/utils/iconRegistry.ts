/**
 * Framework-agnostic lazy icon registry with in-flight deduplication and
 * subscription notifications for `useSyncExternalStore`.
 */
export type IconLoader<T> = () => Promise<T>;

export interface LazyIconRegistry<T> {
  hasIcon: (name?: string) => boolean;
  getResolved: (name: string) => T | null;
  getFallback: () => T;
  loadIcon: (name: string) => Promise<T>;
  preloadIcons: (names: readonly string[]) => void;
  subscribe: (listener: () => void) => () => void;
  getAvailableNames: () => string[];
}

export function createLazyIconRegistry<T>(
  staticIcons: Record<string, T>,
  loaders: Record<string, IconLoader<T>>,
  fallbackKey: string,
): LazyIconRegistry<T> {
  const fallback = staticIcons[fallbackKey];
  const resolved = new Map<string, T>(Object.entries(staticIcons));
  const inFlight = new Map<string, Promise<T>>();
  const listeners = new Set<() => void>();
  const availableNames = [...Object.keys(staticIcons), ...Object.keys(loaders)];

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const hasIcon = (name?: string): boolean =>
    Boolean(name && (Object.hasOwn(staticIcons, name) || Object.hasOwn(loaders, name)));

  const getResolved = (name: string): T | null => resolved.get(name) ?? null;

  const getFallback = (): T => fallback;

  const loadIcon = (name: string): Promise<T> => {
    const cached = resolved.get(name);

    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    const loader = Object.hasOwn(loaders, name) ? loaders[name] : undefined;

    if (!loader) {
      return Promise.resolve(fallback);
    }

    const existingPromise = inFlight.get(name);

    if (existingPromise) {
      return existingPromise;
    }

    const promise = loader()
      .then((icon) => {
        resolved.set(name, icon);
        notify();

        return icon;
      })
      .catch(() => {
        resolved.set(name, fallback);
        notify();

        return fallback;
      })
      .finally(() => {
        inFlight.delete(name);
      });

    inFlight.set(name, promise);

    return promise;
  };

  const preloadIcons = (names: readonly string[]) => {
    for (const name of names) {
      if (Object.hasOwn(loaders, name) && !resolved.has(name) && !inFlight.has(name)) {
        void loadIcon(name);
      }
    }
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const getAvailableNames = () => availableNames;

  return {
    hasIcon,
    getResolved,
    getFallback,
    loadIcon,
    preloadIcons,
    subscribe,
    getAvailableNames,
  };
}
