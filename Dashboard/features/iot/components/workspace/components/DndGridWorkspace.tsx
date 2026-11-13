"use client";

import { DndContext } from "@dnd-kit/core";
import { optimizedCollisionDetection } from "../core/collisionStrategy";
import type { IoTWorkspaceProps } from "../core/types";
import TrashDropZone from "./TrashDropZone";
import WorkspaceDragOverlay from "./WorkspaceDragOverlay";
import WorkspaceGrid from "./WorkspaceGrid";

export default function DndGridWorkspace(props: IoTWorkspaceProps) {
  return (
    <DndContext
      sensors={props.sensors}
      collisionDetection={optimizedCollisionDetection}
      autoScroll={{ layoutShiftCompensation: false }}
      onDragStart={props.handleDragStart}
      onDragOver={props.handleDragOver}
      onDragEnd={props.handleDragEnd}
    >
      <WorkspaceGrid {...props} />
      <WorkspaceDragOverlay {...props} />
      <TrashDropZone activeId={props.activeSegmentId || props.activeGroupId} />
      {(props.activeSegmentId || props.activeGroupId) && (
        <style>{"* { cursor: grabbing !important; }"}</style>
      )}
    </DndContext>
  );
}
