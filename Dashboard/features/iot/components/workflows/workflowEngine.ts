import {
  type CanvasGridStyle,
  clampCanvasZoom,
  getCanvasGridStyle,
  snapCanvasCoordinate,
} from "@/features/iot/components/canvas/canvasGeometry";
import type { Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import {
  canConnectWorkflowPorts,
  type EvaluateWorkflowOptions,
  evaluateWorkflowGraph,
} from "./workflowGraphEvaluator";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowPaletteDragPayload,
  WorkflowStudioState,
  WorkflowViewport,
} from "./workflowTypes";

export { canConnectWorkflowPorts, type EvaluateWorkflowOptions, evaluateWorkflowGraph };

export const WORKFLOWS_STORAGE_KEY = "iot_workflows_studio_v1";

const DEFAULT_WORKFLOW_VIEWPORT: WorkflowViewport = { x: 48, y: 48, zoom: 1 };
const MAX_NODE_INPUT_PORTS = 8;
const DEFAULT_TIMER_SECONDS = 5;
const DEFAULT_SCHEDULE_TIME = "08:00";
const ALL_WEEK_DAYS = [6, 0, 1, 2, 3, 4, 5];

const INPUT_PORT_TOP_PADDING = 42;
const INPUT_PORT_BOTTOM_PADDING = 22;
const MIN_INPUT_PORT_SPAN = 24;

const BEZIER_MIN_CONTROL_OFFSET = 56;
const BEZIER_MAX_CONTROL_OFFSET = 200;

const FIT_VIEW_MOBILE_BREAKPOINT = 640;
const FIT_VIEW_MOBILE_PADDING = 28;
const FIT_VIEW_DESKTOP_PADDING = 64;
const FIT_VIEW_MIN_BOUNDS_WIDTH = 180;
const FIT_VIEW_MIN_BOUNDS_HEIGHT = 140;
const FIT_VIEW_MIN_AVAILABLE_SIZE = 120;
const FIT_VIEW_MAX_ZOOM = 1.05;

export function createWorkflowId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyWorkflow(name: string): WorkflowDefinition {
  return {
    id: createWorkflowId("wf"),
    name,
    enabled: false,
    nodes: [],
    edges: [],
    viewport: { ...DEFAULT_WORKFLOW_VIEWPORT },
    updatedAt: Date.now(),
  };
}

interface WorkflowDimensions {
  width: number;
  height: number;
}

function getDefaultNodeDimensions(kind: WorkflowNodeKind): WorkflowDimensions {
  switch (kind) {
    case "group":
      return { width: 304, height: 256 };
    case "segment":
      return { width: 240, height: 160 };
    case "timer":
    case "trigger_schedule":
      return { width: 240, height: 176 };
    case "trigger_manual":
      return { width: 224, height: 128 };
    case "logic_and":
    case "logic_or":
    case "logic_not":
      return { width: 224, height: 144 };
  }
}

export function getNodeMinInputCount(kind: WorkflowNodeKind): number {
  if (kind === "trigger_manual" || kind === "trigger_schedule") return 0;

  if (kind === "logic_and" || kind === "logic_or") return 2;

  return 1;
}

export function getNodeInputCount(node: Pick<WorkflowNode, "kind" | "inputCount">): number {
  if (node.kind === "trigger_manual" || node.kind === "trigger_schedule") return 0;

  const minInputs = getNodeMinInputCount(node.kind);
  const raw = node.inputCount ?? minInputs;

  return Math.max(minInputs, Math.min(MAX_NODE_INPUT_PORTS, Math.round(raw)));
}

function getDefaultNodeLabel(payload: WorkflowPaletteDragPayload, segments: Segment[]): string {
  if (payload.kind === "segment" && payload.segmentId) {
    const matched = segments.find((s) => s.id === payload.segmentId);

    return matched?.title || "قطعه";
  }

  if (payload.kind === "group") {
    if (payload.isCustomGroup) return "گروه سفارشی";

    return payload.groupName ? `گروه ${payload.groupName}` : "بلوک گروه";
  }

  switch (payload.kind) {
    case "trigger_manual":
      return "شستی دستی";
    case "trigger_schedule":
      return "زمان‌بندی";
    case "logic_and":
      return "AND";
    case "logic_or":
      return "OR";
    case "logic_not":
      return "NOT";
    case "timer":
      return "تایمر";
    default:
      return "گره";
  }
}

export function normalizeWorkflowNodeLabel(node: WorkflowNode): string {
  if (node.kind === "logic_and") return "AND";

  if (node.kind === "logic_or") return "OR";

  if (node.kind === "logic_not") return "NOT";

  if (node.kind === "trigger_manual" && node.label === "شستی فرمان دستی") return "شستی دستی";

  if (node.kind === "trigger_schedule" && node.label === "نوسان‌ساز زمان‌بندی") return "زمان‌بندی";

  if (node.kind === "timer" && node.label === "تایمر و تاخیر") return "تایمر";

  if (node.kind === "group" && node.isCustomGroup && node.label === "زیرمدار گروه سفارشی") {
    return "گروه سفارشی";
  }

  return node.label;
}

function collectInitialGroupMemberIds(
  payload: WorkflowPaletteDragPayload,
  segments: Segment[],
): string[] {
  const memberSegmentIds: string[] = [];

  if (payload.kind === "group" && !payload.isCustomGroup && payload.groupName) {
    for (const seg of segments) {
      if (seg.type !== "placeholder" && resolveSegmentGroup(seg.group) === payload.groupName) {
        memberSegmentIds.push(seg.id);
      }
    }
  }

  return memberSegmentIds;
}

export interface CreateWorkflowNodeInput {
  payload: WorkflowPaletteDragPayload;
  x: number;
  y: number;
  zIndex: number;
  segments: Segment[];
  snapToGrid?: boolean;
}

/**
 * Instantiates a new workflow node from a palette item (segment, empty/populated group, logic gate, timer, or trigger).
 */
export function createWorkflowNode({
  payload,
  x,
  y,
  zIndex,
  segments,
  snapToGrid = true,
}: CreateWorkflowNodeInput): WorkflowNode {
  const dims = getDefaultNodeDimensions(payload.kind);
  const snappedX = snapCanvasCoordinate(x, snapToGrid);
  const snappedY = snapCanvasCoordinate(y, snapToGrid);
  const label = getDefaultNodeLabel(payload, segments);
  const defaultInputCount = getNodeMinInputCount(payload.kind);
  const memberSegmentIds = collectInitialGroupMemberIds(payload, segments);

  return {
    id: createWorkflowId("node"),
    kind: payload.kind,
    x: snappedX,
    y: snappedY,
    width: dims.width,
    height: dims.height,
    zIndex,
    label,
    inputCount: defaultInputCount > 0 ? defaultInputCount : undefined,
    segmentId: payload.segmentId,
    actionMode: payload.kind === "segment" || payload.kind === "group" ? "turn_on" : undefined,
    groupName: payload.groupName,
    isCustomGroup: payload.isCustomGroup,
    memberSegmentIds: payload.kind === "group" ? memberSegmentIds : undefined,
    groupEvalMode: payload.kind === "group" ? "any_on" : undefined,
    timerSeconds: payload.kind === "timer" ? DEFAULT_TIMER_SECONDS : undefined,
    timerMode: payload.kind === "timer" ? "delay" : undefined,
    scheduleTime: payload.kind === "trigger_schedule" ? DEFAULT_SCHEDULE_TIME : undefined,
    scheduleDays: payload.kind === "trigger_schedule" ? [...ALL_WEEK_DAYS] : undefined,
  };
}

export function clampWorkflowNodeSize(
  kind: WorkflowNodeKind,
  width: number,
  height: number,
  snapToGrid: boolean,
): WorkflowDimensions {
  const minW = kind === "group" ? 256 : 192;
  const maxW = kind === "group" ? 640 : 416;
  const minH = kind === "group" ? 192 : 112;
  const maxH = kind === "group" ? 688 : 336;

  const clampedW = Math.min(maxW, Math.max(minW, width));
  const clampedH = Math.min(maxH, Math.max(minH, height));

  return {
    width: snapCanvasCoordinate(clampedW, snapToGrid),
    height: snapCanvasCoordinate(clampedH, snapToGrid),
  };
}

/**
 * Snaps an existing workflow node's coordinates and dimensions onto the 16px grid.
 */
export function snapWorkflowNodeToGrid(node: WorkflowNode): WorkflowNode {
  const clamped = clampWorkflowNodeSize(node.kind, node.width, node.height, true);

  return {
    ...node,
    x: snapCanvasCoordinate(node.x, true),
    y: snapCanvasCoordinate(node.y, true),
    width: clamped.width,
    height: clamped.height,
  };
}

interface PortPoint {
  x: number;
  y: number;
}

export function getInputPortOffsetY(
  nodeHeight: number,
  portIndex: number,
  totalPorts: number,
): number {
  if (totalPorts <= 1) {
    return Math.round(nodeHeight / 2);
  }

  const span = Math.max(
    MIN_INPUT_PORT_SPAN,
    nodeHeight - INPUT_PORT_TOP_PADDING - INPUT_PORT_BOTTOM_PADDING,
  );
  const clampedIdx = Math.max(0, Math.min(totalPorts - 1, portIndex));

  return Math.round(INPUT_PORT_TOP_PADDING + (span * clampedIdx) / (totalPorts - 1));
}

export function getPortAnchor(
  node: WorkflowNode,
  port: "in" | "out",
  portIndex?: number,
  totalPorts?: number,
): PortPoint {
  if (port === "in" && portIndex !== undefined && totalPorts !== undefined && totalPorts > 1) {
    return {
      x: node.x,
      y: node.y + getInputPortOffsetY(node.height, portIndex, totalPorts),
    };
  }

  return {
    x: port === "in" ? node.x : node.x + node.width,
    y: Math.round(node.y + node.height / 2),
  };
}

interface BezierPathGeometry {
  path: string;
  midX: number;
  midY: number;
}

export function buildWorkflowBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): BezierPathGeometry {
  const deltaX = Math.abs(endX - startX);
  const offset = Math.max(
    BEZIER_MIN_CONTROL_OFFSET,
    Math.min(BEZIER_MAX_CONTROL_OFFSET, Math.round(deltaX * 0.5)),
  );
  const cp1X = startX + offset;
  const cp2X = endX - offset;

  return {
    path: `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`,
    midX: Math.round((startX + endX) / 2),
    midY: Math.round((startY + endY) / 2),
  };
}

export function computeFitWorkflowViewport(
  nodes: WorkflowNode[],
  containerWidth: number,
  containerHeight: number,
): WorkflowViewport {
  if (nodes.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { ...DEFAULT_WORKFLOW_VIEWPORT };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }

  const padding =
    containerWidth < FIT_VIEW_MOBILE_BREAKPOINT
      ? FIT_VIEW_MOBILE_PADDING
      : FIT_VIEW_DESKTOP_PADDING;
  const boundsW = Math.max(FIT_VIEW_MIN_BOUNDS_WIDTH, maxX - minX);
  const boundsH = Math.max(FIT_VIEW_MIN_BOUNDS_HEIGHT, maxY - minY);
  const availW = Math.max(FIT_VIEW_MIN_AVAILABLE_SIZE, containerWidth - padding * 2);
  const availH = Math.max(FIT_VIEW_MIN_AVAILABLE_SIZE, containerHeight - padding * 2);

  const zoom = clampCanvasZoom(Math.min(availW / boundsW, availH / boundsH, FIT_VIEW_MAX_ZOOM));
  const centerX = minX + boundsW / 2;
  const centerY = minY + boundsH / 2;

  return {
    x: Math.round(containerWidth / 2 - centerX * zoom),
    y: Math.round(containerHeight / 2 - centerY * zoom),
    zoom,
  };
}

let memoryWorkflowState: WorkflowStudioState | null = null;

function hydrateStoredWorkflow(
  rawWorkflow: Partial<WorkflowDefinition>,
): WorkflowDefinition | null {
  if (
    !rawWorkflow?.id ||
    !rawWorkflow.name ||
    !Array.isArray(rawWorkflow.nodes) ||
    !Array.isArray(rawWorkflow.edges)
  ) {
    return null;
  }

  return {
    id: rawWorkflow.id,
    name: rawWorkflow.name,
    enabled: Boolean(rawWorkflow.enabled),
    nodes: rawWorkflow.nodes.map((node) => ({
      ...node,
      label: normalizeWorkflowNodeLabel(node),
    })),
    edges: rawWorkflow.edges,
    viewport: rawWorkflow.viewport ?? { ...DEFAULT_WORKFLOW_VIEWPORT },
    updatedAt: Number.isFinite(rawWorkflow.updatedAt)
      ? (rawWorkflow.updatedAt as number)
      : Date.now(),
  };
}

export function readStoredWorkflowState(): WorkflowStudioState {
  if (memoryWorkflowState) return memoryWorkflowState;

  if (globalThis.window === undefined) {
    return { workflows: [], activeWorkflowId: null };
  }

  try {
    const raw = globalThis.window.localStorage.getItem(WORKFLOWS_STORAGE_KEY);

    if (!raw) return { workflows: [], activeWorkflowId: null };

    // SAFETY: JSON payload is validated below before hydrating studio state
    const parsed = JSON.parse(raw) as Partial<WorkflowStudioState>;

    if (!Array.isArray(parsed.workflows)) {
      return { workflows: [], activeWorkflowId: null };
    }

    const validWorkflows: WorkflowDefinition[] = [];

    for (const rawWorkflow of parsed.workflows) {
      const hydrated = hydrateStoredWorkflow(rawWorkflow);
      if (hydrated) validWorkflows.push(hydrated);
    }

    const activeId =
      parsed.activeWorkflowId && validWorkflows.some((w) => w.id === parsed.activeWorkflowId)
        ? parsed.activeWorkflowId
        : (validWorkflows[0]?.id ?? null);

    const resolved: WorkflowStudioState = {
      workflows: validWorkflows,
      activeWorkflowId: activeId,
    };

    memoryWorkflowState = resolved;

    return resolved;
  } catch {
    // Ignore storage read errors
    return { workflows: [], activeWorkflowId: null };
  }
}

export function writeStoredWorkflowState(state: WorkflowStudioState): void {
  memoryWorkflowState = state;

  if (globalThis.window === undefined) return;

  try {
    globalThis.window.localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write errors
  }
}

export function getWorkflowGridStyle(x: number, y: number, zoom: number): CanvasGridStyle {
  return getCanvasGridStyle(x, y, zoom);
}
