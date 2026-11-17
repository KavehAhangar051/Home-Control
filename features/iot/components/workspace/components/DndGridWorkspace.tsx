"use client";

import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import type { IoTWorkspaceProps } from "../core/types";
import TrashDropZone from "./TrashDropZone";
import WorkspaceDragOverlay from "./WorkspaceDragOverlay";
import WorkspaceGrid from "./WorkspaceGrid";

export default function DndGridWorkspace(props: IoTWorkspaceProps) {
  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
        }),
      ]}
      onDragStart={props.handleDragStart}
      onDragEnd={props.handleDragEnd}
    >
      <WorkspaceGrid {...props} />
      <WorkspaceDragOverlay {...props} />
      <TrashDropZone activeId={props.activeSegmentId || props.activeGroupId} />
      {(props.activeSegmentId || props.activeGroupId) && (
        <style>{"* { cursor: grabbing !important; }"}</style>
      )}
    </DragDropProvider>
  );
}
