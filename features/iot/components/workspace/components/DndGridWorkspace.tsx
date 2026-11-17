"use client";

import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import { useAchaemenidDnd } from "@/features/iot/hooks/achaemenidState/useAchaemenidDnd";
import type { IoTWorkspaceProps } from "../core/types";
import TrashDropZone from "./TrashDropZone";
import WorkspaceDragOverlay from "./WorkspaceDragOverlay";
import WorkspaceGrid from "./WorkspaceGrid";

export default function DndGridWorkspace(props: IoTWorkspaceProps) {
  const { handleDragStart, handleDragEnd } = useAchaemenidDnd({
    handleRemoveGroup: props.handleRemoveGroup,
    handleRemoveSegment: props.handleRemoveSegment,
  });

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: [new PointerActivationConstraints.Distance({ value: 5 })],
        }),
      ]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
