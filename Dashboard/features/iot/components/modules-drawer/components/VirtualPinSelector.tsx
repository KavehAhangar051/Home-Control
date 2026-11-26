"use client";

import { useMemo } from "react";
import { Cpu } from "@/components/ui/hugeicons-groups/controls";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AuxNodeConfig } from "@/features/iot/services/config/types";
import {
  AUX_CHIP_META,
  getAuxNodeActiveSegmentCount,
  getOccupiedRemotePins,
  LOCAL_GPIO_MAX,
  LOCAL_GPIO_MIN,
} from "@/features/iot/utils/auxNodeUtils";
import { toAsciiDigits } from "@/lib/persianText";
import type { Segment } from "../core/types";

interface VirtualPinSelectorProps {
  auxNodes: AuxNodeConfig[];
  selectedNodeId: number | null;
  onSelectNodeId: (nodeId: number) => void;
  remotePin: string;
  onChangeRemotePin: (val: string) => void;
  segments: Segment[];
  onOpenAuxNodeModal: () => void;
}

export default function VirtualPinSelector({
  auxNodes,
  selectedNodeId,
  onSelectNodeId,
  remotePin,
  onChangeRemotePin,
  segments,
  onOpenAuxNodeModal,
}: VirtualPinSelectorProps) {
  const selectedNode = useMemo(
    () => auxNodes.find((n) => n.nodeId === selectedNodeId) ?? auxNodes[0] ?? null,
    [auxNodes, selectedNodeId],
  );

  const occupiedRemotePins = useMemo(
    () => (selectedNode ? getOccupiedRemotePins(segments, selectedNode.nodeId) : new Set<number>()),
    [segments, selectedNode],
  );

  const usedCount = useMemo(
    () => (selectedNode ? getAuxNodeActiveSegmentCount(segments, selectedNode.nodeId) : 0),
    [segments, selectedNode],
  );

  if (auxNodes.length === 0 || !selectedNode) {
    return (
      <div className="space-y-4 rounded-xl border border-dashed border-border-color bg-bg-main p-6 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-border-color bg-card-bg-solid text-accent3">
          <Cpu className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-bold text-text-primary">هنوز برد کمکی ثبت نشده است</p>
          <p className="mx-auto max-w-sm text-xs leading-6 text-text-secondary sm:text-[13px]">
            ابتدا یک برد کمکی با آدرس MAC ثبت کنید تا پایه‌های آن در این فهرست قابل انتخاب شوند.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAuxNodeModal}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent3 px-5 text-sm font-bold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset"
        >
          <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
          <span>ثبت برد کمکی جدید</span>
        </button>
      </div>
    );
  }

  const chipMeta = AUX_CHIP_META[selectedNode.chipType];
  const isNodeFull = usedCount >= selectedNode.pinCapacity;
  const parsedRemote = remotePin.trim() === "" ? null : Number(remotePin.trim());

  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="virtual-aux-node-select" className="text-sm font-bold text-text-primary">
            انتخاب برد کمکی (ESP)
          </Label>
          <button
            type="button"
            onClick={onOpenAuxNodeModal}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-accent3 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 sm:text-[13px]"
          >
            <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
            <span>برد جدید</span>
          </button>
        </div>

        <Select
          id="virtual-aux-node-select"
          aria-label="انتخاب برد کمکی"
          value={selectedNode.nodeId}
          onChange={(e) => {
            const nextId = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(nextId)) {
              onSelectNodeId(nextId);
              onChangeRemotePin("");
            }
          }}
          className="h-11 font-sans text-base sm:text-sm"
        >
          {auxNodes.map((node) => {
            const nodeUsed = getAuxNodeActiveSegmentCount(segments, node.nodeId);
            const meta = AUX_CHIP_META[node.chipType];
            return (
              <option key={node.nodeId} value={node.nodeId} className="bg-card-bg-solid">
                {node.name} ({meta.shortLabel} · {nodeUsed}/{node.pinCapacity})
              </option>
            );
          })}
        </Select>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
          <span className="font-mono" dir="ltr">
            {chipMeta.label} · {selectedNode.mac}
          </span>
          <span className={isNodeFull ? "font-semibold text-destructive" : "tabular-nums"}>
            پایه‌های اختصاص‌یافته: {usedCount} از {selectedNode.pinCapacity}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="virtual-remote-pin-input" className="text-sm font-bold text-text-primary">
            شماره پایه روی برد کمکی (GPIO)
          </Label>
          <span className="font-mono text-xs tabular-nums text-text-secondary" dir="ltr">
            {LOCAL_GPIO_MIN}..{LOCAL_GPIO_MAX}
          </span>
        </div>

        <Input
          id="virtual-remote-pin-input"
          aria-label="شماره پایه روی برد کمکی"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder="مثال: 2"
          dir="ltr"
          value={remotePin}
          onChange={(e) => onChangeRemotePin(toAsciiDigits(e.target.value).replace(/[^0-9]/g, ""))}
          className="h-11 font-mono text-base tabular-nums text-start placeholder:font-sans placeholder:text-sm sm:text-sm sm:placeholder:text-xs"
        />

        <div className="space-y-2.5">
          <span className="block text-xs font-semibold text-text-secondary sm:text-[13px]">
            پایه‌های پیشنهادی {chipMeta.shortLabel}
          </span>
          <div className="flex flex-wrap gap-2" dir="ltr">
            {chipMeta.suggestedPins.map((pinNum) => {
              const isOccupied = occupiedRemotePins.has(pinNum);
              const isSelected = parsedRemote === pinNum;
              const isRecommended = chipMeta.recommendedPins?.includes(pinNum) ?? false;
              const note = chipMeta.pinNotes?.[pinNum];

              return (
                <button
                  key={pinNum}
                  type="button"
                  disabled={isOccupied}
                  aria-pressed={isSelected}
                  title={
                    isOccupied
                      ? `GPIO ${pinNum} روی این برد قبلاً اشغال شده است`
                      : note || `انتخاب GPIO ${pinNum}`
                  }
                  onClick={() => onChangeRemotePin(String(pinNum))}
                  className={`inline-flex min-h-10 min-w-12 items-center justify-center rounded-xl border px-3 font-mono text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 ${
                    isOccupied
                      ? "cursor-not-allowed border-border-color/60 bg-bg-main text-text-muted/45 line-through"
                      : isSelected
                        ? "cursor-pointer border-accent3 bg-accent3 font-bold text-accent3-foreground"
                        : isRecommended
                          ? "cursor-pointer border-accent3/40 bg-accent3-transparent text-text-primary hover:border-accent3"
                          : "cursor-pointer border-border-color bg-bg-main text-text-primary hover:border-accent3/60 hover:bg-card-hover-bg"
                  }`}
                >
                  D{pinNum}
                </button>
              );
            })}
          </div>
          {parsedRemote !== null && chipMeta.pinNotes?.[parsedRemote] && (
            <p className="text-xs leading-6 text-text-secondary">
              نکته پایه {parsedRemote}: {chipMeta.pinNotes[parsedRemote]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
