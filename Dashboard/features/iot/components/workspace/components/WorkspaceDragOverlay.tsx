import { DragOverlay } from "@dnd-kit/react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import SortableGroup from "../../SortableGroup";
import SortableSegmentCard from "../../SortableSegmentCard";
import { getEffectiveGroupsCols } from "../core/gridUtils";
import type { IoTWorkspaceProps } from "../core/types";

type WorkspaceDragOverlayProps = Pick<
  IoTWorkspaceProps,
  | "groupsOrder"
  | "activeSegmentId"
  | "activeGroupId"
  | "groupConfigs"
  | "isLoadingIoT"
  | "groupsCols"
  | "animationsEnabled"
  | "handleRemoveSegment"
  | "handleTogglePin"
  | "handleSetPinState"
  | "handleUpdateSegmentMode"
  | "handleUpdateSegmentAutoOff"
  | "handleUpdateSegmentRule"
>;

function resolveOverlayGroupCols(
  segments: ReadonlyArray<{ group?: string }>,
  groupId: string,
  groupsCols: number,
): number {
  const groupsOrder = Array.from(new Set(segments.map((segment) => segment.group || "Test")));
  const groupIndex = groupsOrder.indexOf(groupId);

  return getEffectiveGroupsCols(Math.max(groupIndex, 0), groupsOrder.length, groupsCols);
}

export default function WorkspaceDragOverlay({
  groupsOrder,
  groupConfigs,
  isLoadingIoT,
  groupsCols,
  animationsEnabled,
  handleRemoveSegment,
  handleTogglePin,
  handleSetPinState,
  handleUpdateSegmentMode,
  handleUpdateSegmentAutoOff,
  handleUpdateSegmentRule,
}: WorkspaceDragOverlayProps) {
  const isMobilePortrait = useMediaQuery("(max-width: 767px) and (orientation: portrait)");
  const segments = useIoTStore((state) => state.segments);

  return (
    <DragOverlay>
      {(source) => {
        const sourceId = String(source.id);

        if (source.type === "Segment") {
          const activeSegment = segments.find((segment) => segment.id === sourceId);
          if (!activeSegment) return null;

          const groupId = activeSegment.group || "Test";
          const groupSegments = segments.filter((segment) => (segment.group || "Test") === groupId);
          const index = groupSegments.findIndex((segment) => segment.id === sourceId);
          const groupMaxCols = groupConfigs[groupId]?.maxCols || 3;
          const effectiveGroupsCols = resolveOverlayGroupCols(segments, groupId, groupsCols);

          return (
            <div style={{ opacity: 0.8, cursor: "grabbing" }}>
              <SortableSegmentCard
                segment={activeSegment}
                onRemove={handleRemoveSegment}
                onTogglePin={handleTogglePin}
                onSetPinState={handleSetPinState}
                onUpdateSegmentMode={handleUpdateSegmentMode}
                onUpdateSegmentAutoOff={handleUpdateSegmentAutoOff}
                onUpdateSegmentRule={handleUpdateSegmentRule}
                isLoadingIoT={isLoadingIoT}
                parentGroupsCols={effectiveGroupsCols}
                groupMaxCols={groupMaxCols}
                groupItemsCount={groupSegments.length}
                index={Math.max(index, 0)}
                animationsEnabled={animationsEnabled}
                isMobilePortrait={isMobilePortrait}
                isOverlayItem
              />
            </div>
          );
        }

        if (source.type === "Group") {
          const groupId = sourceId.startsWith("group-") ? sourceId.slice(6) : sourceId;
          const groupSegments = segments.filter((segment) => (segment.group || "Test") === groupId);
          const effectiveGroupsCols = resolveOverlayGroupCols(segments, groupId, groupsCols);
          const groupMaxCols = groupConfigs[groupId]?.maxCols || 3;

          return (
            <div style={{ opacity: 0.8, cursor: "grabbing" }}>
              <SortableGroup
                id={groupId}
                index={Math.max(groupsOrder.indexOf(groupId), 0)}
                items={groupSegments.map((segment) => segment.id)}
                segmentCount={groupSegments.length}
                maxCols={groupMaxCols}
                icon={groupConfigs[groupId]?.icon}
                parentGroupsCols={groupsCols}
                onColsChange={() => {}}
                onAddPlaceholder={() => {}}
                onDeleteGroup={() => {}}
                animationsEnabled={animationsEnabled}
                isOverlayItem
              >
                {groupSegments.map((segment, index) => (
                  <SortableSegmentCard
                    key={segment.id}
                    segment={segment}
                    onRemove={handleRemoveSegment}
                    onTogglePin={handleTogglePin}
                    onSetPinState={handleSetPinState}
                    onUpdateSegmentMode={handleUpdateSegmentMode}
                    onUpdateSegmentAutoOff={handleUpdateSegmentAutoOff}
                    onUpdateSegmentRule={handleUpdateSegmentRule}
                    isLoadingIoT={isLoadingIoT}
                    parentGroupsCols={effectiveGroupsCols}
                    groupMaxCols={groupMaxCols}
                    groupItemsCount={groupSegments.length}
                    index={index}
                    animationsEnabled={animationsEnabled}
                    isOverlayItem
                    isMobilePortrait={isMobilePortrait}
                  />
                ))}
              </SortableGroup>
            </div>
          );
        }

        return null;
      }}
    </DragOverlay>
  );
}
