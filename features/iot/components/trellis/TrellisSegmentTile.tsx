"use client";

import { ExternalLink } from "lucide-react";
import type React from "react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CardBody from "@/features/iot/components/sortable-segment-card/components/CardBody";
import SegmentActions from "@/features/iot/components/sortable-segment-card/components/SegmentActions";
import { useAutoOffTimer } from "@/features/iot/components/sortable-segment-card/hooks/useAutoOffTimer";
import { useCardHeaderLayout } from "@/features/iot/components/sortable-segment-card/hooks/useCardHeaderLayout";
import useSegmentButtonProps from "@/features/iot/components/sortable-segment-card/hooks/useSegmentButtonProps";
import type { Segment } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

export interface TrellisSegmentHandlers {
  onRemoveSegment: (id: string) => void;
  onTogglePin: (pin: string) => void;
  onSetPinState: (pin: string, state: boolean, preventMqtt?: boolean) => void;
  onUpdateSegmentMode?: (id: string, mode: "switch" | "push") => void;
  onUpdateSegmentAutoOff?: (id: string, autoOff: number) => void;
  onSetupPlaceholder?: (id: string) => void;
}

interface TrellisSegmentTileProps extends TrellisSegmentHandlers {
  segment: Segment;
  compact: boolean;
  animationsEnabled: boolean;
  onPopOutSegment?: (segment: Segment) => void;
}

// SAFETY: React CSSProperties supports CSS custom properties
const CARD_SPACING_STYLE: React.CSSProperties = { "--card-spacing": "0px" } as React.CSSProperties;

export default function TrellisSegmentTile({
  segment,
  compact,
  animationsEnabled,
  onRemoveSegment,
  onTogglePin,
  onSetPinState,
  onUpdateSegmentMode,
  onUpdateSegmentAutoOff,
  onSetupPlaceholder,
  onPopOutSegment,
}: TrellisSegmentTileProps) {
  const isPinOn = useIoTStore((s) => Boolean(s.pinsState[segment.pin]));

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
  } = useCardHeaderLayout(segment.id);

  const mode = segment.mode || "switch";

  const buttonProps = useSegmentButtonProps({
    mode,
    pin: segment.pin,
    onTogglePin,
    onSetPinState,
  });

  const { countdown } = useAutoOffTimer({
    isPinOn,
    autoOff: segment.auto_off,
    mode,
    pin: segment.pin,
    onSetPinState,
  });

  if (segment.type === "placeholder") {
    return (
      <div className="relative h-full">
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
          <DeleteButton
            size="xs"
            resetAfter={0}
            onPointerDown={(e) => e.stopPropagation()}
            onConfirm={() => onRemoveSegment(segment.id)}
            label="حذف جایگاه خالی"
          />
        </div>

        <Card className="group/ph-card h-full w-full !gap-0 !overflow-hidden !rounded-xl !border-dashed !border-[var(--border-color)] !bg-[var(--card-bg)] !p-0 !ring-0 !shadow-none transition-colors duration-200 md:hover:!border-[var(--accent3)]">
          <button
            type="button"
            onClick={() => onSetupPlaceholder?.(segment.id)}
            className="relative flex min-h-[96px] w-full h-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-0 bg-transparent p-3 text-center"
          >
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--accent3-transparent)] text-[var(--accent3)] transition-colors md:group-hover/ph-card:bg-[var(--accent3)] md:group-hover/ph-card:text-[var(--accent3-foreground)]">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="block font-sans text-xs font-bold theme-text-primary">
              تخصیص قطعه هوشمند
            </span>
          </button>
        </Card>
      </div>
    );
  }

  const isInput = segment.type === "input";

  const activeSurfaceClass = isPinOn
    ? isInput
      ? "border-emerald-500 bg-[var(--card-bg)] shadow-xs"
      : "border-[var(--accent3)] bg-[var(--card-bg)] shadow-xs"
    : "border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xs";

  const autoOffMenuProps = {
    showAutoOffMenu,
    setShowAutoOffMenu,
    autoOffButtonRef,
    autoOffMenuRef,
  };

  return (
    <div className={`relative h-full ${isSettingsOpen ? "z-40" : ""}`}>
      <Card
        className={`group relative flex h-full flex-col justify-between !gap-0 !overflow-visible !p-0 !ring-0 border transition-[border-color,background-color,box-shadow] duration-200 ${activeSurfaceClass}`}
        style={CARD_SPACING_STYLE}
      >
        <div
          className="absolute top-2 left-2 z-20 flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onPopOutSegment && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPopOutSegment(segment);
                    }}
                    aria-label={`باز کردن ${segment.title} در پنجره مستقل`}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors md:hover:border-[var(--border-color)] md:hover:bg-[var(--secondary)] md:hover:text-[var(--text-primary)]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                }
              />
              <TooltipContent>باز کردن در پنجره مستقل</TooltipContent>
            </Tooltip>
          )}

          <SegmentActions
            segment={segment}
            isPinOn={isPinOn}
            isUltraCompact={compact}
            isCompact={compact}
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
          isCompact={compact}
          isUltraCompact={false}
          mode={mode}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
          countdown={countdown}
        />
      </Card>
    </div>
  );
}
