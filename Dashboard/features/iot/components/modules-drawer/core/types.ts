export interface Segment {
  id: string;
  type: string;
  pin: string;
  title: string;
  group?: string;
  icon?: string;
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
}
