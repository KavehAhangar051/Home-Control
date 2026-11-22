import type { SegmentRule } from "@/features/iot/hooks/store/types";

export interface IoTWorkspaceProps {
  groupsOrder: string[];
  groupsCols: number;
  groupConfigs: Record<string, { maxCols: number; icon?: string }>;
  isLoadingIoT: boolean;
  activeSegmentId: string | null;
  activeGroupId: string | null;
  animationsEnabled?: boolean;
  selectedGroupFilter?: string | null;

  handleGroupColsChange: (groupName: string, cols: number) => void;
  handleAddPlaceholder: (groupId: string) => void;
  handleRemoveGroup: (groupId: string) => void;
  handleRemoveSegment: (id: string) => void;
  handleTogglePin: (pin: string) => void;
  handleSetPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
  handleUpdateSegmentMode: (id: string, mode: "switch" | "push") => void;
  handleUpdateSegmentAutoOff: (id: string, autoOff: number) => void;
  handleUpdateSegmentRule?: (id: string, rule: SegmentRule) => void;
  handleSetupPlaceholder: (id: string) => void;
}
