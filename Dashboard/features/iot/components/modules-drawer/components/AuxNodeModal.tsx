"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Check, Cpu, Info } from "@/components/ui/hugeicons-groups/controls";
import { X } from "@/components/ui/hugeicons-groups/shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useDashboardActions } from "@/features/dashboard/context/DashboardContext";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { AuxChipType } from "@/features/iot/services/config/types";
import {
  AUX_CHIP_META,
  AUX_CHIP_OPTIONS,
  AUX_NODE_NAME_MAX_BYTES,
  formatMacLiveInput,
  getAuxNodeActiveSegmentCount,
  MAX_AUX_NODES,
  MAX_AUX_PIN_CAPACITY,
  parseAndValidateMac,
} from "@/features/iot/utils/auxNodeUtils";
import { TRANSITION_ENTER_QUICK, TRANSITION_EXIT_QUICK } from "@/lib/ease";

const utf8Encoder = new TextEncoder();

export default function AuxNodeModal() {
  const isOpen = useIoTStore((s) => s.isAuxNodeModalOpen);
  const editingNodeId = useIoTStore((s) => s.editingAuxNodeId);
  const closeAuxNodeModal = useIoTStore((s) => s.closeAuxNodeModal);
  const auxNodes = useIoTStore((s) => s.auxNodes);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const segments = useIoTStore((s) => s.segments);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const { handleCreateAuxNode, handleUpdateAuxNode } = useDashboardActions();

  const editingNode = useMemo(
    () =>
      editingNodeId !== null ? (auxNodes.find((n) => n.nodeId === editingNodeId) ?? null) : null,
    [auxNodes, editingNodeId],
  );

  const isEditMode = editingNode !== null;

  const activeSegmentCount = useMemo(
    () => (editingNode ? getAuxNodeActiveSegmentCount(segments, editingNode.nodeId) : 0),
    [editingNode, segments],
  );

  const [name, setName] = useState("");
  const [mac, setMac] = useState("");
  const [chipType, setChipType] = useState<AuxChipType>("esp8266_01");
  const [pinCapacity, setPinCapacity] = useState<number>(AUX_CHIP_META.esp8266_01.defaultCapacity);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setFormError("");
    if (editingNode) {
      setName(editingNode.name);
      setMac(editingNode.mac);
      setChipType(editingNode.chipType);
      setPinCapacity(editingNode.pinCapacity);
    } else {
      setName("");
      setMac("");
      setChipType("esp8266_01");
      setPinCapacity(AUX_CHIP_META.esp8266_01.defaultCapacity);
    }
  }, [isOpen, editingNode]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAuxNodeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeAuxNodeModal]);

  const nameByteLength = utf8Encoder.encode(name.trim()).length;
  const macCheck = mac.trim().length > 0 ? parseAndValidateMac(mac) : null;
  const duplicateMac =
    macCheck?.ok === true &&
    auxNodes.some(
      (n) => n.nodeId !== editingNode?.nodeId && n.mac.toUpperCase() === macCheck.formatted,
    );
  const duplicateGroup =
    name.trim().length > 0 &&
    name.trim() !== editingNode?.groupName &&
    (groupsOrder.includes(name.trim()) ||
      auxNodes.some((n) => n.nodeId !== editingNode?.nodeId && n.groupName === name.trim()));

  const minCapacity = Math.max(1, activeSegmentCount);
  const chipMeta = AUX_CHIP_META[chipType];
  const isCapacityFull = !isEditMode && auxNodes.length >= MAX_AUX_NODES;

  const handleChipChange = (nextChip: AuxChipType) => {
    setChipType(nextChip);
    if (!isEditMode) {
      setPinCapacity(AUX_CHIP_META[nextChip].defaultCapacity);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("نام برد کمکی را وارد کنید.");
      return;
    }

    if (duplicateGroup) {
      setFormError(`گروه «${trimmedName}» قبلاً وجود دارد؛ نام دیگری انتخاب کنید.`);
      return;
    }

    const validation = parseAndValidateMac(mac);
    if (!validation.ok) {
      setFormError(validation.error);
      return;
    }

    if (duplicateMac) {
      setFormError(`آدرس MAC ${validation.formatted} قبلاً برای برد کمکی دیگری ثبت شده است.`);
      return;
    }

    const parsedCap = Math.trunc(Number(pinCapacity));
    if (
      !Number.isInteger(parsedCap) ||
      parsedCap < minCapacity ||
      parsedCap > MAX_AUX_PIN_CAPACITY
    ) {
      setFormError(`ظرفیت پایه باید عددی بین ${minCapacity} تا ${MAX_AUX_PIN_CAPACITY} باشد.`);
      return;
    }

    const payload = {
      name: trimmedName,
      mac: validation.formatted,
      chipType,
      pinCapacity: parsedCap,
      groupName: trimmedName,
    };

    const ok = isEditMode
      ? handleUpdateAuxNode(editingNode.nodeId, payload)
      : handleCreateAuxNode(payload);

    if (ok) {
      closeAuxNodeModal();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          key="aux-node-modal-backdrop"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="aux-node-modal-title"
          initial={animationsEnabled ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={animationsEnabled ? { opacity: 0 } : { opacity: 0, transition: { duration: 0 } }}
          transition={animationsEnabled ? TRANSITION_ENTER_QUICK : { duration: 0 }}
          onClick={closeAuxNodeModal}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-4"
        >
          <m.div
            key="aux-node-modal-panel"
            initial={animationsEnabled ? { opacity: 0, scale: 0.96, y: 10 } : false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              animationsEnabled
                ? { opacity: 0, scale: 0.96, y: 8, transition: TRANSITION_EXIT_QUICK }
                : { opacity: 0, transition: { duration: 0 } }
            }
            transition={animationsEnabled ? TRANSITION_ENTER_QUICK : { duration: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bezel-shell w-full max-w-md shadow-2xl"
          >
            <div className="bezel-core overflow-hidden rounded-[calc(var(--radius-2xl)-4px)] bg-card-bg-solid text-right">
              <div className="flex items-center justify-between gap-3 border-b border-border-color bg-card-hover-bg px-4 py-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent3/30 bg-accent3/12 text-accent3">
                    <Cpu className="size-4.5" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="aux-node-modal-title"
                      className="truncate font-sans text-sm font-semibold text-text-primary"
                    >
                      {isEditMode ? `ویرایش برد کمکی #${editingNode.nodeId}` : "افزودن برد کمکی"}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeAuxNodeModal}
                  aria-label="بستن پنجره برد کمکی"
                  className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-color bg-card-bg text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
                >
                  <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 p-4">
                {isCapacityFull && (
                  <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <Info className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>حداکثر ظرفیت ثبت برد کمکی ({MAX_AUX_NODES} عدد) تکمیل شده است.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="aux-node-name"
                      className="text-xs font-medium text-text-secondary"
                    >
                      نام برد کمکی و گروه آن
                    </Label>
                    <span
                      className={`font-mono text-[10px] tabular-nums ${
                        nameByteLength > AUX_NODE_NAME_MAX_BYTES
                          ? "text-warning"
                          : "text-text-muted"
                      }`}
                      dir="ltr"
                    >
                      {nameByteLength}/{AUX_NODE_NAME_MAX_BYTES} B
                    </span>
                  </div>
                  <Input
                    id="aux-node-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="مثال: روشنایی باغچه"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg text-right font-sans text-xs"
                  />
                  {duplicateGroup && (
                    <p className="text-[11px] text-destructive">
                      این نام گروه قبلاً استفاده شده است.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="aux-node-mac"
                      className="text-xs font-medium text-text-secondary"
                    >
                      آدرس MAC برد
                    </Label>
                    {macCheck?.ok && !duplicateMac && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                        <Check className="size-3" />
                        معتبر
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-text-secondary">آدرس MAC شناسه یکتای برد در شبکه است؛ آن را از تنظیمات یا برچسب همان برد وارد کنید.</p>
                  <Input
                    id="aux-node-mac"
                    type="text"
                    required
                    dir="ltr"
                    placeholder="AA:BB:CC:DD:EE:01"
                    value={mac}
                    onChange={(e) => setMac(formatMacLiveInput(e.target.value))}
                    maxLength={17}
                    className="rounded-lg text-left font-mono text-xs tracking-wider uppercase"
                  />
                  {mac.trim().length > 0 && macCheck && !macCheck.ok && (
                    <p className="text-[11px] text-destructive">{macCheck.error}</p>
                  )}
                  {duplicateMac && (
                    <p className="text-[11px] text-destructive">
                      این آدرس MAC قبلاً برای برد دیگری ثبت شده است.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="aux-node-chip"
                      className="text-xs font-medium text-text-secondary"
                    >
                      نوع میکروکنترلر
                    </Label>
                    <Select
                      id="aux-node-chip"
                      value={chipType}
                      onChange={(e) => handleChipChange(e.target.value as AuxChipType)}
                      className="rounded-lg font-sans text-xs"
                    >
                      {AUX_CHIP_OPTIONS.map((opt) => (
                        <option
                          key={opt.chipType}
                          value={opt.chipType}
                          className="bg-card-bg-solid"
                        >
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <Label
                        htmlFor="aux-node-capacity"
                        className="text-xs font-medium text-text-secondary"
                      >
                        تعداد پایه‌های قابل استفاده (۱ تا {MAX_AUX_PIN_CAPACITY})
                      </Label>
                    </div>
                    <Input
                      id="aux-node-capacity"
                      type="number"
                      min={minCapacity}
                      max={MAX_AUX_PIN_CAPACITY}
                      required
                      dir="ltr"
                      value={pinCapacity}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        setPinCapacity(Number.isNaN(next) ? minCapacity : next);
                      }}
                      className="rounded-lg text-left font-mono text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-border-color bg-secondary/45 px-3 py-2.5 text-[11px] text-text-secondary">
                  <span>GPIOهای پیشنهادی {chipMeta.shortLabel}</span>
                  <span className="font-mono text-[10px] text-text-muted" dir="ltr">
                    {chipMeta.suggestedPins.slice(0, 8).join(", ")}
                    {chipMeta.suggestedPins.length > 8 ? "…" : ""}
                  </span>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    <Info className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 border-t border-border-color pt-3">
                  <button
                    type="button"
                    onClick={closeAuxNodeModal}
                    className="min-h-10 cursor-pointer rounded-xl border border-border-color bg-card-bg px-4 text-xs font-medium text-text-secondary transition-colors hover:bg-card-hover-bg hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={isCapacityFull}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-accent3 px-4 text-xs font-semibold text-accent3-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Cpu className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    <span>{isEditMode ? "ذخیره و همگام‌سازی" : "ثبت برد و ساخت گروه"}</span>
                  </button>
                </div>
              </form>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
