import type { Segment } from "@/features/iot/hooks/store/types";
import type {
  CanvasNodeRect,
  CanvasSizePreset,
  CanvasSubMode,
  CanvasViewport,
} from "./canvasTypes";

export const CANVAS_GRID_STEP = 16;
export const CANVAS_MIN_ZOOM = 0.35;
export const CANVAS_MAX_ZOOM = 2.0;
export const CANVAS_STORAGE_VERSION = 1;

const WIRE_MIN_CONTROL_OFFSET = 56;
const WIRE_MAX_CONTROL_OFFSET = 180;
const FIT_DEFAULT_MIN_BOUNDS_WIDTH = 160;
const FIT_DEFAULT_MIN_BOUNDS_HEIGHT = 120;
const FIT_MIN_AVAILABLE_EXTENT = 120;
const FIT_DEFAULT_MAX_ZOOM = 1.15;

export function getCanvasStorageKey(subMode: CanvasSubMode): string {
  return `iot_canvas_sheet_${subMode}_v${CANVAS_STORAGE_VERSION}`;
}

export function getCanvasViewportStorageKey(subMode: CanvasSubMode): string {
  return `iot_canvas_viewport_${subMode}_v${CANVAS_STORAGE_VERSION}`;
}

export function getCanvasSettingsStorageKey(scope: "home" | "workflows" = "home"): string {
  return `iot_canvas_settings_${scope}_v${CANVAS_STORAGE_VERSION}`;
}

export function canvasGroupNodeId(groupName: string): string {
  return `group:${groupName}`;
}

export function canvasSegmentNodeId(segmentId: string): string {
  return `segment:${segmentId}`;
}

export function clampCanvasZoom(zoom: number): number {
  if (Number.isNaN(zoom) || !Number.isFinite(zoom)) return 1;

  return Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, Math.round(zoom * 100) / 100));
}

export function snapCanvasCoordinate(value: number, snapEnabled: boolean): number {
  if (!snapEnabled) return Math.round(value);

  return Math.round(value / CANVAS_GRID_STEP) * CANVAS_GRID_STEP;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface CanvasGridStyle {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
}

/**
 * Computes CSS background dot-grid styling whose visual dots sit directly on
 * snapped (k * CANVAS_GRID_STEP, m * CANVAS_GRID_STEP) world intersections at any zoom.
 */
export function getCanvasGridStyle(x: number, y: number, zoom: number): CanvasGridStyle {
  const safeZoom = clampCanvasZoom(zoom);
  const rawStep = CANVAS_GRID_STEP * safeZoom;
  // Double only when zoomed far out so dots stay locked to exact 2x snap intersections
  const visualStep = rawStep < 8 ? rawStep * 2 : rawStep;
  const halfStep = visualStep / 2;
  const posX = (((x % visualStep) + visualStep) % visualStep) - halfStep;
  const posY = (((y % visualStep) + visualStep) % visualStep) - halfStep;

  return {
    backgroundImage: "radial-gradient(circle, var(--border-color) 1.25px, transparent 1.25px)",
    backgroundSize: `${visualStep}px ${visualStep}px`,
    backgroundPosition: `${posX}px ${posY}px`,
  };
}

/**
 * Enforces minimum and maximum bounds for group and segment nodes on the sheet
 * according to the active sub-mode so nodes remain legible and aligned on the 16px grid.
 */
export function clampCanvasNodeSize(
  kind: "group" | "segment",
  subMode: CanvasSubMode,
  width: number,
  height: number,
  snapEnabled = false,
): CanvasDimensions {
  const minWidth = kind === "group" ? (subMode === "groups" ? 256 : 208) : 160;
  const maxWidth = kind === "group" ? (subMode === "groups" ? 960 : 480) : 512;
  const minHeight = kind === "group" ? (subMode === "groups" ? 192 : 128) : 112;
  const maxHeight = kind === "group" ? (subMode === "groups" ? 864 : 336) : 416;

  const rawWidth = Math.min(maxWidth, Math.max(minWidth, width));
  const rawHeight = Math.min(maxHeight, Math.max(minHeight, height));

  return {
    width: snapCanvasCoordinate(rawWidth, snapEnabled),
    height: snapCanvasCoordinate(rawHeight, snapEnabled),
  };
}

/**
 * Normalizes a persisted node rectangle onto the 16px snap lattice while enforcing mode bounds.
 */
export function snapNodeRectToGrid(
  rect: CanvasNodeRect,
  kind: "group" | "segment",
  subMode: CanvasSubMode,
): CanvasNodeRect {
  const clamped = clampCanvasNodeSize(kind, subMode, rect.width, rect.height, true);

  return {
    ...rect,
    x: snapCanvasCoordinate(rect.x, true),
    y: snapCanvasCoordinate(rect.y, true),
    width: clamped.width,
    height: clamped.height,
  };
}

export function getPresetDimensions(
  kind: "group" | "segment",
  subMode: CanvasSubMode,
  preset: CanvasSizePreset,
  segmentCount = 2,
): CanvasDimensions {
  if (kind === "segment") {
    if (preset === "sm") return { width: 176, height: 112 };

    if (preset === "lg") return { width: 304, height: 192 };

    return { width: 224, height: 144 };
  }

  if (subMode === "graph") {
    if (preset === "sm") return { width: 224, height: 144 };

    if (preset === "lg") return { width: 336, height: 192 };

    return { width: 272, height: 160 };
  }

  const rows = Math.max(
    1,
    Math.ceil(segmentCount / (preset === "lg" ? 3 : preset === "md" ? 2 : 1)),
  );

  if (preset === "sm") {
    return { width: 288, height: Math.min(640, 80 + rows * 128) };
  }

  if (preset === "lg") {
    return { width: 640, height: Math.min(768, 96 + rows * 144) };
  }

  return { width: 432, height: Math.min(688, 96 + rows * 128) };
}

function groupSegmentsByGroupName(
  groupsOrder: string[],
  segments: Segment[],
): Map<string, Segment[]> {
  const segmentsByGroup = new Map<string, Segment[]>();

  for (const groupName of groupsOrder) {
    segmentsByGroup.set(groupName, []);
  }

  for (const seg of segments) {
    const groupKey = seg.group || "Test";
    const list = segmentsByGroup.get(groupKey);

    if (list) {
      list.push(seg);
    } else {
      segmentsByGroup.set(groupKey, [seg]);
    }
  }

  return segmentsByGroup;
}

function buildDefaultGraphNodes(
  segmentsByGroup: Map<string, Segment[]>,
  isMobileViewport: boolean,
): Record<string, CanvasNodeRect> {
  const nodes: Record<string, CanvasNodeRect> = {};
  let zCursor = 1;
  let currentY = 64;
  const groupX = isMobileViewport ? 352 : 688;
  const groupWidth = isMobileViewport ? 240 : 272;
  const groupHeight = 160;
  const segWidth = isMobileViewport ? 176 : 224;
  const segHeight = 128;
  const segGapX = 32;
  const segGapY = 16;
  const segCols = isMobileViewport ? 1 : 2;

  for (const [groupName, groupSegments] of segmentsByGroup.entries()) {
    const gId = canvasGroupNodeId(groupName);
    const rows = Math.max(1, Math.ceil(groupSegments.length / segCols));
    const clusterHeight = Math.max(groupHeight, rows * segHeight + (rows - 1) * segGapY);

    const groupY = snapCanvasCoordinate(
      currentY + Math.max(0, Math.round((clusterHeight - groupHeight) / 2)),
      true,
    );

    nodes[gId] = {
      x: snapCanvasCoordinate(groupX, true),
      y: groupY,
      width: groupWidth,
      height: groupHeight,
      zIndex: zCursor++,
    };

    for (let i = 0; i < groupSegments.length; i++) {
      const seg = groupSegments[i];
      const col = i % segCols;
      const row = Math.floor(i / segCols);
      const segX = groupX - 80 - (col + 1) * segWidth - col * segGapX;
      const segY = currentY + row * (segHeight + segGapY);

      nodes[canvasSegmentNodeId(seg.id)] = {
        x: snapCanvasCoordinate(segX, true),
        y: snapCanvasCoordinate(segY, true),
        width: segWidth,
        height: segHeight,
        zIndex: zCursor++,
      };
    }

    currentY += clusterHeight + 64;
  }

  return nodes;
}

function buildDefaultGroupContainerNodes(
  segmentsByGroup: Map<string, Segment[]>,
  groupsOrder: string[],
  isMobileViewport: boolean,
): Record<string, CanvasNodeRect> {
  const nodes: Record<string, CanvasNodeRect> = {};
  let zCursor = 1;
  const cols = isMobileViewport ? 1 : Math.min(2, Math.max(1, groupsOrder.length));
  const colWidth = isMobileViewport ? 320 : 448;
  const gapX = 32;
  const gapY = 32;
  const colHeights = Array.from({ length: cols }, () => 48);
  let idx = 0;

  for (const [groupName, groupSegments] of segmentsByGroup.entries()) {
    const col = idx % cols;
    const internalCols = isMobileViewport ? 1 : 2;
    const rows = Math.max(1, Math.ceil(groupSegments.length / internalCols));
    const height = Math.min(640, Math.max(192, 80 + rows * 128));
    const x = 48 + col * (colWidth + gapX);
    const y = colHeights[col];

    nodes[canvasGroupNodeId(groupName)] = {
      x: snapCanvasCoordinate(x, true),
      y: snapCanvasCoordinate(y, true),
      width: colWidth,
      height: snapCanvasCoordinate(height, true),
      zIndex: zCursor++,
    };

    colHeights[col] = y + height + gapY;
    idx++;
  }

  return nodes;
}

function buildDefaultFreeSegmentNodes(
  segments: Segment[],
  isMobileViewport: boolean,
): Record<string, CanvasNodeRect> {
  const nodes: Record<string, CanvasNodeRect> = {};
  let zCursor = 1;
  const cols = isMobileViewport
    ? 2
    : Math.min(4, Math.max(2, Math.ceil(Math.sqrt(segments.length))));

  const cardWidth = isMobileViewport ? 176 : 224;
  const cardHeight = isMobileViewport ? 128 : 144;
  const gap = isMobileViewport ? 16 : 32;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    nodes[canvasSegmentNodeId(seg.id)] = {
      x: snapCanvasCoordinate(48 + col * (cardWidth + gap), true),
      y: snapCanvasCoordinate(48 + row * (cardHeight + gap), true),
      width: cardWidth,
      height: cardHeight,
      zIndex: zCursor++,
    };
  }

  return nodes;
}

/**
 * Builds deterministic initial node positions and dimensions on the infinite sheet
 * for all three sub-modes ("graph" n8n mode, "groups" container mode, "segments" free mode).
 */
export function buildDefaultCanvasNodes(
  subMode: CanvasSubMode,
  groupsOrder: string[],
  segments: Segment[],
  isMobileViewport = false,
): Record<string, CanvasNodeRect> {
  if (subMode === "segments") {
    return buildDefaultFreeSegmentNodes(segments, isMobileViewport);
  }

  const segmentsByGroup = groupSegmentsByGroupName(groupsOrder, segments);

  if (subMode === "graph") {
    return buildDefaultGraphNodes(segmentsByGroup, isMobileViewport);
  }

  return buildDefaultGroupContainerNodes(segmentsByGroup, groupsOrder, isMobileViewport);
}

export interface FitViewportCalculationOptions {
  padding: number;
  minBoundsWidth?: number;
  minBoundsHeight?: number;
  maxZoom?: number;
  emptyFallback?: CanvasViewport;
}

/**
 * Shared bounding-box viewport fitter used by both the Home Canvas and Workflow Studio.
 * Computes the bounding rectangle of `rects`, scales to fit within `containerWidth x containerHeight`
 * with `padding`, and centers the resulting viewport.
 */
export function computeCenteredFitViewport(
  rects: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
  containerWidth: number,
  containerHeight: number,
  {
    padding,
    minBoundsWidth = FIT_DEFAULT_MIN_BOUNDS_WIDTH,
    minBoundsHeight = FIT_DEFAULT_MIN_BOUNDS_HEIGHT,
    maxZoom = FIT_DEFAULT_MAX_ZOOM,
    emptyFallback = { x: 0, y: 0, zoom: 1 },
  }: FitViewportCalculationOptions,
): CanvasViewport {
  if (rects.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { ...emptyFallback };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  const boundsWidth = Math.max(minBoundsWidth, maxX - minX);
  const boundsHeight = Math.max(minBoundsHeight, maxY - minY);
  const availableWidth = Math.max(FIT_MIN_AVAILABLE_EXTENT, containerWidth - padding * 2);
  const availableHeight = Math.max(FIT_MIN_AVAILABLE_EXTENT, containerHeight - padding * 2);

  const zoom = clampCanvasZoom(
    Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight, maxZoom),
  );
  const centerX = minX + boundsWidth / 2;
  const centerY = minY + boundsHeight / 2;

  return {
    x: Math.round(containerWidth / 2 - centerX * zoom),
    y: Math.round(containerHeight / 2 - centerY * zoom),
    zoom,
  };
}

/**
 * Computes a viewport translation and zoom that centers and fits all visible nodes inside the container.
 */
export function computeFitCanvasViewport(
  nodes: Record<string, CanvasNodeRect>,
  visibleIds: string[],
  containerWidth: number,
  containerHeight: number,
  padding = 48,
): CanvasViewport {
  const visibleRects: CanvasNodeRect[] = [];

  for (let i = 0; i < visibleIds.length; i++) {
    const rect = nodes[visibleIds[i]];
    if (rect) visibleRects.push(rect);
  }

  return computeCenteredFitViewport(visibleRects, containerWidth, containerHeight, { padding });
}

export interface BezierWireGeometry {
  path: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Builds an n8n-style cubic Bezier SVG path connecting a group hub port to a segment node port.
 */
export function buildBezierWireGeometry(
  sourceRect: CanvasNodeRect,
  targetRect: CanvasNodeRect,
): BezierWireGeometry {
  const sourceCenterX = sourceRect.x + sourceRect.width / 2;
  const targetCenterX = targetRect.x + targetRect.width / 2;
  const isTargetLeft = targetCenterX <= sourceCenterX;

  const startX = isTargetLeft ? sourceRect.x : sourceRect.x + sourceRect.width;
  const startY = Math.round(sourceRect.y + sourceRect.height / 2);
  const endX = isTargetLeft ? targetRect.x + targetRect.width : targetRect.x;
  const endY = Math.round(targetRect.y + targetRect.height / 2);

  const deltaX = Math.abs(endX - startX);
  const controlOffset = Math.max(
    WIRE_MIN_CONTROL_OFFSET,
    Math.min(WIRE_MAX_CONTROL_OFFSET, Math.round(deltaX * 0.5)),
  );
  const cp1X = isTargetLeft ? startX - controlOffset : startX + controlOffset;
  const cp2X = isTargetLeft ? endX + controlOffset : endX - controlOffset;

  return {
    path: `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`,
    startX,
    startY,
    endX,
    endY,
  };
}
