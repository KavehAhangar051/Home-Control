"use client";

import type { WorkflowNodeKind } from "./workflowTypes";
import {
  AndGateSymbolSvg,
  GroupSymbolSvg,
  NotGateSymbolSvg,
  OrGateSymbolSvg,
  SegmentSymbolSvg,
  TimerSymbolSvg,
  TriggerManualSymbolSvg,
  TriggerScheduleSymbolSvg,
} from "./WorkflowSymbolArt";

export interface SchematicSymbolProps {
  kind: WorkflowNodeKind;
  isCustomGroup?: boolean;
  isInputSegment?: boolean;
  className?: string;
}

/**
 * Renders authentic US-standard (ANSI / IEEE Std 91-1984 & NEMA ICS) schematic symbols
 * for workflow palette items and node headers.
 */
export function WorkflowSchematicSymbol({
  kind,
  isCustomGroup = false,
  isInputSegment = false,
  className = "h-6 w-10",
}: SchematicSymbolProps) {
  switch (kind) {
    case "logic_and":
      return <AndGateSymbolSvg className={className} />;
    case "logic_or":
      return <OrGateSymbolSvg className={className} />;
    case "logic_not":
      return <NotGateSymbolSvg className={className} />;
    case "trigger_manual":
      return <TriggerManualSymbolSvg className={className} />;
    case "trigger_schedule":
      return <TriggerScheduleSymbolSvg className={className} />;
    case "timer":
      return <TimerSymbolSvg className={className} />;
    case "group":
      return <GroupSymbolSvg className={className} isCustomGroup={isCustomGroup} />;
    case "segment":
      return <SegmentSymbolSvg className={className} isInputSegment={isInputSegment} />;
  }
}
