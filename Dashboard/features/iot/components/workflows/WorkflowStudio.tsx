"use client";

import { Grid, Lock, Maximize, Minus, Plus, Unlock } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import WorkflowEmptyState from "./WorkflowEmptyState";
import WorkflowHeaderBar from "./WorkflowHeaderBar";
import WorkflowNodeCard from "./WorkflowNodeCard";
import WorkflowPalettePanel, { WORKFLOW_PALETTE_MIME } from "./WorkflowPalettePanel";
import WorkflowWiresSvg from "./WorkflowWiresSvg";
import { useWorkflowStudio } from "./useWorkflowStudio";
import type { WorkflowPaletteDragPayload } from "./workflowTypes";

interface WorkflowStudioProps {
  onTogglePin: (pin: string) => void;
  onSetPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
}

export default function WorkflowStudio({ onTogglePin, onSetPinState }: WorkflowStudioProps) {
  const segments = useIoTStore((s) => s.segments);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const pinsState = useIoTStore((s) => s.pinsState);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const showToast = useIoTStore((s) => s.showToast);

  const [footerSlot, setFooterSlot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setFooterSlot(document.getElementById("dashboard-footer-center"));
  }, []);

  const studio = useWorkflowStudio({
    segments,
    pinsState,
    onSetPinState,
    showToast,
  });

  const incomingCountByNode = React.useMemo(() => {
    const map = new Map<string, number>();

    if (!studio.activeWorkflow) return map;

    for (const edge of studio.activeWorkflow.edges) {
      map.set(edge.targetId, (map.get(edge.targetId) ?? 0) + 1);
    }

    return map;
  }, [studio.activeWorkflow]);

  if (!studio.activeWorkflow) {
    return <WorkflowEmptyState onStartDesigning={studio.handleStartDesigningFirstWorkflow} />;
  }

  const wf = studio.activeWorkflow;

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(WORKFLOW_PALETTE_MIME);

    if (!raw || !studio.containerRef.current) return;

    e.preventDefault();

    try {
      // SAFETY: Drag payload is serialized from WorkflowPaletteDragPayload
      const payload = JSON.parse(raw) as WorkflowPaletteDragPayload;
      const rect = studio.containerRef.current.getBoundingClientRect();
      const worldX = Math.round((e.clientX - rect.left - wf.viewport.x) / wf.viewport.zoom - 110);
      const worldY = Math.round((e.clientY - rect.top - wf.viewport.y) / wf.viewport.zoom - 60);
      studio.handleAddNode(payload, worldX, worldY);
    } catch {
      // Ignore malformed drop payload
    }
  };

  const footerControls = (
    <div
      dir="rtl"
      onPointerDown={(e) => e.stopPropagation()}
      className={
        footerSlot
          ? "pointer-events-auto flex max-w-full items-center justify-center"
          : "pointer-events-none absolute inset-x-0 bottom-2.5 z-40 flex items-center justify-center px-2"
      }
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)]/95 px-2 py-1 text-xs shadow-lg backdrop-blur-xl">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => studio.handleZoomBy(-0.15)}
                aria-label="کوچک‌نمایی"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            }
          />
          <TooltipContent>کوچک‌نمایی</TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={studio.handleFitView}
          aria-label="بازنشانی بزرگ‌نمایی"
          className="inline-flex h-7 min-w-[44px] cursor-pointer items-center justify-center rounded-lg px-1.5 text-[11px] font-bold tabular-nums text-[var(--text-primary)] transition-colors hover:bg-[var(--secondary)]"
        >
          {Math.round(wf.viewport.zoom * 100)}%
        </button>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => studio.handleZoomBy(0.15)}
                aria-label="بزرگ‌نمایی"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            }
          />
          <TooltipContent>بزرگ‌نمایی</TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={studio.handleFitView}
          aria-label="نمای کلی گره‌ها"
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--secondary)] px-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent3)]"
        >
          <Maximize className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden md:inline">نمای کلی</span>
        </button>

        <div className="flex items-center gap-0.5 border-r border-[var(--border-color)] pr-1">
          <button
            type="button"
            aria-pressed={studio.snapToGrid}
            onClick={() => studio.setSnapToGrid(!studio.snapToGrid)}
            aria-label="چسبندگی به شبکه"
            className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors ${
              studio.snapToGrid
                ? "bg-[var(--accent3-transparent)] text-[var(--accent3)]"
                : "text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Grid className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            aria-pressed={studio.isLocked}
            onClick={() => studio.setIsLocked(!studio.isLocked)}
            aria-label={studio.isLocked ? "باز کردن قفل بوم" : "قفل کردن بوم"}
            className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors ${
              studio.isLocked
                ? "bg-amber-500/15 text-amber-500"
                : "text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {studio.isLocked ? (
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Unlock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden lg:inline">{studio.isLocked ? "قفل" : "آزاد"}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-[480px] w-full flex-1 flex-col overflow-hidden bg-[var(--bg-main)]">
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
      />

      {/* Left-Side n8n Node Palette Panel */}
      <WorkflowPalettePanel
        isOpen={studio.isPaletteOpen}
        onClose={() => studio.setIsPaletteOpen(false)}
        segments={segments}
        groupsOrder={groupsOrder}
        onAddNode={(payload) => studio.handleAddNode(payload)}
      />

      {/* Empty Canvas Area */}
      <section
        ref={studio.containerRef}
        dir="ltr"
        aria-label="بوم طراحی گردش کار"
        onPointerDown={studio.handleCanvasPointerDown}
        onContextMenu={studio.handleCanvasContextMenu}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCanvasDrop}
        style={{
          ...studio.backgroundGridStyle,
          touchAction: "none",
        }}
        className={`relative min-h-0 w-full flex-1 overflow-hidden select-none ${
          studio.isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Mobile & Tablet Connecting Banner */}
        {studio.connectingFromId && (
          <div
            dir="rtl"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[var(--accent3)]/45 bg-[var(--card-bg-solid)]/95 px-3 py-1.5 text-[11px] font-bold text-[var(--accent3)] shadow-lg backdrop-blur-md lg:hidden"
          >
            <span className="whitespace-nowrap">روی پورت ورودی گره مقصد بزنید</span>
            <button
              type="button"
              onClick={() => studio.setConnectingFromId(null)}
              className="cursor-pointer rounded-md bg-[var(--accent3)] px-2 py-0.5 text-[10px] text-[var(--accent3-foreground)]"
            >
              لغو
            </button>
          </div>
        )}

        {/* Subtle Empty Canvas Guide when workflow has 0 nodes */}
        {wf.nodes.length === 0 && (
          <div
            dir="rtl"
            className="pointer-events-none absolute inset-0 flex items-center justify-center p-6"
          >
            <div className="max-w-sm rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--card-bg-solid)]/80 px-5 py-4 text-center backdrop-blur-sm">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                بوم خالی آماده طراحی است
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
                از پنل سمت چپ بوم، سگمنت‌ها، گروه خالی یا آماده، بوابه‌های AND / OR / NOT و تایمر را
                اضافه کرده و پورت‌ها را به هم وصل کنید.
              </p>
            </div>
          </div>
        )}

        {/* Transformed Infinite Plane */}
        <div
          style={{
            transform: `translate3d(${wf.viewport.x}px, ${wf.viewport.y}px, 0) scale(${wf.viewport.zoom})`,
            transformOrigin: "0 0",
          }}
          className="pointer-events-none absolute top-0 left-0 h-0 w-0 overflow-visible"
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
                pinsState={pinsState}
                outputSignal={Boolean(studio.evaluation.nodeOutputs.get(node.id))}
                incomingCount={incomingCountByNode.get(node.id) ?? 0}
                timerCountdown={studio.timerCountdowns.get(node.id) ?? null}
                isSelected={studio.selectedNodeId === node.id}
                isDragging={studio.draggingState?.nodeId === node.id}
                dragTiltDeg={
                  studio.draggingState?.nodeId === node.id ? studio.draggingState.tiltDeg : 0
                }
                isLocked={studio.isLocked}
                isConnectingSource={
                  studio.connectingFromId === node.id ||
                  studio.connectingDraft?.sourceId === node.id
                }
                isConnectTargetHighlight={
                  Boolean(studio.connectingFromId) && studio.connectingFromId !== node.id
                }
                isMagneticTarget={studio.connectingDraft?.magneticTargetId === node.id}
                isRecentlyConnected={studio.recentlyConnectedNodeId === node.id}
                animationsEnabled={animationsEnabled}
                onSelect={studio.bringNodeToFront}
                onStartDrag={studio.startNodeDrag}
                onStartResize={studio.startNodeResize}
                onDeleteNode={studio.handleDeleteNode}
                onUpdateNode={studio.handleUpdateNode}
                onStartPortConnect={studio.handleStartPortConnect}
                onCompletePortConnect={studio.handleCompletePortConnect}
                onTogglePin={onTogglePin}
                onTriggerManualPulse={studio.handleTriggerManualPulse}
              />
            </div>
          ))}
        </div>

        {footerSlot ? createPortal(footerControls, footerSlot) : footerControls}
      </section>
    </div>
  );
}
