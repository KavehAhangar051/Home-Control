import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowStudioState,
  WorkflowViewport,
} from "./workflowTypes";

export const WORKFLOWS_STORAGE_KEY = "iot_workflows_studio_v1";
export const DEFAULT_WORKFLOW_VIEWPORT: WorkflowViewport = { x: 48, y: 48, zoom: 1 };

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
