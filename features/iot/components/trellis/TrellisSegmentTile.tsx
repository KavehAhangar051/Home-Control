"use client";

import { ExternalLink } from "lucide-react";
import React from "react";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus } from "@/components/ui/hugeicons-groups/shell";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CardBody from "@/features/iot/components/sortable-segment-card/components/CardBody";
import SegmentActions from "@/features/iot/components/sortable-segment-card/components/SegmentActions";
import { useAutoOffTimer } from "@/features/iot/components/sortable-segment-card/hooks/useAutoOffTimer";
import { useCardHeaderLayout } from "@/features/iot/components/sortable-segment-card/hooks/useCardHeaderLayout";
import { useOptimisticPinState } from "@/features/iot/components/sortable-segment-card/hooks/useOptimisticPinState";
import { usePinCommandAck } from "@/features/iot/components/sortable-segment-card/hooks/usePinCommandAck";
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

export default React.memo(function TrellisSegmentTile({
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

  const { effectivePinOn, isPending, handleTogglePinOptimistic, handleSetPinStateOptimistic } =
    useOptimisticPinState({
      isPinOn,
      onTogglePin,
      onSetPinState,
    });

  const buttonProps = useSegmentButtonProps({
    mode,
    pin: segment.pin,
    isPinOn: effectivePinOn,
    onTogglePin: handleTogglePinOptimistic,
    onSetPinState: handleSetPinStateOptimistic,
  });

  const isAckFlashing = usePinCommandAck(segment.pin);

  const { countdown } = useAutoOffTimer({
    isPinOn: effectivePinOn,
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
            onPointerDown={(e) => {
              if (e.button !== 2) e.stopPropagation();
            }}
            onConfirm={() => onRemoveSegment(segment.id)}
            label="حذف جایگاه خالی"
          />
        </div>

        <Card className="group/ph-card size-full !gap-0 !overflow-hidden !rounded-xl !border-dashed !border-border-color !bg-card-bg !p-0 !ring-0 !shadow-none transition-colors duration-200 md:hover:!border-accent3">
          <button
            type="button"
            onClick={() => onSetupPlaceholder?.(segment.id)}
            className="relative flex min-h-[96px] size-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-0 bg-transparent p-3 text-center"
          >
            <div className="relative z-10 flex size-8 items-center justify-center rounded-xl border border-border-color bg-accent3-transparent text-accent3 transition-colors md:group-hover/ph-card:bg-accent3 md:group-hover/ph-card:text-accent3-foreground">
              <Plus className="size-4" strokeWidth={2.5} />
            </div>
            <span className="block font-sans text-xs font-bold text-text-primary">
              تخصیص قطعه هوشمند
            </span>
          </button>
        </Card>
      </div>
    );
  }

  const activeSurfaceClass = effectivePinOn
    ? "border-accent3 bg-card-bg shadow-xs"
    : "border-border-color bg-card-bg shadow-2xs";

  const autoOffMenuProps = {
    showAutoOffMenu,
    setShowAutoOffMenu,
    autoOffButtonRef,
    autoOffMenuRef,
  };

  return (
    <div className={`relative h-full ${isSettingsOpen ? "z-40" : ""}`}>
      <Card
        className={`@container/segment group relative flex h-full flex-col justify-between !gap-0 !overflow-visible !rounded-xl !p-0 !ring-0 border transition-[border-color,background-color] duration-200 ${activeSurfaceClass}`}
        style={CARD_SPACING_STYLE}
      >
        <div
          className="absolute top-2 left-2 z-20 flex items-center gap-1"
          onPointerDown={(e) => {
            if (e.button !== 2) e.stopPropagation();
          }}
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
                    className="flex size-6 cursor-pointer items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors md:hover:border-border-color md:hover:bg-secondary md:hover:text-text-primary"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </button>
                }
              />
              <TooltipContent>باز کردن در پنجره مستقل</TooltipContent>
            </Tooltip>
          )}

          <SegmentActions
            segment={segment}
            isPinOn={effectivePinOn}
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
          isPinOn={effectivePinOn}
          isPending={isPending}
          isAckFlashing={isAckFlashing}
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
});
