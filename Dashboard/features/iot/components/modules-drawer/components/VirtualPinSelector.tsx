"use client";

import { Cpu, Plus } from "lucide-react";
import { useMemo } from "react";
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
      <div className="rounded-xl border border-dashed border-border-color bg-secondary/40 p-4 text-center space-y-2.5">
        <div className="mx-auto flex size-9 items-center justify-center rounded-xl border border-accent3/30 bg-accent3/10 text-accent3">
          <Cpu className="size-4.5" strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-primary">
            هنوز هیچ برد کمکی (ESP) ثبت نشده است
          </p>
          <p className="text-[11px] text-text-muted leading-relaxed">
            ابتدا یک برد کمکی با آدرس MAC ثبت کنید تا پایه‌های آن به صورت سگمنت مجازی در دسترس قرار
            گیرند.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAuxNodeModal}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-accent3 px-3 text-xs font-medium text-accent3-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          <span>افزودن برد کمکی (ESP)</span>
        </button>
      </div>
    );
  }

  const chipMeta = AUX_CHIP_META[selectedNode.chipType];
  const isNodeFull = usedCount >= selectedNode.pinCapacity;
  const parsedRemote = remotePin.trim() === "" ? null : Number(remotePin.trim());

  return (
    <div className="space-y-3 rounded-xl border border-border-color bg-secondary/35 p-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="virtual-aux-node-select"
            className="text-xs font-medium text-text-secondary"
          >
            انتخاب برد کمکی (ESP)
          </Label>
          <button
            type="button"
            onClick={onOpenAuxNodeModal}
            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-accent3 hover:underline"
          >
            <Plus className="size-3" strokeWidth={2} />
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
          className="rounded-lg font-sans text-xs"
        >
          {auxNodes.map((node) => {
            const nodeUsed = getAuxNodeActiveSegmentCount(segments, node.nodeId);
            const meta = AUX_CHIP_META[node.chipType];
            return (
              <option key={node.nodeId} value={node.nodeId} className="bg-card-bg-solid">
                {node.name} ({meta.shortLabel} · {node.mac} · {nodeUsed}/{node.pinCapacity})
              </option>
            );
          })}
        </Select>

        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-text-muted">
          <span className="font-mono" dir="ltr">
            {chipMeta.label} · {selectedNode.mac}
          </span>
          <span className={isNodeFull ? "font-medium text-destructive" : "tabular-nums"}>
            ظرفیت استفاده‌شده: {usedCount} از {selectedNode.pinCapacity}
          </span>
        </div>
      </div>

      <div className="space-y-2 border-t border-border-color/70 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="virtual-remote-pin-input"
            className="text-xs font-medium text-text-secondary"
          >
            شماره پایه روی برد کمکی (Remote GPIO)
          </Label>
          <span className="font-mono text-[10px] text-text-muted" dir="ltr">
            0..39 · vPin 40..127
          </span>
        </div>

        <Input
          id="virtual-remote-pin-input"
          aria-label="شماره پایه روی برد کمکی"
          type="number"
          min={LOCAL_GPIO_MIN}
          max={LOCAL_GPIO_MAX}
          placeholder="مثال: 2"
          dir="ltr"
          value={remotePin}
          onChange={(e) => onChangeRemotePin(e.target.value)}
          className="rounded-lg text-left font-mono text-xs tabular-nums"
        />

        <div className="space-y-1.5">
          <span className="block text-[11px] text-text-muted">
            پایه‌های پیشنهادی {chipMeta.shortLabel} (پایه‌های اشغال‌شده غیرفعال هستند):
          </span>
          <div className="flex flex-wrap gap-1.5" dir="ltr">
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
                  title={
                    isOccupied
                      ? `GPIO ${pinNum} روی این برد قبلاً اشغال شده است`
                      : note || `انتخاب Remote GPIO ${pinNum}`
                  }
                  onClick={() => onChangeRemotePin(String(pinNum))}
                  className={`inline-flex h-7 min-w-[44px] items-center justify-center gap-1 rounded-lg border px-2 font-mono text-[11px] tabular-nums transition-colors ${
                    isOccupied
                      ? "cursor-not-allowed border-border-color/50 bg-secondary/40 text-text-muted/45 line-through"
                      : isSelected
                        ? "cursor-pointer border-accent3 bg-accent3 text-accent3-foreground font-semibold"
                        : isRecommended
                          ? "cursor-pointer border-accent3/40 bg-accent3/10 text-text-primary hover:border-accent3"
                          : "cursor-pointer border-border-color bg-card-bg-solid text-text-secondary hover:border-accent3/60 hover:text-text-primary"
                  }`}
                >
                  <span>D{pinNum}</span>
                </button>
              );
            })}
          </div>
          {parsedRemote !== null && chipMeta.pinNotes?.[parsedRemote] && (
            <p className="text-[11px] text-text-muted">
              توضیح پایه {parsedRemote}: {chipMeta.pinNotes[parsedRemote]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
