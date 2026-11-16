import type { TrellisSegmentHandlers } from "@/features/iot/components/trellis/TrellisSegmentTile";

export type CanvasSubMode = "graph" | "groups" | "segments";

export type CanvasResizeDirection = "se" | "sw" | "ne" | "nw" | "e" | "w" | "s";

export type CanvasSizePreset = "sm" | "md" | "lg";

export interface CanvasNodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasWireConnection {
  id: string;
  sourceId: string;
  targetId: string;
  groupName: string;
  segmentId: string;
  isActive: boolean;
  isInput: boolean;
}

export interface CanvasGroupHandlers extends TrellisSegmentHandlers {
  onAddPlaceholder: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}
