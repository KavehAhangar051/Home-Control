"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useCallback } from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

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
    const segment = segments[i];

    if (segment.id === activeId) {
      activeSeg = segment;
      activeIndex = i;
    }

    if (segment.id === overId) {
      overSeg = segment;
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

function reorderSegmentsInGroup(
  segments: Segment[],
  groupId: string,
  fromIndex: number,
  toIndex: number,
): Segment[] {
  if (fromIndex === toIndex) return segments;

  const groupIndexes: number[] = [];
  const groupSegments: Segment[] = [];

  for (let index = 0; index < segments.length; index++) {
    if (resolveSegmentGroup(segments[index].group) === groupId) {
      groupIndexes.push(index);
      groupSegments.push(segments[index]);
    }
  }

  const reordered = moveItem(groupSegments, fromIndex, toIndex);
  if (reordered === groupSegments) return segments;

  const nextSegments = segments.slice();

  for (let index = 0; index < groupIndexes.length; index++) {
    nextSegments[groupIndexes[index]] = reordered[index];
  }

  return nextSegments;
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

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const source = event.operation.source;

      if (source.type === "Group") setActiveGroupId(String(source.id));
      else setActiveSegmentId(String(source.id));
    },
    [setActiveGroupId, setActiveSegmentId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveSegmentId(null);
      setActiveGroupId(null);

      const { source, target } = event.operation;
      if (!source || event.canceled) return;

      const decision = resolveDragEndDecision(
        String(source.id),
        source.type,
        target ? String(target.id) : null,
      );

      if (decision.kind === "remove_group") {
        handleRemoveGroup(decision.groupId);
        return;
      }

      if (decision.kind === "remove_segment") {
        handleRemoveSegment(decision.segmentId);
        return;
      }

      if (!isSortable(source) || source.initialIndex === source.index) return;

      if (source.type === "Group") {
        setGroupsOrder((previous) => moveItem(previous, source.initialIndex, source.index));
        return;
      }

      if (
        source.type === "Segment" &&
        source.initialGroup != null &&
        source.initialGroup === source.group
      ) {
        setSegments((previous) =>
          reorderSegmentsInGroup(
            previous,
            String(source.initialGroup),
            source.initialIndex,
            source.index,
          ),
        );
      }
    },
    [
      handleRemoveGroup,
      handleRemoveSegment,
      setGroupsOrder,
      setSegments,
      setActiveSegmentId,
      setActiveGroupId,
    ],
  );

  return {
    handleDragStart,
    handleDragEnd,
  };
}

export const useDashboardDnd = useAchaemenidDnd;
