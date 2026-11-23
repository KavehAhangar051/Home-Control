import type { SegmentRule } from "@/features/iot/hooks/store/types";

export interface SegmentData {
  id: string;
  type: string;
  pin: string;
  title: string;
  group?: string;
  icon?: string;
  state?: boolean;
  mode?: "switch" | "push";
  auto_off?: number;
  analogValue?: number;
  lastNonZeroValue?: number;
  pwmResolution?: number;
  pwmFrequency?: number;
  adcResolution?: number;
  adcSampleIntervalMs?: number;
  adcDeltaThreshold?: number;
  adcHighThreshold?: number;
  adcLowThreshold?: number;
  isVirtual?: boolean;
  nodeId?: number;
  remotePin?: number;
  rule?: SegmentRule;
}

export interface SortableSegmentCardProps {
  segment: SegmentData;
  isPinOn?: boolean;
  onRemove: (id: string) => void;
  onTogglePin: (pin: string) => void;
  onSetPinState?: (pin: string, state: boolean, preventMqtt?: boolean) => void;
  onUpdateSegmentMode?: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, autoOff: number) => void;
  onUpdateSegmentRule?: (id: string, rule: SegmentRule) => void;
  isLoadingIoT: boolean;
  onSetupPlaceholder?: (id: string) => void;
  parentGroupsCols?: number;
  groupMaxCols?: number;
  groupItemsCount?: number;
  index?: number;
  animationsEnabled?: boolean;
  isOverlayItem?: boolean;
  isMobilePortrait?: boolean;
}
