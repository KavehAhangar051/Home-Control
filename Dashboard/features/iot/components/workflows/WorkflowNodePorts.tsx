"use client";

import type React from "react";

export interface WorkflowInputPortSlot {
  key: string;
  index: number;
  offsetY: number;
}

interface WorkflowNodePortsProps {
  nodeId: string;
  nodeLabel: string;
  inputPortSlots: WorkflowInputPortSlot[];
  incomingCount: number;
  outputSignal: boolean;
  isConnectingSource: boolean;
  isMagneticTarget: boolean;
  isConnectTargetHighlight: boolean;
  shouldAnimateMotion: boolean;
  onStartPortConnect: (nodeId: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  onCompletePortConnect: (
    targetNodeId: string,
    e: React.MouseEvent<HTMLButtonElement>,
    targetPortIndex?: number,
  ) => void;
}

function resolveInputPortClassName(
  isMagneticTarget: boolean,
  isConnectTargetHighlight: boolean,
  isPortConnected: boolean,
): string {
  if (isMagneticTarget) {
    return "scale-120 border-success bg-success text-success-foreground shadow-[0_0_10px_var(--success)]";
  }

  if (isConnectTargetHighlight) {
    return "animate-pulse border-accent3 bg-accent3 text-accent3-foreground shadow-xs";
  }

  if (isPortConnected) {
    return "border-accent3 bg-card-bg-solid";
  }

  return "border-border-color bg-card-bg-solid hover:border-accent3";
}

function resolveOutputPortClassName(isConnectingSource: boolean, outputSignal: boolean): string {
  if (isConnectingSource) {
    return "scale-115 border-accent3 bg-accent3 text-accent3-foreground shadow-xs";
  }

  if (outputSignal) {
    return "border-success bg-success text-success-foreground shadow-[0_0_8px_var(--success)]";
  }

  return "border-border-color bg-card-bg-solid text-text-muted hover:border-accent3";
}

/**
 * Renders the left input terminals and right output terminal for a workflow node.
 */
export default function WorkflowNodePorts({
  nodeId,
  nodeLabel,
  inputPortSlots,
  incomingCount,
  outputSignal,
  isConnectingSource,
  isMagneticTarget,
  isConnectTargetHighlight,
  shouldAnimateMotion,
  onStartPortConnect,
  onCompletePortConnect,
}: WorkflowNodePortsProps) {
  const outputClass = resolveOutputPortClassName(isConnectingSource, outputSignal);

  return (
    <>
      {inputPortSlots.map((slot) => {
        const isPortConnected = slot.index < incomingCount;

        const inputClass = resolveInputPortClassName(
          isMagneticTarget,
          isConnectTargetHighlight,
          isPortConnected,
        );

        return (
          <button
            key={slot.key}
            type="button"
            data-workflow-port="in"
            data-node-id={nodeId}
            data-port-index={slot.index}
            aria-label={`پورت ورودی ${slot.index + 1} ${nodeLabel}`}
            onPointerDown={(e) => {
              if (e.button !== 2) e.stopPropagation();
            }}
            onClick={(e) => onCompletePortConnect(nodeId, e, slot.index)}
            style={{ top: `${slot.offsetY}px` }}
            className={`absolute -left-2.5 z-30 flex size-4.5 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-md border-2 transition-[transform,border-color,background-color] duration-150 ease-out hover:scale-115 active:scale-95 ${inputClass}`}
          >
            <span className="size-1.5 rounded-[2px] bg-current opacity-80" />
            {isMagneticTarget && shouldAnimateMotion && (
              <span
                aria-hidden="true"
                className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-md border border-success"
              />
            )}
          </button>
        );
      })}

      <button
        type="button"
        data-workflow-port="out"
        data-node-id={nodeId}
        aria-label={`پورت خروجی ${nodeLabel}`}
        onPointerDown={(e) => onStartPortConnect(nodeId, e)}
        className={`absolute top-1/2 -right-2.5 z-30 flex size-5 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-md border-2 transition-[transform,border-color,background-color] duration-150 ease-out hover:scale-115 active:scale-95 ${outputClass}`}
      >
        <span className="size-1.5 rounded-[2px] bg-current" />
        {outputSignal && shouldAnimateMotion && (
          <span
            aria-hidden="true"
            className="animate-port-wakeup pointer-events-none absolute inset-0 rounded-md border border-success"
          />
        )}
      </button>
    </>
  );
}
