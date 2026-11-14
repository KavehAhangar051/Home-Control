import {
  type CanvasGridStyle,
  clampCanvasZoom,
  getCanvasGridStyle,
  snapCanvasCoordinate,
} from "@/features/iot/components/canvas/canvasGeometry";
import type { Segment } from "@/features/iot/hooks/store/types";
import type {
  WorkflowActionDispatch,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowEvaluationSummary,
  WorkflowNode,
  WorkflowNodeKind,
  WorkflowPaletteDragPayload,
  WorkflowStudioState,
} from "./workflowTypes";

export const WORKFLOWS_STORAGE_KEY = "iot_workflows_studio_v1";

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
    viewport: { x: 48, y: 48, zoom: 1 },
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
      return { width: 240, height: 176 };
    case "trigger_schedule":
      return { width: 240, height: 176 };
    case "trigger_manual":
      return { width: 224, height: 128 };
    case "logic_and":
    case "logic_or":
    case "logic_not":
      return { width: 208, height: 128 };
  }
}

function getDefaultNodeLabel(payload: WorkflowPaletteDragPayload, segments: Segment[]): string {
  if (payload.kind === "segment" && payload.segmentId) {
    const matched = segments.find((s) => s.id === payload.segmentId);

    return matched?.title || "سگمنت";
  }

  if (payload.kind === "group") {
    if (payload.isCustomGroup) return "گروه سفارشی جدید";

    return payload.groupName || "گروه سگمنت‌ها";
  }

  switch (payload.kind) {
    case "trigger_manual":
      return "شروع دستی";
    case "trigger_schedule":
      return "زمان‌بندی";
    case "logic_and":
      return "بوابه AND (و)";
    case "logic_or":
      return "بوابه OR (یا)";
    case "logic_not":
      return "بوابه NOT (نقیض)";
    case "timer":
      return "تایمر / تاخیر";
    default:
      return "گره گردش کار";
  }
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

  const memberSegmentIds: string[] = [];

  if (payload.kind === "group" && !payload.isCustomGroup && payload.groupName) {
    for (const seg of segments) {
      if (seg.type !== "placeholder" && (seg.group || "Test") === payload.groupName) {
        memberSegmentIds.push(seg.id);
      }
    }
  }

  return {
    id: createWorkflowId("node"),
    kind: payload.kind,
    x: snappedX,
    y: snappedY,
    width: dims.width,
    height: dims.height,
    zIndex,
    label,
    segmentId: payload.segmentId,
    actionMode: payload.kind === "segment" || payload.kind === "group" ? "turn_on" : undefined,
    groupName: payload.groupName,
    isCustomGroup: payload.isCustomGroup,
    memberSegmentIds: payload.kind === "group" ? memberSegmentIds : undefined,
    groupEvalMode: payload.kind === "group" ? "any_on" : undefined,
    timerSeconds: payload.kind === "timer" ? 5 : undefined,
    timerMode: payload.kind === "timer" ? "delay" : undefined,
    scheduleTime: payload.kind === "trigger_schedule" ? "08:00" : undefined,
    scheduleDays: payload.kind === "trigger_schedule" ? [6, 0, 1, 2, 3, 4, 5] : undefined,
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

/**
 * Checks whether wiring sourceId -> targetId is valid (blocks self-loops, duplicates, and directed cycles).
 */
export function canConnectWorkflowPorts(
  edges: WorkflowEdge[],
  nodes: WorkflowNode[],
  sourceId: string,
  targetId: string,
): boolean {
  if (!sourceId || !targetId || sourceId === targetId) return false;

  const targetNode = nodes.find((n) => n.id === targetId);

  if (!targetNode) return false;

  if (targetNode.kind === "trigger_manual" || targetNode.kind === "trigger_schedule") {
    return false;
  }

  for (const edge of edges) {
    if (edge.sourceId === sourceId && edge.targetId === targetId) {
      return false;
    }
  }

  // BFS from targetId along outgoing edges to ensure sourceId is not reachable (cycle check)
  const visited = new Set<string>();
  const queue: string[] = [targetId];

  while (queue.length > 0) {
    const curr = queue.shift();

    if (!curr || visited.has(curr)) continue;

    if (curr === sourceId) return false;

    visited.add(curr);

    for (const edge of edges) {
      if (edge.sourceId === curr && !visited.has(edge.targetId)) {
        queue.push(edge.targetId);
      }
    }
  }

  return true;
}

export interface EvaluateWorkflowOptions {
  workflow: WorkflowDefinition;
  segments: Segment[];
  pinsState: Record<string, boolean>;
  manualPulseNodeIds?: Set<string>;
  timerOutputs?: Map<string, boolean>;
  nowDate?: Date;
}

function isScheduleTriggerActive(node: WorkflowNode, nowDate: Date): boolean {
  if (!node.scheduleTime) return false;

  const parts = node.scheduleTime.split(":");

  if (parts.length !== 2) return false;

  const targetHour = Number(parts[0]);
  const targetMinute = Number(parts[1]);

  if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) return false;

  const dayMatch =
    !node.scheduleDays ||
    node.scheduleDays.length === 0 ||
    node.scheduleDays.includes(nowDate.getDay());

  return dayMatch && nowDate.getHours() === targetHour && nowDate.getMinutes() === targetMinute;
}

/**
 * Deterministically evaluates the directed workflow graph with cycle protection,
 * computing live output signals for every node, active wires, timers to trigger, and pin actions.
 */
export function evaluateWorkflowGraph({
  workflow,
  segments,
  pinsState,
  manualPulseNodeIds,
  timerOutputs,
  nowDate = new Date(),
}: EvaluateWorkflowOptions): WorkflowEvaluationSummary {
  const nodeMap = new Map<string, WorkflowNode>();

  for (const node of workflow.nodes) {
    nodeMap.set(node.id, node);
  }

  const segmentMap = new Map<string, Segment>();

  for (const seg of segments) {
    segmentMap.set(seg.id, seg);
  }

  const incomingEdgesByNode = new Map<string, WorkflowEdge[]>();

  for (const edge of workflow.edges) {
    const list = incomingEdgesByNode.get(edge.targetId);

    if (list) {
      list.push(edge);
    } else {
      incomingEdgesByNode.set(edge.targetId, [edge]);
    }
  }

  const nodeOutputs = new Map<string, boolean>();
  const visiting = new Set<string>();
  const triggeredTimerIds: string[] = [];
  const pendingActionMap = new Map<string, WorkflowActionDispatch>();

  const evalNode = (nodeId: string): boolean => {
    const cached = nodeOutputs.get(nodeId);

    if (cached !== undefined) return cached;

    if (visiting.has(nodeId)) return false;

    const node = nodeMap.get(nodeId);

    if (!node) return false;

    visiting.add(nodeId);

    const incomingEdges = incomingEdgesByNode.get(nodeId) ?? [];
    const incomingValues: boolean[] = [];

    for (const edge of incomingEdges) {
      incomingValues.push(evalNode(edge.sourceId));
    }

    const hasIncoming = incomingValues.length > 0;
    const anyIncomingTrue = incomingValues.some(Boolean);
    const allIncomingTrue = hasIncoming && incomingValues.every(Boolean);

    let output = false;

    switch (node.kind) {
      case "trigger_manual":
        output = Boolean(manualPulseNodeIds?.has(node.id));
        break;
      case "trigger_schedule":
        output =
          Boolean(manualPulseNodeIds?.has(node.id)) || isScheduleTriggerActive(node, nowDate);
        break;
      case "logic_and":
        output = allIncomingTrue;
        break;
      case "logic_or":
        output = anyIncomingTrue;
        break;
      case "logic_not":
        output = hasIncoming ? !incomingValues[0] : false;
        break;
      case "timer": {
        if (anyIncomingTrue) {
          triggeredTimerIds.push(node.id);
        }

        output = Boolean(timerOutputs?.get(node.id));
        break;
      }

      case "segment": {
        const seg = node.segmentId ? segmentMap.get(node.segmentId) : undefined;
        const currentPinState = Boolean(seg?.pin && pinsState[seg.pin]);
        const mode = node.actionMode ?? "turn_on";

        if (
          hasIncoming &&
          anyIncomingTrue &&
          mode !== "condition_only" &&
          seg?.pin &&
          seg.type !== "input"
        ) {
          const desired = mode === "turn_off" ? false : mode === "toggle" ? !currentPinState : true;

          pendingActionMap.set(`${node.id}:${seg.pin}`, {
            nodeId: node.id,
            targetPin: seg.pin,
            actionMode: mode,
            actionOn: desired,
          });
          output = mode === "toggle" ? currentPinState : desired;
        } else {
          output = currentPinState;
        }

        break;
      }

      case "group": {
        const memberIds = node.memberSegmentIds ?? [];
        const memberSegs: Segment[] = [];

        for (const id of memberIds) {
          const matched = segmentMap.get(id);

          if (matched && matched.type !== "placeholder") {
            memberSegs.push(matched);
          }
        }

        const mode = node.actionMode ?? "turn_on";

        if (hasIncoming && anyIncomingTrue && mode !== "condition_only") {
          const desired = mode === "turn_off" ? false : true;

          for (const seg of memberSegs) {
            if (seg.pin && seg.type !== "input") {
              pendingActionMap.set(`${node.id}:${seg.pin}`, {
                nodeId: node.id,
                targetPin: seg.pin,
                actionMode: mode,
                actionOn: desired,
              });
            }
          }

          output = memberSegs.length > 0 ? desired : false;
        } else if (memberSegs.length === 0) {
          output = false;
        } else if (node.groupEvalMode === "all_on") {
          output = memberSegs.every((s) => Boolean(s.pin && pinsState[s.pin]));
        } else {
          output = memberSegs.some((s) => Boolean(s.pin && pinsState[s.pin]));
        }

        break;
      }
    }

    visiting.delete(nodeId);
    nodeOutputs.set(nodeId, output);

    return output;
  };

  for (const node of workflow.nodes) {
    evalNode(node.id);
  }

  const activeEdgeIds = new Set<string>();

  for (const edge of workflow.edges) {
    if (nodeOutputs.get(edge.sourceId)) {
      activeEdgeIds.add(edge.id);
    }
  }

  const pendingActions: WorkflowActionDispatch[] = [...pendingActionMap.values()];

  return {
    nodeOutputs,
    activeEdgeIds,
    pendingActions,
    triggeredTimerIds,
  };
}

interface PortPoint {
  x: number;
  y: number;
}

export function getPortAnchor(node: WorkflowNode, port: "in" | "out"): PortPoint {
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
  const offset = Math.max(56, Math.min(200, Math.round(deltaX * 0.5)));
  const cp1X = startX + offset;
  const cp2X = endX - offset;

  return {
    path: `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`,
    midX: Math.round((startX + endX) / 2),
    midY: Math.round((startY + endY) / 2),
  };
}

interface WorkflowViewportRect {
  x: number;
  y: number;
  zoom: number;
}

export function computeFitWorkflowViewport(
  nodes: WorkflowNode[],
  containerWidth: number,
  containerHeight: number,
): WorkflowViewportRect {
  if (nodes.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 48, y: 48, zoom: 1 };
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

  const padding = containerWidth < 640 ? 28 : 64;
  const boundsW = Math.max(180, maxX - minX);
  const boundsH = Math.max(140, maxY - minY);
  const availW = Math.max(120, containerWidth - padding * 2);
  const availH = Math.max(120, containerHeight - padding * 2);

  const zoom = clampCanvasZoom(Math.min(availW / boundsW, availH / boundsH, 1.05));
  const centerX = minX + boundsW / 2;
  const centerY = minY + boundsH / 2;

  return {
    x: Math.round(containerWidth / 2 - centerX * zoom),
    y: Math.round(containerHeight / 2 - centerY * zoom),
    zoom,
  };
}

let memoryWorkflowState: WorkflowStudioState | null = null;

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

    if (Array.isArray(parsed.workflows)) {
      const validWorkflows: WorkflowDefinition[] = [];

      for (const wf of parsed.workflows) {
        if (wf?.id && wf.name && Array.isArray(wf.nodes) && Array.isArray(wf.edges)) {
          validWorkflows.push({
            id: wf.id,
            name: wf.name,
            enabled: Boolean(wf.enabled),
            nodes: wf.nodes,
            edges: wf.edges,
            viewport: wf.viewport ?? { x: 48, y: 48, zoom: 1 },
            updatedAt: Number.isFinite(wf.updatedAt) ? wf.updatedAt : Date.now(),
          });
        }
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
    }
  } catch {
    // Ignore storage read errors
  }

  return { workflows: [], activeWorkflowId: null };
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
