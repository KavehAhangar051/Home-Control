import { snapCanvasCoordinate } from "@/features/iot/components/canvas/canvasGeometry";
import { clampWorkflowNodeSize, createWorkflowId } from "./workflowEngine";
import { hydrateWorkflowDefinition } from "./workflowStorage";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "./workflowTypes";

const SUBFLOW_HEADER_CLEARANCE = 44;
const SUBFLOW_SIDE_PADDING = 24;
const SUBFLOW_BOTTOM_PADDING = 24;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Finds a `kind === "group"` container node whose bounding box encloses
 * the center point of `candidateNode`.
 */
export function findContainingGroupNode(
  candidateNode: WorkflowNode,
  allNodes: ReadonlyArray<WorkflowNode>,
): WorkflowNode | null {
  if (candidateNode.kind === "group") return null;

  const centerX = candidateNode.x + candidateNode.width / 2;
  const centerY = candidateNode.y + candidateNode.height / 2;

  for (let i = allNodes.length - 1; i >= 0; i--) {
    const candidateGroup = allNodes[i];

    if (candidateGroup.id === candidateNode.id || candidateGroup.kind !== "group") {
      continue;
    }

    const insideX =
      centerX >= candidateGroup.x && centerX <= candidateGroup.x + candidateGroup.width;
    const insideY =
      centerY >= candidateGroup.y && centerY <= candidateGroup.y + candidateGroup.height;

    if (insideX && insideY) {
      return candidateGroup;
    }
  }

  return null;
}

/**
 * Expands a `kind === "group"` sub-flow container node if needed so `childNode`
 * fits comfortably inside its bounds, while keeping `groupNode.zIndex` below its children.
 */
export function expandGroupBoundsToFitChild(
  groupNode: WorkflowNode,
  childNode: WorkflowNode,
  snapToGrid: boolean,
): WorkflowNode {
  const minLeft = Math.min(groupNode.x, childNode.x - SUBFLOW_SIDE_PADDING);
  const minTop = Math.min(groupNode.y, childNode.y - SUBFLOW_HEADER_CLEARANCE);
  const maxRight = Math.max(
    groupNode.x + groupNode.width,
    childNode.x + childNode.width + SUBFLOW_SIDE_PADDING,
  );
  const maxBottom = Math.max(
    groupNode.y + groupNode.height,
    childNode.y + childNode.height + SUBFLOW_BOTTOM_PADDING,
  );

  const nextX = snapCanvasCoordinate(minLeft, snapToGrid);
  const nextY = snapCanvasCoordinate(minTop, snapToGrid);
  const clamped = clampWorkflowNodeSize("group", maxRight - nextX, maxBottom - nextY, snapToGrid);

  return {
    ...groupNode,
    x: nextX,
    y: nextY,
    width: clamped.width,
    height: clamped.height,
    zIndex: Math.min(groupNode.zIndex, Math.max(1, childNode.zIndex - 1)),
  };
}

/**
 * Toggles Sub-flow grouping for `targetNodeId`:
 * - If the node already belongs to a parent group (`parentGroupId`), detaches it.
 * - If the node is a `group` node itself with children, detaches all its children.
 * - Otherwise creates a new custom Sub-flow Group container framing the node (and any
 *   directly wired neighbor nodes) so they move together as a modular sub-circuit.
 */
export function toggleNodeSubflowGroup(params: {
  workflow: WorkflowDefinition;
  targetNodeId: string;
  snapToGrid: boolean;
}): {
  workflow: WorkflowDefinition;
  action: "grouped" | "ungrouped" | "noop";
  groupNodeId: string | null;
} {
  const { workflow, targetNodeId, snapToGrid } = params;
  const targetNode = workflow.nodes.find((n) => n.id === targetNodeId);

  if (!targetNode) {
    return { workflow, action: "noop", groupNodeId: null };
  }

  // Case 1: Target node is already inside a parent group -> detach it
  if (targetNode.parentGroupId) {
    return {
      workflow: {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          n.id === targetNode.id ? { ...n, parentGroupId: undefined } : n,
        ),
      },
      action: "ungrouped",
      groupNodeId: null,
    };
  }

  // Case 2: Target node is a group container that currently has child nodes -> detach children
  if (targetNode.kind === "group") {
    const hasChildren = workflow.nodes.some((n) => n.parentGroupId === targetNode.id);

    if (!hasChildren) {
      return { workflow, action: "noop", groupNodeId: targetNode.id };
    }

    return {
      workflow: {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          n.parentGroupId === targetNode.id ? { ...n, parentGroupId: undefined } : n,
        ),
      },
      action: "ungrouped",
      groupNodeId: targetNode.id,
    };
  }

  // Case 3: Check if targetNode already sits inside an existing group box
  const existingContainer = findContainingGroupNode(targetNode, workflow.nodes);

  if (existingContainer) {
    const updatedGroup = expandGroupBoundsToFitChild(existingContainer, targetNode, snapToGrid);

    return {
      workflow: {
        ...workflow,
        nodes: workflow.nodes.map((n) => {
          if (n.id === existingContainer.id) return updatedGroup;

          if (n.id === targetNode.id) {
            return {
              ...n,
              parentGroupId: existingContainer.id,
              zIndex: Math.max(n.zIndex, updatedGroup.zIndex + 1),
            };
          }

          return n;
        }),
      },
      action: "grouped",
      groupNodeId: existingContainer.id,
    };
  }

  // Case 4: Create a new custom Sub-flow Group box framing targetNode
  const groupX = snapCanvasCoordinate(targetNode.x - SUBFLOW_SIDE_PADDING, snapToGrid);
  const groupY = snapCanvasCoordinate(targetNode.y - SUBFLOW_HEADER_CLEARANCE, snapToGrid);
  const groupDims = clampWorkflowNodeSize(
    "group",
    targetNode.width + SUBFLOW_SIDE_PADDING * 2,
    targetNode.height + SUBFLOW_HEADER_CLEARANCE + SUBFLOW_BOTTOM_PADDING,
    snapToGrid,
  );

  const newGroupId = createWorkflowId("node");
  const newGroupNode: WorkflowNode = {
    id: newGroupId,
    kind: "group",
    x: groupX,
    y: groupY,
    width: groupDims.width,
    height: groupDims.height,
    zIndex: Math.max(1, targetNode.zIndex),
    label: `زیرمدار ${targetNode.label}`,
    isCustomGroup: true,
    memberSegmentIds: targetNode.segmentId ? [targetNode.segmentId] : [],
    groupEvalMode: "any_on",
    actionMode: "turn_on",
    inputCount: 1,
  };

  const nextNodes = workflow.nodes.map((n) =>
    n.id === targetNode.id
      ? { ...n, parentGroupId: newGroupId, zIndex: newGroupNode.zIndex + 2 }
      : n.zIndex >= newGroupNode.zIndex
        ? { ...n, zIndex: n.zIndex + 1 }
        : n,
  );

  return {
    workflow: {
      ...workflow,
      nodes: [newGroupNode, ...nextNodes],
    },
    action: "grouped",
    groupNodeId: newGroupId,
  };
}

/**
 * Clones copied workflow nodes (including any sub-flow child nodes when copying a group)
 * and their internal connecting edges with fresh IDs and a spatial grid offset.
 */
export function cloneClipboardNodesAndEdges(params: {
  sourceNodes: ReadonlyArray<WorkflowNode>;
  sourceEdges: ReadonlyArray<WorkflowEdge>;
  existingNodes: ReadonlyArray<WorkflowNode>;
  offsetStep: number;
  snapToGrid: boolean;
}): {
  clonedNodes: WorkflowNode[];
  clonedEdges: WorkflowEdge[];
  primaryNodeId: string | null;
} {
  const { sourceNodes, sourceEdges, existingNodes, offsetStep, snapToGrid } = params;

  if (sourceNodes.length === 0) {
    return { clonedNodes: [], clonedEdges: [], primaryNodeId: null };
  }

  let maxZ = 1;

  for (const n of existingNodes) {
    maxZ = Math.max(maxZ, n.zIndex);
  }

  const delta = 32 * Math.max(1, offsetStep);
  const idMap = new Map<string, string>();

  for (const src of sourceNodes) {
    idMap.set(src.id, createWorkflowId("node"));
  }

  const clonedNodes: WorkflowNode[] = sourceNodes.map((src, index) => {
    const newId = idMap.get(src.id) ?? createWorkflowId("node");
    const mappedParentId = src.parentGroupId ? idMap.get(src.parentGroupId) : undefined;

    return {
      ...src,
      id: newId,
      x: snapCanvasCoordinate(src.x + delta, snapToGrid),
      y: snapCanvasCoordinate(src.y + delta, snapToGrid),
      zIndex: maxZ + index + 1,
      parentGroupId: mappedParentId ?? src.parentGroupId,
    };
  });

  const clonedEdges: WorkflowEdge[] = [];

  for (const edge of sourceEdges) {
    const newSourceId = idMap.get(edge.sourceId);
    const newTargetId = idMap.get(edge.targetId);

    if (newSourceId && newTargetId) {
      clonedEdges.push({
        ...edge,
        id: createWorkflowId("edge"),
        sourceId: newSourceId,
        targetId: newTargetId,
      });
    }
  }

  return {
    clonedNodes,
    clonedEdges,
    primaryNodeId: clonedNodes[0]?.id ?? null,
  };
}

/**
 * Extracts and validates one or more `WorkflowDefinition` items from an imported JSON payload.
 * Supports single workflow files, workflow arrays, `WorkflowStudioState`, or full dashboard backups.
 */
export function parseImportedWorkflowsPayload(
  raw: unknown,
  existingIds: ReadonlySet<string>,
): WorkflowDefinition[] {
  const rawCandidates: unknown[] = [];

  if (Array.isArray(raw)) {
    rawCandidates.push(...raw);
  } else if (isObjectRecord(raw)) {
    if (Array.isArray(raw.workflows)) {
      rawCandidates.push(...raw.workflows);
    } else if (isObjectRecord(raw.workflows) && Array.isArray(raw.workflows.workflows)) {
      rawCandidates.push(...raw.workflows.workflows);
    } else if (Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
      rawCandidates.push(raw);
    }
  }

  const imported: WorkflowDefinition[] = [];
  const usedIds = new Set(existingIds);

  for (const candidate of rawCandidates) {
    if (!isObjectRecord(candidate)) continue;

    const hydrated = hydrateWorkflowDefinition(candidate as Partial<WorkflowDefinition>);

    if (!hydrated) continue;

    let finalId = hydrated.id;
    let finalName = hydrated.name;

    if (usedIds.has(finalId)) {
      finalId = createWorkflowId("wf");
      finalName = `${hydrated.name} (واردشده)`;
    }

    usedIds.add(finalId);
    imported.push({
      ...hydrated,
      id: finalId,
      name: finalName,
      updatedAt: Date.now(),
    });
  }

  if (imported.length === 0) {
    throw new Error("فایل انتخاب‌شده شامل سناریوی گردش کار معتبر نیست.");
  }

  return imported;
}
