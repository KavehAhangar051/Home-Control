import type React from "react";
import type { WorkflowPaletteDragPayload } from "./workflowTypes";

export const WORKFLOW_PALETTE_MIME = "application/x-iot-workflow-node";

export type PaletteCategoryFilter = "all" | "logic" | "groups" | "segments";

export interface PaletteSymbolEntry {
  payload: WorkflowPaletteDragPayload;
  title: string;
  searchKeywords: string[];
}

export const LOGIC_GATE_ENTRIES: readonly PaletteSymbolEntry[] = [
  {
    payload: { kind: "logic_and" },
    title: "AND",
    searchKeywords: ["and", "گیت", "منطق", "و"],
  },
  {
    payload: { kind: "logic_or" },
    title: "OR",
    searchKeywords: ["or", "گیت", "منطق", "یا"],
  },
  {
    payload: { kind: "logic_not" },
    title: "NOT",
    searchKeywords: ["not", "گیت", "وارونگر", "معکوس"],
  },
];

export const CONTROL_ENTRIES: readonly PaletteSymbolEntry[] = [
  {
    payload: { kind: "trigger_manual" },
    title: "شستی دستی",
    searchKeywords: ["شستی", "دستی", "پالس", "manual"],
  },
  {
    payload: { kind: "trigger_schedule" },
    title: "زمان‌بندی",
    searchKeywords: ["زمان‌بندی", "ساعت", "schedule", "clock"],
  },
  {
    payload: { kind: "timer" },
    title: "تایمر",
    searchKeywords: ["تایمر", "تاخیر", "timer", "delay"],
  },
];

export function startPaletteDrag(
  e: React.DragEvent<HTMLElement>,
  payload: WorkflowPaletteDragPayload,
): void {
  e.dataTransfer.setData(WORKFLOW_PALETTE_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "copy";
}
