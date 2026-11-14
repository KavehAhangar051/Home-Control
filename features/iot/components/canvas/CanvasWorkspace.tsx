"use client";

import React from "react";
import type { IoTWorkspaceProps } from "@/features/iot/components/workspace/core/types";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
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
  const pinsState = useIoTStore((s) => s.pinsState);

  const {
    containerRef,
    settings,
    updateSettings,
    nodes,
    viewport,
    selectedNodeId,
    draggingState,
    isPanning,
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
    backgroundGridStyle,
  } = useCanvasController({
    workspaceScope,
    groupsOrder,
    segments,
    pinsState,
    selectedGroupFilter,
  });

  const segmentsByGroup = React.useMemo(() => {
    const map = new Map<string, Segment[]>();

    for (const g of visibleGroups) {
      map.set(g, []);
    }

    for (const seg of visibleSegments) {
      const key = seg.group || "Test";
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
        ...backgroundGridStyle,
        touchAction: "none",
      }}
      className={`relative h-full min-h-[480px] w-full flex-1 overflow-hidden border-0 bg-[var(--bg-main)] select-none ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      {/* Infinite Transformed World Plane */}
      <div
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
        }}
        className="pointer-events-none absolute top-0 left-0 h-0 w-0 overflow-visible"
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
                  groupSegments={segmentsByGroup.get(groupName) ?? []}
                  rect={rect}
                  subMode={settings.subMode}
                  isSelected={selectedNodeId === nodeId}
                  isDragging={draggingState?.nodeId === nodeId}
                  dragTiltDeg={draggingState?.nodeId === nodeId ? draggingState.tiltDeg : 0}
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
                  isDragging={draggingState?.nodeId === nodeId}
                  dragTiltDeg={draggingState?.nodeId === nodeId ? draggingState.tiltDeg : 0}
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
        onZoomIn={() => handleZoomBy(0.15)}
        onZoomOut={() => handleZoomBy(-0.15)}
        onFitView={handleFitView}
        onToggleSnap={() => updateSettings({ snapToGrid: !settings.snapToGrid })}
        onToggleLock={() => updateSettings({ isLocked: !settings.isLocked })}
        onResetLayout={handleResetLayout}
      />
    </section>
  );
}
