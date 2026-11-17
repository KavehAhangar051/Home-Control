"use client";

import { GripHorizontal, Minus, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { WorkflowSchematicSymbol } from "./WorkflowSchematicSymbols";
import type { WorkflowNode } from "./workflowTypes";

interface WorkflowNodeHeaderProps {
  node: WorkflowNode;
  isLocked: boolean;
  isLogicGate: boolean;
  hasInputPort: boolean;
  isInputSegment: boolean;
  outputSignal: boolean;
  inputCount: number;
  minInputCount: number;
  onStartDrag: (nodeId: string, e: React.PointerEvent<HTMLElement>) => void;
  onChangeInputCount: (delta: number) => void;
  onDeleteNode: (nodeId: string) => void;
}

/**
 * Draggable top bar of a workflow node showing its schematic icon, title,
 * input-count stepper (where applicable), and delete control.
 */
export default function WorkflowNodeHeader({
  node,
  isLocked,
  isLogicGate,
  hasInputPort,
  isInputSegment,
  outputSignal,
  inputCount,
  minInputCount,
  onStartDrag,
  onChangeInputCount,
  onDeleteNode,
}: WorkflowNodeHeaderProps) {
  return (
    <div
      onPointerDown={(e) => {
        if (e.button === 0) onStartDrag(node.id, e);
      }}
      style={{ touchAction: "none" }}
      className={`flex h-8 shrink-0 items-center justify-between gap-2 rounded-t-2xl border-b border-border-color/70 bg-secondary/70 px-3 ${
        isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <GripHorizontal className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
        {!isLogicGate && (
          <span
            dir="ltr"
            className={`inline-flex shrink-0 items-center ${
              outputSignal ? "text-success" : "text-text-secondary"
            }`}
          >
            <WorkflowSchematicSymbol
              kind={node.kind}
              isCustomGroup={node.isCustomGroup}
              isInputSegment={isInputSegment}
              className="h-4 w-7"
            />
          </span>
        )}
        <span
          dir={isLogicGate ? "ltr" : undefined}
          className={`truncate text-[11px] font-bold text-text-primary ${
            isLogicGate ? "font-mono" : ""
          }`}
        >
          {node.label}
        </span>
      </div>

      <div
        className="flex shrink-0 items-center gap-1"
        onPointerDown={(e) => {
          if (e.button !== 2) e.stopPropagation();
        }}
      >
        {hasInputPort && !isLogicGate && (
          <div
            dir="ltr"
            className="flex items-center gap-0.5 rounded-md border border-border-color bg-bg-main px-1 py-0.5 text-[10px]"
            title="تعداد ورودی‌ها"
          >
            <button
              type="button"
              disabled={inputCount <= minInputCount}
              onClick={() => onChangeInputCount(-1)}
              aria-label="کاهش تعداد ورودی"
              className="inline-flex size-4 cursor-pointer items-center justify-center rounded text-text-muted hover:bg-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Minus className="size-2.5" />
            </button>
            <span className="min-w-[14px] text-center font-mono text-[10px] font-bold tabular-nums text-text-primary">
              {inputCount}
            </span>
            <button
              type="button"
              disabled={inputCount >= 8}
              onClick={() => onChangeInputCount(1)}
              aria-label="افزایش تعداد ورودی"
              className="inline-flex size-4 cursor-pointer items-center justify-center rounded text-text-muted hover:bg-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus className="size-2.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onDeleteNode(node.id)}
          aria-label={`حذف گره ${node.label}`}
          className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-destructive-soft hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
