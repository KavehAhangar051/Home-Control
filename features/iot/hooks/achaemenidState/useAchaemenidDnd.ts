"use client";

import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export function useAchaemenidDnd({
  handleRemoveGroup,
  handleRemoveSegment,
}: {
  handleRemoveGroup: (groupId: string) => void;
  handleRemoveSegment: (id: string) => void;
}) {
  const setSegments = useIoTStore((state) => state.setSegments);
  const setGroupsOrder = useIoTStore((state) => state.setGroupsOrder);

  const activeSegmentId = useIoTStore((state) => state.activeSegmentId);
  const activeGroupId = useIoTStore((state) => state.activeGroupId);
  const setActiveSegmentId = useIoTStore((state) => state.setActiveSegmentId);
  const setActiveGroupId = useIoTStore((state) => state.setActiveGroupId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      if (e.active.data.current?.type === "Group") setActiveGroupId(String(e.active.id));
      else setActiveSegmentId(String(e.active.id));
    },
    [setActiveGroupId, setActiveSegmentId],
  );

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const { active, over } = e;

      if (
        !over ||
        active.id === over.id ||
        active.data.current?.type === "Group" ||
        over.data.current?.type === "Group"
      )
        return;

      const segments = useIoTStore.getState().segments;
      const len = segments.length;
      let activeSeg: (typeof segments)[0] | undefined;
      let overSeg: (typeof segments)[0] | undefined;
      let activeIdx = -1;
      let overIdx = -1;

      for (let i = 0; i < len; i++) {
        const s = segments[i];

        if (s.id === active.id) {
          activeSeg = s;
          activeIdx = i;
        }

        if (s.id === over.id) {
          overSeg = s;
          overIdx = i;
        }

        if (activeSeg && overSeg) break;
      }

      if (!activeSeg) return;

      if (overSeg) {
        if ((activeSeg.group || "Test") !== (overSeg.group || "Test")) {
          return;
        }

        if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
          setSegments((prev) => arrayMove(prev, activeIdx, overIdx));
        }
      }
    },
    [setSegments],
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveSegmentId(null);
      setActiveGroupId(null);
      const { active, over } = e;

      if (!over) return;

      if (over.id === "trash-dropzone") {
        const activeStr = String(active.id);

        if (active.data.current?.type === "Group") {
          handleRemoveGroup(activeStr.startsWith("group-") ? activeStr.slice(6) : activeStr);
        } else if (active.data.current?.type === "Segment") {
          handleRemoveSegment(activeStr);
        }

        return;
      }

      if (active.data.current?.type === "Group") {
        const activeStr = String(active.id);
        const overStr = String(over.id);
        const activeIdStr = activeStr.startsWith("group-") ? activeStr.slice(6) : activeStr;
        const overIdStr = overStr.startsWith("group-") ? overStr.slice(6) : overStr;

        if (activeIdStr !== overIdStr) {
          setGroupsOrder((prev) => {
            const activeIdx = prev.indexOf(activeIdStr);
            const overIdx = prev.indexOf(overIdStr);

            return activeIdx !== -1 && overIdx !== -1 ? arrayMove(prev, activeIdx, overIdx) : prev;
          });
        }
      }
    },
    [handleRemoveGroup, handleRemoveSegment, setGroupsOrder, setActiveSegmentId, setActiveGroupId],
  );

  return {
    sensors,
    activeSegmentId,
    activeGroupId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}

export const useDashboardDnd = useAchaemenidDnd;
