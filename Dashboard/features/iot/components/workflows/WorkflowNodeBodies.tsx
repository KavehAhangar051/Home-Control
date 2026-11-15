"use client";

import { FolderPlus, Minus, Plus, RefreshCw, X } from "lucide-react";
import React from "react";
import type { Segment } from "@/features/iot/hooks/store/types";
import { resolveSegmentGroup } from "@/features/iot/services/cloudflare/mappers";
import { getSegmentIcon } from "@/features/iot/utils/icons";
import { WorkflowCanvasGateDiagram } from "./WorkflowCanvasGateDiagram";
import type {
  WorkflowActionMode,
  WorkflowGroupEvalMode,
  WorkflowNode,
  WorkflowTimerMode,
} from "./workflowTypes";

const WEEKDAYS_PERSIAN = [
  { day: 6, label: "ش" },
  { day: 0, label: "ی" },
  { day: 1, label: "د" },
  { day: 2, label: "س" },
  { day: 3, label: "چ" },
  { day: 4, label: "پ" },
  { day: 5, label: "ج" },
] as const;

export interface SegmentNodeBodyProps {
  node: WorkflowNode;
  linkedSegment: Segment | undefined;
  isPinOn: boolean;
  onTogglePin: (pin: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}

export function SegmentNodeBody({
  node,
  linkedSegment,
  isPinOn,
  onTogglePin,
  onUpdateNode,
}: SegmentNodeBodyProps) {
  if (!linkedSegment) {
    return (
      <div className="flex flex-1 items-center justify-center text-center text-[11px] text-[var(--text-muted)]">
        این قطعه از فهرست پالایه حذف شده است.
      </div>
    );
  }

  const actionMode = node.actionMode ?? "turn_on";

  return (
    <div className="flex flex-1 flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              isPinOn
                ? "border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)]"
                : "border-[var(--border-color)] bg-[var(--secondary)] text-[var(--text-secondary)]"
            }`}
          >
            {React.createElement(getSegmentIcon(linkedSegment.icon), {
              className: "h-4 w-4",
              "aria-hidden": true,
            })}
          </span>

          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-[var(--text-primary)]">
              {linkedSegment.title}
            </div>
            <div className="truncate font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
              {resolveSegmentGroup(linkedSegment.group)} · GPIO {linkedSegment.pin}
            </div>
          </div>
        </div>

        {linkedSegment.type !== "input" && (
          <button
            type="button"
            onClick={() => onTogglePin(linkedSegment.pin)}
            aria-label={`تغییر وضعیت ${linkedSegment.title}`}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-start rounded-[7px] p-0.5 transition-colors ${
              isPinOn
                ? "border border-transparent bg-[var(--accent3)]"
                : "border border-[var(--border-color)] bg-[var(--input)]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-[14px] w-[14px] rounded-[4px] bg-white shadow-xs transition-transform duration-200 ${
                isPinOn ? "translate-x-0" : "-translate-x-4"
              }`}
            />
          </button>
        )}
      </div>

      {linkedSegment.type === "input" ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
          سنسور ورودی · سطح سیگنال: {isPinOn ? "فعال (۱)" : "غیرفعال (۰)"}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[10px] text-[var(--text-muted)]">فرمان ورودی:</span>
          <select
            aria-label="عملکرد قطعه هنگام دریافت سیگنال"
            value={actionMode}
            onChange={(e) => {
              // SAFETY: select options correspond strictly to WorkflowActionMode
              const val = e.target.value as WorkflowActionMode;
              onUpdateNode(node.id, { actionMode: val });
            }}
            className="h-7 min-w-0 flex-1 cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-[10px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
          >
            <option value="turn_on">روشن شدن (ON)</option>
            <option value="turn_off">خاموش شدن (OFF)</option>
            <option value="toggle">تغییر وضعیت (Toggle)</option>
            <option value="condition_only">فقط خواندن وضعیت (شرط)</option>
          </select>
        </div>
      )}
    </div>
  );
}

export interface GroupNodeBodyProps {
  node: WorkflowNode;
  memberSegments: Segment[];
  availableSegments: Segment[];
  pinsState: Record<string, boolean>;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onAddSegment: (segmentId: string) => void;
  onRemoveSegment: (segmentId: string) => void;
  onSyncFromModules: () => void;
  onTogglePin: (pin: string) => void;
}

export function GroupNodeBody({
  node,
  memberSegments,
  availableSegments,
  pinsState,
  onUpdateNode,
  onAddSegment,
  onRemoveSegment,
  onSyncFromModules,
  onTogglePin,
}: GroupNodeBodyProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Custom Group Name or Module Group Sync */}
      <div className="flex items-center justify-between gap-1.5">
        {node.isCustomGroup ? (
          <input
            type="text"
            value={node.label}
            onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
            aria-label="نام زیرمدار گروه سفارشی"
            placeholder="نام زیرمدار گروه..."
            className="h-7 min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg border border-[var(--border-color)]/70 bg-[var(--bg-main)]/70 px-2 py-1">
            <span className="truncate text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">
              زیرمدار گروه {node.groupName} ({memberSegments.length} قطعه)
            </span>
            <button
              type="button"
              onClick={onSyncFromModules}
              title="همگام‌سازی قطعات با گروه"
              aria-label="همگام‌سازی قطعات از پالایه"
              className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--secondary)] hover:text-[var(--accent3)]"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Member Segments List inside Group */}
      <div
        data-canvas-scroll-area="true"
        className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-color)]/70 bg-[var(--bg-main)]/45 p-1.5"
      >
        {memberSegments.length === 0 ? (
          <div className="flex h-full min-h-[64px] flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-[var(--text-muted)]">
            <FolderPlus className="h-4 w-4 opacity-60" aria-hidden="true" />
            <span>بدون قطعه · از فهرست پایین یا کتابخانه اضافه کنید</span>
          </div>
        ) : (
          memberSegments.map((seg) => {
            const isOn = Boolean(seg.pin && pinsState[seg.pin]);

            return (
              <div
                key={seg.id}
                className="flex items-center justify-between gap-1.5 rounded-md border border-[var(--border-color)]/60 bg-[var(--card-bg-solid)] px-2 py-1"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {React.createElement(getSegmentIcon(seg.icon), {
                    className: `h-3.5 w-3.5 shrink-0 ${isOn ? "text-[var(--accent3)]" : "text-[var(--text-muted)]"}`,
                    "aria-hidden": true,
                  })}
                  <span className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
                    {seg.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {seg.type !== "input" && (
                    <button
                      type="button"
                      onClick={() => onTogglePin(seg.pin)}
                      aria-label={`تغییر ${seg.title}`}
                      className={`cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                        isOn
                          ? "bg-[var(--accent3)] text-[var(--accent3-foreground)]"
                          : "bg-[var(--secondary)] text-[var(--text-muted)]"
                      }`}
                    >
                      {isOn ? "روشن" : "خاموش"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemoveSegment(seg.id)}
                    aria-label={`حذف ${seg.title} از گروه`}
                    className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] hover:bg-red-500/15 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Segment Picker + Evaluation / Action Selectors */}
      <div className="shrink-0 space-y-1.5">
        {availableSegments.length > 0 && (
          <select
            aria-label="افزودن قطعه به زیرمدار گروه"
            value=""
            onChange={(e) => onAddSegment(e.target.value)}
            className="h-7 w-full cursor-pointer rounded-lg border border-dashed border-[var(--accent3)]/50 bg-[var(--bg-main)] px-2 text-[10px] font-semibold text-[var(--accent3)] outline-none focus:border-[var(--accent3)]"
          >
            <option value="">+ افزودن قطعه به این زیرمدار...</option>
            {availableSegments.map((seg) => (
              <option key={seg.id} value={seg.id}>
                {seg.title} (GPIO {seg.pin})
              </option>
            ))}
          </select>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <select
            aria-label="شرط خروجی گروه"
            value={node.groupEvalMode ?? "any_on"}
            onChange={(e) => {
              // SAFETY: options are strictly WorkflowGroupEvalMode
              const val = e.target.value as WorkflowGroupEvalMode;
              onUpdateNode(node.id, { groupEvalMode: val });
            }}
            className="h-6 cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
          >
            <option value="any_on">شرط: حداقل یکی روشن (OR)</option>
            <option value="all_on">شرط: همه روشن (AND)</option>
          </select>

          <select
            aria-label="فرمان ورودی گروه"
            value={node.actionMode ?? "turn_on"}
            onChange={(e) => {
              // SAFETY: options are strictly WorkflowActionMode
              const val = e.target.value as WorkflowActionMode;
              onUpdateNode(node.id, { actionMode: val });
            }}
            className="h-6 cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 text-[10px] font-medium text-[var(--text-secondary)] outline-none"
          >
            <option value="turn_on">فرمان: روشن کردن همه</option>
            <option value="turn_off">فرمان: خاموش کردن همه</option>
            <option value="condition_only">بدون فرمان (فقط شرط)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export interface LogicNodeBodyProps {
  kind: "logic_and" | "logic_or" | "logic_not";
  incomingCount: number;
  inputCount: number;
  minInputCount: number;
  outputSignal: boolean;
  onChangeInputCount: (delta: number) => void;
}

export function LogicNodeBody({
  kind,
  incomingCount,
  inputCount,
  minInputCount,
  outputSignal,
  onChangeInputCount,
}: LogicNodeBodyProps) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-1.5">
      <WorkflowCanvasGateDiagram
        kind={kind}
        incomingCount={incomingCount}
        inputCount={inputCount}
        outputSignal={outputSignal}
      />

      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text-secondary)]">تعداد ورودی</span>

        <div
          dir="ltr"
          className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 py-0.5"
        >
          <button
            type="button"
            disabled={inputCount <= minInputCount}
            onClick={() => onChangeInputCount(-1)}
            aria-label="کاهش تعداد ورودی گیت"
            className="inline-flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Minus className="h-3 w-3" />
          </button>

          <span className="min-w-[18px] text-center font-mono text-[11px] font-bold tabular-nums text-[var(--text-primary)]">
            {inputCount}
          </span>

          <button
            type="button"
            disabled={inputCount >= 8}
            onClick={() => onChangeInputCount(1)}
            aria-label="افزایش تعداد ورودی گیت"
            className="inline-flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export interface TimerNodeBodyProps {
  node: WorkflowNode;
  timerCountdown: number | null;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}

export function TimerNodeBody({ node, timerCountdown, onUpdateNode }: TimerNodeBodyProps) {
  const seconds = node.timerSeconds ?? 5;
  const mode = node.timerMode ?? "delay";

  return (
    <div className="flex flex-1 flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">زمان تاخیر (ثانیه):</span>
        <input
          type="number"
          min={1}
          max={3600}
          value={seconds}
          onChange={(e) => {
            const val = Math.max(1, Math.min(3600, Number(e.target.value) || 1));
            onUpdateNode(node.id, { timerSeconds: val });
          }}
          dir="ltr"
          aria-label="مدت زمان تایمر به ثانیه"
          className="h-7 w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 text-center font-mono text-xs font-bold tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
        />
      </div>

      <div className="grid grid-cols-4 gap-1" dir="ltr">
        {[5, 10, 30, 60].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onUpdateNode(node.id, { timerSeconds: preset })}
            className={`h-6 cursor-pointer rounded-md border text-[10px] font-bold tabular-nums transition-colors ${
              seconds === preset
                ? "border-[var(--accent3)] bg-[var(--accent3-transparent)] text-[var(--accent3)]"
                : "border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {preset}s
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <select
          aria-label="حالت عملکرد تایمر"
          value={mode}
          onChange={(e) => {
            // SAFETY: options are strictly WorkflowTimerMode
            const val = e.target.value as WorkflowTimerMode;
            onUpdateNode(node.id, { timerMode: val });
          }}
          className="h-7 min-w-0 flex-1 cursor-pointer rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 text-[10px] font-semibold text-[var(--text-primary)] outline-none"
        >
          <option value="delay">تاخیر در وصل (On-Delay)</option>
          <option value="hold">نگه‌دارنده پالس (Hold)</option>
        </select>

        {timerCountdown !== null && (
          <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-emerald-500">
            {timerCountdown}s
          </span>
        )}
      </div>
    </div>
  );
}

export interface ScheduleNodeBodyProps {
  node: WorkflowNode;
  onUpdateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
}

export function ScheduleNodeBody({ node, onUpdateNode }: ScheduleNodeBodyProps) {
  const days = node.scheduleDays ?? [];

  const toggleDay = (dayVal: number) => {
    const exists = days.includes(dayVal);
    const next: number[] = [];

    if (exists) {
      for (const d of days) {
        if (d !== dayVal) next.push(d);
      }
    } else {
      next.push(...days, dayVal);
    }

    onUpdateNode(node.id, { scheduleDays: next });
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">ساعت تولید پالس:</span>
        <input
          type="time"
          value={node.scheduleTime ?? "08:00"}
          onChange={(e) => onUpdateNode(node.id, { scheduleTime: e.target.value })}
          dir="ltr"
          aria-label="ساعت اجرای زمان‌بندی"
          className="h-7 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 font-mono text-xs font-bold tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--accent3)]"
        />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_PERSIAN.map((item) => {
          const isOn = days.includes(item.day);

          return (
            <button
              key={item.day}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggleDay(item.day)}
              className={`h-6 cursor-pointer rounded-md border text-[10px] font-bold transition-colors ${
                isOn
                  ? "border-[var(--accent3)] bg-[var(--accent3)] text-[var(--accent3-foreground)]"
                  : "border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
