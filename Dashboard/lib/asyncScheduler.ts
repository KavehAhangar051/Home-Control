/**
 * Lightweight browser idle scheduling & coalesced localStorage persistence helpers.
 * Moves non-urgent JSON serialization and synchronous Web Storage writes off interactive
 * 60 FPS animation/gesture frames while guaranteeing flush on page hide / tab close.
 */

type IdleHandle =
  | { kind: "idle"; id: number }
  | { kind: "timeout"; id: ReturnType<typeof setTimeout> };

interface PendingStorageWrite {
  serialize: () => string;
  cancelIdle: () => void;
  onError?: (error: unknown) => void;
}

const pendingStorageWrites = new Map<string, PendingStorageWrite>();
let lifecycleFlushBound = false;

interface PrioritizedScheduler {
  yield?: () => Promise<void>;
}

/**
 * Cooperatively yields control back to the browser main thread so pending input,
 * paint, and compositor frames execute before heavy async serialization or work.
 * Uses native `scheduler.yield()` when supported, falling back to a macrotask turn.
 */
export function yieldToMain(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const schedulerApi = (globalThis as { scheduler?: PrioritizedScheduler }).scheduler;

  if (typeof schedulerApi?.yield === "function") {
    return schedulerApi.yield();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Schedules a non-urgent task during browser idle time with a bounded deadline fallback.
 * Returns a cancel function safe to call multiple times.
 */
export function scheduleIdleTask(callback: () => void, timeoutMs = 1500): () => void {
  if (typeof window === "undefined") {
    callback();

    return () => {};
  }

  let active = true;
  let handle: IdleHandle;

  const run = () => {
    if (!active) return;
    active = false;
    callback();
  };

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: timeoutMs });
    handle = { kind: "idle", id };
  } else {
    const id = setTimeout(run, 32);
    handle = { kind: "timeout", id };
  }

  return () => {
    if (!active) return;
    active = false;

    if (handle.kind === "idle" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(handle.id);
    } else if (handle.kind === "timeout") {
      clearTimeout(handle.id);
    }
  };
}

function writeStorageKeyNow(
  key: string,
  serialize: () => string,
  onError?: (error: unknown) => void,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, serialize());
  } catch (error) {
    onError?.(error);
  }
}

/**
 * Immediately flushes all queued idle localStorage writes (invoked automatically on
 * `pagehide` and when the document becomes hidden so no user state is lost).
 */
export function flushIdleStorageWrites(): void {
  if (pendingStorageWrites.size === 0) return;

  const entries = Array.from(pendingStorageWrites.entries());
  pendingStorageWrites.clear();

  for (let i = 0; i < entries.length; i++) {
    const [key, entry] = entries[i];
    entry.cancelIdle();
    writeStorageKeyNow(key, entry.serialize, entry.onError);
  }
}

function ensureLifecycleFlushListeners(): void {
  if (lifecycleFlushBound || typeof window === "undefined") return;
  lifecycleFlushBound = true;

  window.addEventListener("pagehide", flushIdleStorageWrites);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushIdleStorageWrites();
      }
    });
  }
}

/**
 * Cancels any pending idle write for `key` (call before `localStorage.removeItem(key)`
 * so a queued write cannot resurrect a cleared entry).
 */
export function cancelIdleStorageWrite(key: string): void {
  const existing = pendingStorageWrites.get(key);

  if (!existing) return;

  existing.cancelIdle();
  pendingStorageWrites.delete(key);
}

/**
 * Coalesces `localStorage.setItem(key, serialize())` into a single browser idle slice.
 * Serialization (`JSON.stringify`) is deferred until the idle callback fires, keeping
 * 60 FPS pointer/slider/drag frames completely free of synchronous serialization stalls.
 */
export function scheduleIdleStorageWrite(
  key: string,
  serialize: () => string,
  options?: { timeoutMs?: number; onError?: (error: unknown) => void },
): void {
  if (typeof window === "undefined") return;

  ensureLifecycleFlushListeners();

  const existing = pendingStorageWrites.get(key);

  if (existing) {
    existing.cancelIdle();
  }

  const cancelIdle = scheduleIdleTask(() => {
    const current = pendingStorageWrites.get(key);

    if (!current || current.cancelIdle !== cancelIdle) return;

    pendingStorageWrites.delete(key);
    writeStorageKeyNow(key, current.serialize, current.onError);
  }, options?.timeoutMs ?? 1500);

  pendingStorageWrites.set(key, {
    serialize,
    cancelIdle,
    onError: options?.onError,
  });
}
