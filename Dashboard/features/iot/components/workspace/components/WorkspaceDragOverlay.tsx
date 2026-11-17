import { DragOverlay } from "@dnd-kit/core";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import SortableGroup from "../../SortableGroup";
import SortableSegmentCard from "../../SortableSegmentCard";
import { getEffectiveGroupsCols } from "../core/gridUtils";
import type { IoTWorkspaceProps } from "../core/types";

type WorkspaceDragOverlayProps = Pick<
  IoTWorkspaceProps,
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
  const groupsOrder = Array.from(new Set(segments.map((s) => s.group || "Test")));
  const groupIndex = groupsOrder.indexOf(groupId);

  return getEffectiveGroupsCols(Math.max(groupIndex, 0), groupsOrder.length, groupsCols);
}

export default function WorkspaceDragOverlay({
  activeSegmentId,
  activeGroupId,
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
  const segments = useIoTStore((s) => s.segments);

  const activeSegment = activeSegmentId
    ? segments.find((s) => s.id === activeSegmentId)
    : undefined;

  const activeGroupKey = activeGroupId ? activeGroupId.replace("group-", "") : null;

  return (
    <DragOverlay>
      {activeSegment &&
        (() => {
          const groupId = activeSegment.group || "Test";
          const groupSegments = segments.filter((s) => (s.group || "Test") === groupId);
          const index = groupSegments.findIndex((s) => s.id === activeSegmentId);
          const originalGroupCols = groupConfigs[groupId]?.maxCols || 3;
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
                groupMaxCols={originalGroupCols}
                groupItemsCount={groupSegments.length}
                index={Math.max(index, 0)}
                animationsEnabled={animationsEnabled}
                isMobilePortrait={isMobilePortrait}
              />
            </div>
          );
        })()}
      {activeGroupKey &&
        (() => {
          const groupSegments = segments.filter((s) => (s.group || "Test") === activeGroupKey);
          const effectiveGroupsCols = resolveOverlayGroupCols(segments, activeGroupKey, groupsCols);
          const groupMaxCols = groupConfigs[activeGroupKey]?.maxCols || 3;

          return (
            <div style={{ opacity: 0.8, cursor: "grabbing" }}>
              <SortableGroup
                id={activeGroupKey}
                items={groupSegments.map((s) => s.id)}
                segmentCount={groupSegments.length}
                maxCols={groupMaxCols}
                icon={groupConfigs[activeGroupKey]?.icon}
                parentGroupsCols={groupsCols}
                onColsChange={() => {}}
                onAddPlaceholder={() => {}}
                onDeleteGroup={() => {}}
                animationsEnabled={animationsEnabled}
                isOverlayItem={true}
              >
                {groupSegments.map((seg, index) => (
                  <SortableSegmentCard
                    key={seg.id}
                    segment={seg}
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
                    isOverlayItem={true}
                    isMobilePortrait={isMobilePortrait}
                  />
                ))}
              </SortableGroup>
            </div>
          );
        })()}
    </DragOverlay>
  );
}
