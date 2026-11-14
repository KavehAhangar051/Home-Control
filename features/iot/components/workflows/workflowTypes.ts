export type WorkflowNodeKind =
  | "trigger_manual"
  | "trigger_schedule"
  | "segment"
  | "group"
  | "logic_and"
  | "logic_or"
  | "logic_not"
  | "timer";

export type WorkflowActionMode = "condition_only" | "turn_on" | "turn_off" | "toggle";

export type WorkflowGroupEvalMode = "any_on" | "all_on";

export type WorkflowTimerMode = "delay" | "hold";

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  label: string;
  segmentId?: string;
  actionMode?: WorkflowActionMode;
  groupName?: string;
  isCustomGroup?: boolean;
  memberSegmentIds?: string[];
  groupEvalMode?: WorkflowGroupEvalMode;
  timerSeconds?: number;
  timerMode?: WorkflowTimerMode;
  scheduleTime?: string;
  scheduleDays?: number[];
}

export interface WorkflowEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface WorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: WorkflowViewport;
  updatedAt: number;
}

export interface WorkflowActionDispatch {
  nodeId: string;
  targetPin: string;
  actionMode: WorkflowActionMode;
  actionOn: boolean;
}

export interface WorkflowEvaluationSummary {
  nodeOutputs: Map<string, boolean>;
  activeEdgeIds: Set<string>;
  pendingActions: WorkflowActionDispatch[];
  triggeredTimerIds: string[];
}

export interface WorkflowStudioState {
  workflows: WorkflowDefinition[];
  activeWorkflowId: string | null;
}

export interface WorkflowPaletteDragPayload {
  kind: WorkflowNodeKind;
  segmentId?: string;
  groupName?: string;
  isCustomGroup?: boolean;
}
