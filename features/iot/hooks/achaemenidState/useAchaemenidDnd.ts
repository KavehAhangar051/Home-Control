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
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";

export function computeSegmentDragOverIndices(
  segments: readonly Pick<Segment, "id" | "group">[],
  activeId: string,
  overId: string,
): { activeIndex: number; overIndex: number } | null {
  let activeSeg: Pick<Segment, "id" | "group"> | undefined;
  let overSeg: Pick<Segment, "id" | "group"> | undefined;
  let activeIndex = -1;
  let overIndex = -1;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];

    if (s.id === activeId) {
      activeSeg = s;
      activeIndex = i;
    }

    if (s.id === overId) {
      overSeg = s;
      overIndex = i;
    }

    if (activeSeg && overSeg) break;
  }

  if (!activeSeg || !overSeg) return null;

  if (resolveSegmentGroup(activeSeg.group) !== resolveSegmentGroup(overSeg.group)) {
    return null;
  }

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return null;
  }

  return { activeIndex, overIndex };
}

export type DragEndDecision =
  | { kind: "none" }
  | { kind: "remove_group"; groupId: string }
  | { kind: "remove_segment"; segmentId: string }
  | { kind: "reorder_group"; activeGroupId: string; overGroupId: string };

export function resolveDragEndDecision(
  activeId: string,
  activeType: unknown,
  overId: string | null,
): DragEndDecision {
  if (!overId) return { kind: "none" };

  if (overId === "trash-dropzone") {
    if (activeType === "Group") {
      return {
        kind: "remove_group",
        groupId: activeId.startsWith("group-") ? activeId.slice(6) : activeId,
      };
    }

    if (activeType === "Segment") {
      return { kind: "remove_segment", segmentId: activeId };
    }

    return { kind: "none" };
  }

  if (activeType === "Group") {
    const activeGroupId = activeId.startsWith("group-") ? activeId.slice(6) : activeId;
    const overGroupId = overId.startsWith("group-") ? overId.slice(6) : overId;

    if (activeGroupId !== overGroupId) {
      return { kind: "reorder_group", activeGroupId, overGroupId };
    }
  }

  return { kind: "none" };
}

export function useAchaemenidDnd({
  handleRemoveGroup,
  handleRemoveSegment,
}: {
  handleRemoveGroup: (groupId: string) => void;
  handleRemoveSegment: (id: string) => void;
}) {
  const setSegments = useIoTStore((state) => state.setSegments);
  const setGroupsOrder = useIoTStore((state) => state.setGroupsOrder);

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

      const move = computeSegmentDragOverIndices(
        useIoTStore.getState().segments,
        String(active.id),
        String(over.id),
      );

      if (move) {
        setSegments((prev) => arrayMove(prev, move.activeIndex, move.overIndex));
      }
    },
    [setSegments],
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveSegmentId(null);
      setActiveGroupId(null);
      const { active, over } = e;

      const decision = resolveDragEndDecision(
        String(active.id),
        active.data.current?.type,
        over ? String(over.id) : null,
      );

      if (decision.kind === "remove_group") {
        handleRemoveGroup(decision.groupId);
      } else if (decision.kind === "remove_segment") {
        handleRemoveSegment(decision.segmentId);
      } else if (decision.kind === "reorder_group") {
        setGroupsOrder((prev) => {
          const activeIdx = prev.indexOf(decision.activeGroupId);
          const overIdx = prev.indexOf(decision.overGroupId);

          return activeIdx !== -1 && overIdx !== -1 ? arrayMove(prev, activeIdx, overIdx) : prev;
        });
      }
    },
    [handleRemoveGroup, handleRemoveSegment, setGroupsOrder, setActiveSegmentId, setActiveGroupId],
  );

  return {
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}

export const useDashboardDnd = useAchaemenidDnd;
