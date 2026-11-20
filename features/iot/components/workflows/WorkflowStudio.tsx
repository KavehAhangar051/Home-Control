"use client";

import { AnimatePresence, m } from "motion/react";
import React from "react";
import { createPortal } from "react-dom";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import { usePortalTarget } from "@/lib/hooks/use-portal-target";
import { useWorkflowStudio } from "./useWorkflowStudio";
import WorkflowEmptyState from "./WorkflowEmptyState";
import WorkflowFooterControls from "./WorkflowFooterControls";
import WorkflowHeaderBar from "./WorkflowHeaderBar";
import WorkflowNodeCard from "./WorkflowNodeCard";
import WorkflowPalettePanel from "./WorkflowPalettePanel";
import WorkflowWiresSvg from "./WorkflowWiresSvg";
import { WORKFLOW_PALETTE_MIME } from "./workflowPaletteData";
import type { WorkflowPaletteDragPayload } from "./workflowTypes";

interface WorkflowStudioProps {
  onTogglePin: (pin: string) => void;
  onSetPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
}

const EMPTY_PINS_STATE: Record<string, boolean> = {};

export default function WorkflowStudio({ onTogglePin, onSetPinState }: WorkflowStudioProps) {
  const segments = useIoTStore((s) => s.segments);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const pinsState = useIoTStore((s) => s.pinsState);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const showToast = useIoTStore((s) => s.showToast);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const footerSlot = usePortalTarget("dashboard-footer-center");

  const studio = useWorkflowStudio({
    containerRef,
    segments,
    pinsState,
    onSetPinState,
    showToast,
  });

  const activeEdges = studio.activeWorkflow?.edges;
  const activeNodes = studio.activeWorkflow?.nodes;

  const incomingCountByNode = React.useMemo(() => {
    const map = new Map<string, number>();

    if (!activeEdges) return map;

    for (const edge of activeEdges) {
      map.set(edge.targetId, (map.get(edge.targetId) ?? 0) + 1);
    }

    return map;
  }, [activeEdges]);

  const subflowChildCountByGroup = React.useMemo(() => {
    const map = new Map<string, number>();

    if (!activeNodes) return map;

    for (const node of activeNodes) {
      if (node.parentGroupId) {
        map.set(node.parentGroupId, (map.get(node.parentGroupId) ?? 0) + 1);
      }
    }

    return map;
  }, [activeNodes]);

  if (!studio.activeWorkflow) {
    return (
      <WorkflowEmptyState
        onStartDesigning={studio.handleStartDesigningFirstWorkflow}
        onImportWorkflow={studio.handleImportWorkflow}
      />
    );
  }

  const wf = studio.activeWorkflow;

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(WORKFLOW_PALETTE_MIME);

    if (!raw || !containerRef.current) return;

    e.preventDefault();

    try {
      // SAFETY: Drag payload is serialized from WorkflowPaletteDragPayload
      const payload = JSON.parse(raw) as WorkflowPaletteDragPayload;
      const rect = containerRef.current.getBoundingClientRect();
      const worldX = Math.round((e.clientX - rect.left - wf.viewport.x) / wf.viewport.zoom - 110);
      const worldY = Math.round((e.clientY - rect.top - wf.viewport.y) / wf.viewport.zoom - 60);
      studio.handleAddNode(payload, worldX, worldY);
    } catch {
      // Ignore malformed drop payload
    }
  };

  const footerControls = (
    <WorkflowFooterControls
      inPortal={Boolean(footerSlot)}
      zoom={wf.viewport.zoom}
      snapToGrid={studio.snapToGrid}
      isLocked={studio.isLocked}
      canUndo={studio.canUndo}
      canRedo={studio.canRedo}
      hasSelection={Boolean(studio.selectedNodeId)}
      hasClipboard={studio.hasClipboard}
      onZoomBy={studio.handleZoomBy}
      onFitView={studio.handleFitView}
      onToggleSnap={() => studio.setSnapToGrid(!studio.snapToGrid)}
      onToggleLock={() => studio.setIsLocked(!studio.isLocked)}
      onUndo={studio.handleUndo}
      onRedo={studio.handleRedo}
      onCopy={studio.handleCopySelectedNode}
      onPaste={studio.handlePasteClipboard}
      onDuplicate={studio.handleDuplicateSelectedNode}
      onToggleSubflowGroup={() => studio.handleToggleSubflowGroup()}
    />
  );

  return (
    <div className="relative flex size-full min-h-[480px] flex-1 flex-col overflow-hidden bg-bg-main">
      <WorkflowHeaderBar
        workflows={studio.workflows}
        activeWorkflow={wf}
        isPaletteOpen={studio.isPaletteOpen}
        isConnecting={Boolean(studio.connectingFromId)}
        onTogglePalette={() => studio.setIsPaletteOpen(!studio.isPaletteOpen)}
        onSelectWorkflow={studio.handleSelectWorkflow}
        onCreateWorkflow={studio.handleCreateWorkflow}
        onRenameWorkflow={studio.handleRenameWorkflow}
        onDeleteWorkflow={studio.handleDeleteWorkflow}
        onToggleEnabled={studio.handleToggleEnabled}
        onRunTest={studio.handleRunTest}
        onCancelConnect={() => studio.setConnectingFromId(null)}
        onExportWorkflow={studio.handleExportWorkflow}
        onShareWorkflow={studio.handleShareWorkflow}
        onImportWorkflow={studio.handleImportWorkflow}
      />

      {/* Left-Side n8n Node Palette Panel */}
      <WorkflowPalettePanel
        isOpen={studio.isPaletteOpen}
        onClose={() => studio.setIsPaletteOpen(false)}
        segments={segments}
        groupsOrder={groupsOrder}
        animationsEnabled={animationsEnabled}
        onAddNode={(payload) => studio.handleAddNode(payload)}
      />

      {/* Canvas Area */}
      <section
        ref={containerRef}
        dir="ltr"
        aria-label="بوم طراحی گردش کار"
        onPointerDown={studio.handleCanvasPointerDown}
        onContextMenu={studio.handleCanvasContextMenu}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCanvasDrop}
        style={{
          touchAction: "none",
        }}
        className={`relative min-h-0 w-full flex-1 overflow-hidden select-none ${
          studio.isPanning ? "cursor-grabbing" : "cursor-default"
        }`}
      >
        {/* GPU-composited dot grid layer */}
        <div
          ref={studio.gridLayerRef}
          aria-hidden="true"
          className="pointer-events-none absolute z-0 will-change-transform"
          style={studio.initialGridStyle}
        />
        {/* Mobile & Tablet Connecting Banner */}
        <AnimatePresence>
          {studio.connectingFromId && (
            <m.div
              key="connecting-banner"
              dir="rtl"
              initial={animationsEnabled ? { opacity: 0, scale: 0.95, y: -6 } : false}
              animate={{ opacity: 1, scale: 1, y: 0, transition: TRANSITION_ENTER_QUICK }}
              exit={
                animationsEnabled
                  ? { opacity: 0, scale: 0.96, y: -4, transition: TRANSITION_EXIT_QUICK }
                  : undefined
              }
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-accent3/45 bg-card-bg-solid/95 px-3 py-1.5 text-[11px] font-bold text-accent3 shadow-lg backdrop-blur-md lg:hidden"
            >
              <span className="whitespace-nowrap">پورت ورودی گره مقصد را انتخاب کنید</span>
              <button
                type="button"
                onClick={() => studio.setConnectingFromId(null)}
                className="cursor-pointer rounded-md bg-accent3 px-2 py-0.5 text-[10px] text-accent3-foreground transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                لغو
              </button>
            </m.div>
          )}
        </AnimatePresence>

        {/* Subtle Empty Canvas Guide when workflow has 0 nodes */}
        <AnimatePresence>
          {wf.nodes.length === 0 && (
            <m.div
              key="empty-canvas-guide"
              dir="rtl"
              initial={animationsEnabled ? { opacity: 0, scale: 0.96 } : false}
              animate={{ opacity: 1, scale: 1, transition: TRANSITION_ENTER_QUICK }}
              exit={
                animationsEnabled
                  ? { opacity: 0, scale: 0.96, transition: TRANSITION_EXIT_QUICK }
                  : undefined
              }
              className="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
            >
              <div className="max-w-sm rounded-2xl border border-dashed border-border-color bg-card-bg-solid/95 px-5 py-4 text-center shadow-xs">
                <p className="text-xs font-bold text-text-primary">بوم مدار آماده سیم‌کشی است</p>
                <p className="mt-1 text-[11px] leading-5 text-text-muted">
                  از کتابخانه سمت چپ، گیت‌های منطقی (AND / OR / NOT)، محرک‌ها یا قطعات را به داخل بوم
                  بکشید. برای جابه‌جایی صفحه، روی بوم کلیک راست کرده و بکشید.
                </p>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Transformed Infinite Plane */}
        <div
          ref={studio.worldPlaneRef}
          style={{
            transform: `translate3d(${wf.viewport.x}px, ${wf.viewport.y}px, 0) scale(${wf.viewport.zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
          className="pointer-events-none absolute top-0 left-0 size-0 overflow-visible"
        >
          <WorkflowWiresSvg
            nodes={wf.nodes}
            edges={wf.edges}
            activeEdgeIds={studio.evaluation.activeEdgeIds}
            selectedEdgeId={studio.selectedEdgeId}
            connectingDraft={studio.connectingDraft}
            animationsEnabled={animationsEnabled}
            onSelectEdge={studio.setSelectedEdgeId}
            onDeleteEdge={studio.handleDeleteEdge}
          />

          {wf.nodes.map((node) => (
            <div key={node.id} className="pointer-events-auto">
              <WorkflowNodeCard
                node={node}
                segments={segments}
                pinsState={
                  node.kind === "segment" || node.kind === "group" ? pinsState : EMPTY_PINS_STATE
                }
                outputSignal={Boolean(studio.evaluation.nodeOutputs.get(node.id))}
                incomingCount={incomingCountByNode.get(node.id) ?? 0}
                timerCountdown={studio.timerCountdowns.get(node.id) ?? null}
                isSelected={studio.selectedNodeId === node.id}
                isDragging={
                  studio.draggingNodeId === node.id ||
                  (Boolean(node.parentGroupId) && studio.draggingNodeId === node.parentGroupId)
                }
                isLocked={studio.isLocked}
                animationsEnabled={animationsEnabled}
                isConnectingSource={studio.connectingFromId === node.id}
                isMagneticTarget={studio.connectingDraft?.magneticTargetId === node.id}
                isConnectTargetHighlight={
                  Boolean(studio.connectingFromId) && studio.connectingFromId !== node.id
                }
                subflowChildCount={subflowChildCountByGroup.get(node.id) ?? 0}
                onSelect={studio.bringNodeToFront}
                onStartDrag={studio.startNodeDrag}
                onStartResize={studio.startNodeResize}
                onDeleteNode={studio.handleDeleteNode}
                onUpdateNode={studio.handleUpdateNode}
                onStartPortConnect={studio.handleStartPortConnect}
                onCompletePortConnect={studio.handleCompletePortConnect}
                onTogglePin={onTogglePin}
                onTriggerManualPulse={studio.handleTriggerManualPulse}
                onToggleSubflowGroup={studio.handleToggleSubflowGroup}
              />
            </div>
          ))}
        </div>

        {footerSlot ? createPortal(footerControls, footerSlot) : footerControls}
      </section>
    </div>
  );
}
