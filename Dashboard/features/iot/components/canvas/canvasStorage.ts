import {
  clampCanvasZoom,
  getCanvasSettingsStorageKey,
  getCanvasStorageKey,
  getCanvasViewportStorageKey,
  snapNodeRectToGrid,
} from "./canvasGeometry";
import type { CanvasNodeRect, CanvasSubMode, CanvasViewport } from "./canvasTypes";

export type CanvasWorkspaceScope = "home" | "workflows";

export interface StoredCanvasSettings {
  subMode: CanvasSubMode;
  snapToGrid: boolean;
  isLocked: boolean;
  cascadeGroupDrag: boolean;
}

const memoryNodesCache = new Map<CanvasSubMode, Record<string, CanvasNodeRect>>();
const memoryViewportCache = new Map<CanvasSubMode, CanvasViewport>();

/**
 * Reads persisted canvas settings for a workspace scope (`home` or `workflows`),
 * falling back to safe defaults on SSR or malformed storage data.
 */
export function readStoredCanvasSettings(scope: CanvasWorkspaceScope): StoredCanvasSettings {
  const defaultSubMode: CanvasSubMode = scope === "workflows" ? "graph" : "groups";

  if (typeof window === "undefined") {
    return {
      subMode: defaultSubMode,
      snapToGrid: true,
      isLocked: false,
      cascadeGroupDrag: true,
    };
  }

  try {
    const raw = window.localStorage.getItem(getCanvasSettingsStorageKey(scope));

    if (raw) {
      // SAFETY: JSON.parse output is validated field-by-field below
      const parsed = JSON.parse(raw) as Partial<StoredCanvasSettings>;

      const subMode: CanvasSubMode =
        scope === "workflows"
          ? "graph"
          : parsed.subMode === "segments" || parsed.subMode === "groups"
            ? parsed.subMode
            : "groups";

      return {
        subMode,
        snapToGrid: parsed.snapToGrid ?? true,
        isLocked: parsed.isLocked ?? false,
        cascadeGroupDrag: parsed.cascadeGroupDrag ?? true,
      };
    }
  } catch {
    // Ignore storage read errors
  }

  return {
    subMode: defaultSubMode,
    snapToGrid: true,
    isLocked: false,
    cascadeGroupDrag: true,
  };
}

export function writeStoredCanvasSettings(
  scope: CanvasWorkspaceScope,
  settings: StoredCanvasSettings,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getCanvasSettingsStorageKey(scope), JSON.stringify(settings));
  } catch {
    // Ignore storage write failures
  }
}

export function readStoredCanvasNodes(
  subMode: CanvasSubMode,
): Record<string, CanvasNodeRect> | null {
  const cached = memoryNodesCache.get(subMode);

  if (cached && Object.keys(cached).length > 0) {
    return cached;
  }

  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getCanvasStorageKey(subMode));

    if (!raw) return null;

    // SAFETY: localStorage payload is serialized from Record<string, CanvasNodeRect>
    const parsed = JSON.parse(raw) as Record<string, CanvasNodeRect>;

    if (parsed && !Array.isArray(parsed)) {
      memoryNodesCache.set(subMode, parsed);

      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }

  return null;
}

export function replaceStoredCanvasNodes(
  subMode: CanvasSubMode,
  nextNodes: Record<string, CanvasNodeRect>,
): void {
  const snapshot = { ...nextNodes };
  memoryNodesCache.set(subMode, snapshot);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getCanvasStorageKey(subMode), JSON.stringify(snapshot));
  } catch {
    // Ignore storage write errors
  }
}

export function writeStoredCanvasNodes(
  subMode: CanvasSubMode,
  nextNodes: Record<string, CanvasNodeRect>,
): void {
  const existing = readStoredCanvasNodes(subMode) ?? {};
  const merged = { ...existing, ...nextNodes };
  replaceStoredCanvasNodes(subMode, merged);
}

export interface ReconcileCanvasNodesParams {
  subMode: CanvasSubMode;
  defaults: Record<string, CanvasNodeRect>;
  storedNodes: Record<string, CanvasNodeRect>;
  prevNodes: Record<string, CanvasNodeRect>;
  snapToGrid: boolean;
  baseTopZIndex: number;
  hasEntities: boolean;
}

export interface ReconcileCanvasNodesResult {
  nodes: Record<string, CanvasNodeRect>;
  nextTopZIndex: number;
  shouldPersist: boolean;
}

/**
 * Reconciles persisted canvas node rects against the active entity defaults,
 * pruning deleted group/segment keys and preserving user-positioned geometry.
 */
export function reconcileCanvasNodes({
  subMode,
  defaults,
  storedNodes,
  prevNodes,
  snapToGrid,
  baseTopZIndex,
  hasEntities,
}: ReconcileCanvasNodesParams): ReconcileCanvasNodesResult {
  if (!hasEntities) {
    return {
      nodes: {},
      nextTopZIndex: baseTopZIndex,
      shouldPersist: false,
    };
  }

  const next: Record<string, CanvasNodeRect> = {};
  let maxZ = baseTopZIndex;
  let shouldPersist = false;

  for (const key of Object.keys(storedNodes)) {
    if (!Object.hasOwn(defaults, key)) {
      shouldPersist = true;
      break;
    }
  }

  if (!shouldPersist) {
    for (const key of Object.keys(prevNodes)) {
      if (!Object.hasOwn(defaults, key)) {
        shouldPersist = true;
        break;
      }
    }
  }

  for (const [id, defRect] of Object.entries(defaults)) {
    const existing = prevNodes[id] ?? storedNodes[id];

    if (existing) {
      const nodeKind = id.startsWith("group:") ? "group" : "segment";
      const resolved = snapToGrid ? snapNodeRectToGrid(existing, nodeKind, subMode) : existing;

      if (
        resolved.x !== existing.x ||
        resolved.y !== existing.y ||
        resolved.width !== existing.width ||
        resolved.height !== existing.height
      ) {
        shouldPersist = true;
      }

      next[id] = resolved;
      maxZ = Math.max(maxZ, Number.isFinite(resolved.zIndex) ? resolved.zIndex : 1);
    } else {
      next[id] = defRect;
      maxZ = Math.max(maxZ, Number.isFinite(defRect.zIndex) ? defRect.zIndex : 1);
      shouldPersist = true;
    }
  }

  return {
    nodes: next,
    nextTopZIndex: maxZ + 1,
    shouldPersist,
  };
}

export function readStoredCanvasViewport(subMode: CanvasSubMode): CanvasViewport | null {
  const cached = memoryViewportCache.get(subMode);

  if (cached) return cached;

  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getCanvasViewportStorageKey(subMode));

    if (!raw) return null;

    // SAFETY: JSON.parse output is validated with Number.isFinite checks below
    const parsed = JSON.parse(raw) as Partial<CanvasViewport>;

    if (
      parsed.x !== undefined &&
      parsed.y !== undefined &&
      parsed.zoom !== undefined &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y) &&
      Number.isFinite(parsed.zoom)
    ) {
      const valid: CanvasViewport = {
        x: Math.round(parsed.x),
        y: Math.round(parsed.y),
        zoom: clampCanvasZoom(parsed.zoom),
      };

      memoryViewportCache.set(subMode, valid);

      return valid;
    }
  } catch {
    // Ignore storage read errors
  }

  return null;
}

export function writeStoredCanvasViewport(subMode: CanvasSubMode, vp: CanvasViewport): void {
  memoryViewportCache.set(subMode, vp);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getCanvasViewportStorageKey(subMode), JSON.stringify(vp));
  } catch {
    // Ignore storage write errors
  }
}

export function clearStoredCanvasMode(subMode: CanvasSubMode): void {
  memoryNodesCache.delete(subMode);
  memoryViewportCache.delete(subMode);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getCanvasStorageKey(subMode));
    window.localStorage.removeItem(getCanvasViewportStorageKey(subMode));
  } catch {
    // Ignore storage remove errors
  }
}
