"use client";

import { useView, useViewBadge, useViewTitle } from "@danfessler/trellis-react";
import React from "react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons";
import CardBody from "@/features/iot/components/sortable-segment-card/components/CardBody";
import SegmentActions from "@/features/iot/components/sortable-segment-card/components/SegmentActions";
import { useAutoOffTimer } from "@/features/iot/components/sortable-segment-card/hooks/useAutoOffTimer";
import { useCardHeaderLayout } from "@/features/iot/components/sortable-segment-card/hooks/useCardHeaderLayout";
import useSegmentButtonProps from "@/features/iot/components/sortable-segment-card/hooks/useSegmentButtonProps";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { TrellisSegmentHandlers } from "./TrellisSegmentTile";

export interface TrellisSegmentViewParams {
  segmentId: string;
}

interface TrellisSegmentViewProps extends TrellisSegmentHandlers {
  animationsEnabled: boolean;
}

// SAFETY: React CSSProperties supports CSS custom properties
const CARD_SPACING_STYLE: React.CSSProperties = { "--card-spacing": "0px" } as React.CSSProperties;

function getTrellisViewTitle(
  segment?: ReturnType<typeof useIoTStore.getState>["segments"][number],
) {
  if (!segment) return "قطعه حذف‌شده";

  return segment.type === "placeholder"
    ? `جایگاه خالی (${segment.group || "Test"})`
    : segment.title;
}

function getTrellisSurfaceClass(isPinOn: boolean, isInput: boolean): string {
  if (!isPinOn) return "border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xs";

  return isInput
    ? "border-emerald-500 bg-[var(--card-bg)] shadow-xs"
    : "border-[var(--accent3)] bg-[var(--card-bg)] shadow-xs";
}

function TrellisPlaceholderView({
  segmentId,
  isUltraCompact,
  onRemoveSegment,
  onSetupPlaceholder,
}: {
  segmentId: string;
  isUltraCompact: boolean;
  onRemoveSegment: (id: string) => void;
  onSetupPlaceholder?: (id: string) => void;
}) {
  return (
    <div dir="rtl" className="relative h-full w-full p-2">
      <div className="absolute top-3.5 left-3.5 z-20">
        <DeleteButton
          size="xs"
          resetAfter={0}
          onPointerDown={(e) => e.stopPropagation()}
          onConfirm={() => onRemoveSegment(segmentId)}
          label="حذف جایگاه خالی"
        />
      </div>

      <Card className="group/ph-card h-full w-full !gap-0 !overflow-hidden !rounded-xl !border-dashed !border-[var(--border-color)] !bg-[var(--card-bg)] !p-0 !ring-0 !shadow-none transition-colors duration-200 md:hover:!border-[var(--accent3)]">
        <button
          type="button"
          onClick={() => onSetupPlaceholder?.(segmentId)}
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-0 bg-transparent p-3 text-center"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--accent3-transparent)] text-[var(--accent3)]">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </div>
          {!isUltraCompact && (
            <span className="font-sans text-xs font-bold theme-text-primary">
              تخصیص قطعه هوشمند
            </span>
          )}
        </button>
      </Card>
    </div>
  );
}

export default function TrellisSegmentView({
  animationsEnabled,
  onRemoveSegment,
  onTogglePin,
  onSetPinState,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  onSetupPlaceholder,
}: TrellisSegmentViewProps) {
  const view = useView<TrellisSegmentViewParams>();
  const segmentId = view.params.segmentId;

  const segment = useIoTStore(
    React.useCallback((s) => s.segments.find((item) => item.id === segmentId), [segmentId]),
  );

  const isPinOn = useIoTStore((s) => (segment ? Boolean(s.pinsState[segment.pin]) : false));

  useViewTitle(getTrellisViewTitle(segment));
  useViewBadge(segment && isPinOn ? true : null);

  const {
    isSettingsOpen,
    setIsSettingsOpen,
    showAutoOffMenu,
    setShowAutoOffMenu,
    menuPosition,
    buttonRef,
    menuRef,
    autoOffButtonRef,
    autoOffMenuRef,
  } = useCardHeaderLayout(segmentId);

  const mode = segment?.mode || "switch";
  const pin = segment?.pin || "";

  const buttonProps = useSegmentButtonProps({
    mode,
    pin,
    onTogglePin,
    onSetPinState,
  });

  const { countdown } = useAutoOffTimer({
    isPinOn,
    autoOff: segment?.auto_off,
    mode,
    pin,
    onSetPinState,
  });

  if (!segment) {
    return (
      <div
        dir="rtl"
        className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-[var(--text-muted)]"
      >
        این قطعه از داشبورد حذف شده است.
      </div>
    );
  }

  const isUltraCompact = view.size.width < 170 || view.size.height < 110;
  const isCompact = view.size.width < 235 || view.size.height < 140;

  if (segment.type === "placeholder") {
    return (
      <TrellisPlaceholderView
        segmentId={segment.id}
        isUltraCompact={isUltraCompact}
        onRemoveSegment={onRemoveSegment}
        onSetupPlaceholder={onSetupPlaceholder}
      />
    );
  }

  const activeSurfaceClass = getTrellisSurfaceClass(isPinOn, segment.type === "input");

  const autoOffMenuProps = {
    showAutoOffMenu,
    setShowAutoOffMenu,
    autoOffButtonRef,
    autoOffMenuRef,
  };

  return (
    <div dir="rtl" className="relative flex h-full w-full flex-col p-2">
      <Card
        className={`relative flex h-full w-full flex-col justify-between !gap-0 !overflow-visible !p-0 !ring-0 border transition-[border-color,background-color,box-shadow] duration-200 ${activeSurfaceClass}`}
        style={CARD_SPACING_STYLE}
      >
        <div
          className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <SegmentActions
            segment={segment}
            isPinOn={isPinOn}
            isUltraCompact={isUltraCompact}
            isCompact={isCompact}
            onRemove={onRemoveSegment}
            onUpdateSegmentMode={onUpdateSegmentMode}
            onUpdateSegmentAutoOff={onUpdateSegmentAutoOff}
            mode={mode}
            countdown={countdown}
            isSettingsOpen={isSettingsOpen}
            setIsSettingsOpen={setIsSettingsOpen}
            menuPosition={menuPosition}
            buttonRef={buttonRef}
            menuRef={menuRef}
            autoOffMenuProps={autoOffMenuProps}
          />
        </div>

        <CardBody
          segment={segment}
          isPinOn={isPinOn}
          isCompact={isCompact}
          isUltraCompact={isUltraCompact}
          mode={mode}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
          countdown={countdown}
        />
      </Card>
    </div>
  );
}
