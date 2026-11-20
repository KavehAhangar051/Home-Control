"use client";

import React from "react";
import type { IoTWorkspaceProps } from "@/features/iot/components/workspace/core/types";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import CanvasChromeBar from "./CanvasChromeBar";
import CanvasGroupNode from "./CanvasGroupNode";
import CanvasSegmentNode from "./CanvasSegmentNode";
import CanvasWiresLayer from "./CanvasWiresLayer";
import { canvasGroupNodeId, canvasSegmentNodeId } from "./canvasGeometry";
import { type CanvasWorkspaceScope, useCanvasController } from "./useCanvasController";

export type CanvasWorkspaceProps = Omit<
  IoTWorkspaceProps,
  | "sensors"
  | "handleDragStart"
  | "handleDragOver"
  | "handleDragEnd"
  | "activeSegmentId"
  | "activeGroupId"
> & {
  workspaceScope?: CanvasWorkspaceScope;
};

const EMPTY_GROUP_SEGMENTS: Segment[] = [];

export default function CanvasWorkspace({
  workspaceScope = "home",
  groupsOrder,
  animationsEnabled = true,
  selectedGroupFilter = null,
  handleAddPlaceholder,
  handleRemoveGroup,
  handleRemoveSegment,
  handleTogglePin,
  handleSetPinState,
  handleUpdateSegmentMode,
  handleUpdateSegmentAutoOff,
  handleSetupPlaceholder,
}: CanvasWorkspaceProps) {
  const segments = useIoTStore((s) => s.segments);

  const {
    containerRef,
    worldPlaneRef,
    gridLayerRef,
    initialGridStyle,
    settings,
    updateSettings,
    nodes,
    viewport,
    selectedNodeId,
    isPanning,
    draggingNodeId,
    visibleGroups,
    visibleSegments,
    wireConnections,
    bringNodeToFront,
    startNodeDrag,
    startNodeResize,
    handleZoomBy,
    handleFitView,
    handleResetLayout,
    handleChangeSubMode,
    handleCanvasPointerDown,
    handleCanvasContextMenu,
  } = useCanvasController({
    workspaceScope,
    groupsOrder,
    segments,
    selectedGroupFilter,
  });

  const handleZoomIn = React.useCallback(() => handleZoomBy(0.15), [handleZoomBy]);
  const handleZoomOut = React.useCallback(() => handleZoomBy(-0.15), [handleZoomBy]);
  const handleToggleSnap = React.useCallback(
    () => updateSettings({ snapToGrid: !settings.snapToGrid }),
    [settings.snapToGrid, updateSettings],
  );
  const handleToggleLock = React.useCallback(
    () => updateSettings({ isLocked: !settings.isLocked }),
    [settings.isLocked, updateSettings],
  );

  const segmentsByGroup = React.useMemo(() => {
    const map = new Map<string, Segment[]>();

    for (const g of visibleGroups) {
      map.set(g, []);
    }

    for (const seg of visibleSegments) {
      const key = resolveSegmentGroup(seg.group);
      const bucket = map.get(key);

      if (bucket) {
        bucket.push(seg);
      } else {
        map.set(key, [seg]);
      }
    }

    return map;
  }, [visibleGroups, visibleSegments]);

  return (
    <section
      ref={containerRef}
      dir="ltr"
      aria-label={
        workspaceScope === "workflows"
          ? "بوم گردش‌های کاری اتوماسیون (n8n)"
          : "شیت بوم بی‌نهایت گروه‌ها و قطعات"
      }
      onPointerDown={handleCanvasPointerDown}
      onContextMenu={handleCanvasContextMenu}
      style={{
        touchAction: "none",
      }}
      className={`relative size-full min-h-[480px] flex-1 overflow-hidden border-0 bg-bg-main select-none ${
        isPanning ? "cursor-grabbing" : "cursor-default"
      }`}
    >
      {/* Transform-based dot grid layer; compositor promotion is browser-managed */}
      <div
        ref={gridLayerRef}
        aria-hidden="true"
        className="pointer-events-none absolute z-0 will-change-transform"
        style={initialGridStyle}
      />

      {/* Infinite Transformed World Plane */}
      <div
        ref={worldPlaneRef}
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
        className="pointer-events-none absolute top-0 left-0 size-0 overflow-visible"
      >
        <CanvasWiresLayer
          connections={wireConnections}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          animationsEnabled={animationsEnabled}
        />

        {(settings.subMode === "graph" || settings.subMode === "groups") &&
          visibleGroups.map((groupName) => {
            const nodeId = canvasGroupNodeId(groupName);
            const rect = nodes[nodeId];

            if (!rect) return null;

            return (
              <div key={nodeId} className="pointer-events-auto">
                <CanvasGroupNode
                  nodeId={nodeId}
                  groupName={groupName}
                  groupSegments={segmentsByGroup.get(groupName) ?? EMPTY_GROUP_SEGMENTS}
                  rect={rect}
                  subMode={settings.subMode}
                  isSelected={selectedNodeId === nodeId}
                  isDragging={draggingNodeId === nodeId}
                  isLocked={settings.isLocked}
                  animationsEnabled={animationsEnabled}
                  onSelect={bringNodeToFront}
                  onStartDrag={startNodeDrag}
                  onStartResize={startNodeResize}
                  onAddPlaceholder={handleAddPlaceholder}
                  onDeleteGroup={handleRemoveGroup}
                  onRemoveSegment={handleRemoveSegment}
                  onTogglePin={handleTogglePin}
                  onSetPinState={handleSetPinState}
                  onUpdateSegmentMode={handleUpdateSegmentMode}
                  onUpdateSegmentAutoOff={handleUpdateSegmentAutoOff}
                  onSetupPlaceholder={handleSetupPlaceholder}
                />
              </div>
            );
          })}

        {(settings.subMode === "graph" || settings.subMode === "segments") &&
          visibleSegments.map((segment) => {
            const nodeId = canvasSegmentNodeId(segment.id);
            const rect = nodes[nodeId];

            if (!rect) return null;

            return (
              <div key={nodeId} className="pointer-events-auto">
                <CanvasSegmentNode
                  nodeId={nodeId}
                  segment={segment}
                  rect={rect}
                  isSelected={selectedNodeId === nodeId}
                  isDragging={
                    draggingNodeId === nodeId ||
                    (settings.subMode === "graph" &&
                      draggingNodeId === canvasGroupNodeId(resolveSegmentGroup(segment.group)))
                  }
                  isLocked={settings.isLocked}
                  showPort={settings.subMode === "graph"}
                  animationsEnabled={animationsEnabled}
                  onSelect={bringNodeToFront}
                  onStartDrag={startNodeDrag}
                  onStartResize={startNodeResize}
                  onRemoveSegment={handleRemoveSegment}
                  onTogglePin={handleTogglePin}
                  onSetPinState={handleSetPinState}
                  onUpdateSegmentMode={handleUpdateSegmentMode}
                  onUpdateSegmentAutoOff={handleUpdateSegmentAutoOff}
                  onSetupPlaceholder={handleSetupPlaceholder}
                />
              </div>
            );
          })}
      </div>

      {/* Bottom / Footer Chrome Controls */}
      <CanvasChromeBar
        workspaceScope={workspaceScope}
        subMode={settings.subMode}
        zoom={viewport.zoom}
        snapToGrid={settings.snapToGrid}
        isLocked={settings.isLocked}
        onChangeSubMode={handleChangeSubMode}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onToggleSnap={handleToggleSnap}
        onToggleLock={handleToggleLock}
        onResetLayout={handleResetLayout}
      />
    </section>
  );
}
