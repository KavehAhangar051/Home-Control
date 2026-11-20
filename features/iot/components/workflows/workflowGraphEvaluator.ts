import type { Segment } from "@/features/iot/hooks/store/types";
import { isReadOnlyInputSegment } from "@/features/iot/utils/analogInput";
import type {
  WorkflowActionDispatch,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowEvaluationSummary,
  WorkflowNode,
} from "./workflowTypes";

function findNodeById(nodes: WorkflowNode[], targetId: string): WorkflowNode | undefined {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.id === targetId) {
      return node;
    }
  }

  return undefined;
}

export function isTriggerWorkflowNodeKind(kind: WorkflowNode["kind"]): boolean {
  return kind === "trigger_manual" || kind === "trigger_schedule";
}

function hasDuplicateEdge(edges: WorkflowEdge[], sourceId: string, targetId: string): boolean {
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];

    if (edge.sourceId === sourceId && edge.targetId === targetId) {
      return true;
    }
  }

  return false;
}

function wouldIntroduceCycle(edges: WorkflowEdge[], sourceId: string, targetId: string): boolean {
  const outgoingByNode = new Map<string, string[]>();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const outgoing = outgoingByNode.get(edge.sourceId);

    if (outgoing) outgoing.push(edge.targetId);
    else outgoingByNode.set(edge.sourceId, [edge.targetId]);
  }

  const visited = new Set<string>();
  const queue: string[] = [targetId];
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head++];

    if (visited.has(currentId)) continue;
    if (currentId === sourceId) return true;

    visited.add(currentId);

    const outgoing = outgoingByNode.get(currentId);
    if (!outgoing) continue;

    for (let i = 0; i < outgoing.length; i++) {
      const nextId = outgoing[i];
      if (!visited.has(nextId)) queue.push(nextId);
    }
  }

  return false;
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

  const targetNode = findNodeById(nodes, targetId);

  if (!targetNode || isTriggerWorkflowNodeKind(targetNode.kind)) {
    return false;
  }

  if (hasDuplicateEdge(edges, sourceId, targetId)) {
    return false;
  }

  return !wouldIntroduceCycle(edges, sourceId, targetId);
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
  const scheduleTime = node.scheduleTime;

  if (!scheduleTime) return false;

  const colonIdx = scheduleTime.indexOf(":");

  if (
    colonIdx <= 0 ||
    colonIdx === scheduleTime.length - 1 ||
    scheduleTime.indexOf(":", colonIdx + 1) !== -1
  ) {
    return false;
  }

  const targetHour = Number(scheduleTime.slice(0, colonIdx));
  const targetMinute = Number(scheduleTime.slice(colonIdx + 1));

  if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) return false;

  const scheduleDays = node.scheduleDays;

  const dayMatch =
    !scheduleDays || scheduleDays.length === 0 || scheduleDays.includes(nowDate.getDay());

  return dayMatch && nowDate.getHours() === targetHour && nowDate.getMinutes() === targetMinute;
}

function buildNodeLookupMap(nodes: WorkflowNode[]): Map<string, WorkflowNode> {
  const nodeMap = new Map<string, WorkflowNode>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    nodeMap.set(node.id, node);
  }

  return nodeMap;
}

function buildSegmentLookupMap(segments: Segment[]): Map<string, Segment> {
  const segmentMap = new Map<string, Segment>();

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    segmentMap.set(segment.id, segment);
  }

  return segmentMap;
}

function buildIncomingEdgesMap(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const incomingEdgesByNode = new Map<string, WorkflowEdge[]>();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const list = incomingEdgesByNode.get(edge.targetId);

    if (list) {
      list.push(edge);
    } else {
      incomingEdgesByNode.set(edge.targetId, [edge]);
    }
  }

  return incomingEdgesByNode;
}

interface IncomingSignalSummary {
  hasIncoming: boolean;
  anyIncomingTrue: boolean;
  allIncomingTrue: boolean;
  firstIncoming: boolean;
}

function evaluateIncomingSignals(
  incomingEdges: WorkflowEdge[] | undefined,
  evalNode: (nodeId: string) => boolean,
): IncomingSignalSummary {
  const incomingLen = incomingEdges ? incomingEdges.length : 0;
  const hasIncoming = incomingLen > 0;
  let anyIncomingTrue = false;
  let allIncomingTrue = hasIncoming;
  let firstIncoming = false;

  if (incomingEdges) {
    for (let i = 0; i < incomingLen; i++) {
      const value = evalNode(incomingEdges[i].sourceId);

      if (i === 0) firstIncoming = value;

      if (value) {
        anyIncomingTrue = true;
      } else {
        allIncomingTrue = false;
      }
    }
  }

  return { hasIncoming, anyIncomingTrue, allIncomingTrue, firstIncoming };
}

function evaluateSegmentNode(
  node: WorkflowNode,
  signals: IncomingSignalSummary,
  segmentMap: Map<string, Segment>,
  pinsState: Record<string, boolean>,
  pendingActionMap: Map<string, WorkflowActionDispatch>,
): boolean {
  const segment = node.segmentId ? segmentMap.get(node.segmentId) : undefined;
  const currentPinState = Boolean(segment?.pin && pinsState[segment.pin]);
  const mode = node.actionMode ?? "turn_on";

  if (
    signals.hasIncoming &&
    signals.anyIncomingTrue &&
    mode !== "condition_only" &&
    segment?.pin &&
    !isReadOnlyInputSegment(segment)
  ) {
    const desired = mode === "turn_off" ? false : mode === "toggle" ? !currentPinState : true;

    pendingActionMap.set(`${node.id}:${segment.pin}`, {
      nodeId: node.id,
      targetPin: segment.pin,
      actionMode: mode,
      actionOn: desired,
    });

    return mode === "toggle" ? currentPinState : desired;
  }

  return currentPinState;
}

function evaluateGroupNode(
  node: WorkflowNode,
  signals: IncomingSignalSummary,
  segmentMap: Map<string, Segment>,
  pinsState: Record<string, boolean>,
  pendingActionMap: Map<string, WorkflowActionDispatch>,
): boolean {
  const memberIds = node.memberSegmentIds;
  const memberLen = memberIds ? memberIds.length : 0;
  const mode = node.actionMode ?? "turn_on";

  const shouldDispatch =
    signals.hasIncoming && signals.anyIncomingTrue && mode !== "condition_only";

  const desired = mode !== "turn_off";
  let validMemberCount = 0;
  let anyMemberOn = false;
  let allMembersOn = true;

  if (memberIds) {
    for (let i = 0; i < memberLen; i++) {
      const matched = segmentMap.get(memberIds[i]);

      if (!matched || matched.type === "placeholder") continue;

      validMemberCount++;

      if (shouldDispatch) {
        if (matched.pin && !isReadOnlyInputSegment(matched)) {
          pendingActionMap.set(`${node.id}:${matched.pin}`, {
            nodeId: node.id,
            targetPin: matched.pin,
            actionMode: mode,
            actionOn: desired,
          });
        }
      } else {
        const isPinOn = Boolean(matched.pin && pinsState[matched.pin]);

        if (isPinOn) {
          anyMemberOn = true;
        } else {
          allMembersOn = false;
        }
      }
    }
  }

  if (shouldDispatch) {
    return validMemberCount > 0 ? desired : false;
  }

  if (validMemberCount === 0) {
    return false;
  }

  return node.groupEvalMode === "all_on" ? allMembersOn : anyMemberOn;
}

function collectActiveEdgeIds(
  edges: WorkflowEdge[],
  nodeOutputs: Map<string, boolean>,
): Set<string> {
  const activeEdgeIds = new Set<string>();

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];

    if (nodeOutputs.get(edge.sourceId)) {
      activeEdgeIds.add(edge.id);
    }
  }

  return activeEdgeIds;
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
  const nodes = workflow.nodes;
  const edges = workflow.edges;
  const nodeMap = buildNodeLookupMap(nodes);
  const segmentMap = buildSegmentLookupMap(segments);
  const incomingEdgesByNode = buildIncomingEdgesMap(edges);

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
    const signals = evaluateIncomingSignals(incomingEdgesByNode.get(nodeId), evalNode);
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
        output = signals.allIncomingTrue;
        break;
      case "logic_or":
        output = signals.anyIncomingTrue;
        break;
      case "logic_not":
        output = signals.hasIncoming ? !signals.firstIncoming : false;
        break;
      case "timer":
        if (signals.anyIncomingTrue) {
          triggeredTimerIds.push(node.id);
        }

        output = Boolean(timerOutputs?.get(node.id));
        break;
      case "segment":
        output = evaluateSegmentNode(node, signals, segmentMap, pinsState, pendingActionMap);
        break;
      case "group":
        output = evaluateGroupNode(node, signals, segmentMap, pinsState, pendingActionMap);
        break;
    }

    visiting.delete(nodeId);
    nodeOutputs.set(nodeId, output);

    return output;
  };

  for (let i = 0; i < nodes.length; i++) {
    evalNode(nodes[i].id);
  }

  return {
    nodeOutputs,
    activeEdgeIds: collectActiveEdgeIds(edges, nodeOutputs),
    pendingActions: Array.from(pendingActionMap.values()),
    triggeredTimerIds,
  };
}
