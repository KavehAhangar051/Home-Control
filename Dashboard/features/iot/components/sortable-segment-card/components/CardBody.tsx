import React from "react";
import { SegmentData } from "../core/types";
import PinToggle from "./PinToggle";

interface CardBodyProps {
  segment: SegmentData;
  isPinOn: boolean;
  isCompact: boolean;
  isUltraCompact: boolean;
  isMobileTwoCol?: boolean;
  densityFactor?: number;
  mode: "switch" | "push";
  buttonProps: any;
  animationsEnabled?: boolean;
}

export function InputSegmentBody({ segment, isPinOn }: { segment: SegmentData; isPinOn: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 w-full">
      <span
        className={`text-xs font-sans font-semibold tabular-nums ${
          isPinOn ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"
        }`}
      >
        {isPinOn ? "ورودی فعال (۱)" : "ورودی غیرفعال (۰)"}
      </span>
      <div className="flex items-center gap-3 text-right">
        <div>
          <span className="block text-xs font-sans font-bold theme-text-primary tabular-nums">
            وضعیت پایه {segment.pin}
          </span>
          <span className="block text-[11px] theme-text-muted mt-0.5">حسگر ورودی دیجیتال</span>
        </div>
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center ${isPinOn ? "bg-[var(--success)]/15" : "bg-[var(--muted)]"}`}
        >
          <div
            className={`w-3.5 h-3.5 rounded-full ${isPinOn ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"}`}
          />
        </div>
      </div>
    </div>
  );
}

export function UltraCompactSegmentBody({
  isPinOn,
  buttonProps,
  animationsEnabled,
}: {
  isPinOn: boolean;
  buttonProps: any;
  animationsEnabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center w-full">
      <PinToggle
        isPinOn={isPinOn}
        buttonProps={buttonProps}
        animationsEnabled={animationsEnabled}
        isUltraCompact={true}
      />
    </div>
  );
}

export function MobileTwoColSegmentBody({
  segment,
  isPinOn,
  buttonProps,
  animationsEnabled,
}: {
  segment: SegmentData;
  isPinOn: boolean;
  buttonProps: any;
  animationsEnabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center w-full overflow-hidden h-full gap-2 py-1">
      <span
        className="text-[11px] font-sans font-bold theme-text-secondary line-clamp-2 leading-tight text-center w-full"
        title={segment.title}
      >
        {segment.title}
      </span>
      <PinToggle
        isPinOn={isPinOn}
        buttonProps={buttonProps}
        animationsEnabled={animationsEnabled}
        isVertical={false}
      />
    </div>
  );
}

export function CompactSegmentBody({
  segment,
  isPinOn,
  buttonProps,
  animationsEnabled,
  densityFactor,
}: {
  segment: SegmentData;
  isPinOn: boolean;
  buttonProps: any;
  animationsEnabled: boolean;
  densityFactor: number;
}) {
  return (
    <div className="flex items-center justify-between w-full overflow-hidden h-full py-1">
      <span
        className="text-[11px] font-sans font-bold theme-text-secondary line-clamp-2 leading-tight pl-2 flex-1 text-right"
        title={segment.title}
      >
        {segment.title}
      </span>
      <PinToggle
        isPinOn={isPinOn}
        buttonProps={buttonProps}
        animationsEnabled={animationsEnabled}
        isVertical={densityFactor >= 4}
      />
    </div>
  );
}

export function StandardSegmentBody({
  segment,
  isPinOn,
  buttonProps,
  animationsEnabled,
}: {
  segment: SegmentData;
  isPinOn: boolean;
  buttonProps: any;
  animationsEnabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 w-full">
      <span className="block font-sans font-bold theme-text-primary text-sm truncate pl-3">
        {segment.title}
      </span>
      <PinToggle
        isPinOn={isPinOn}
        buttonProps={buttonProps}
        animationsEnabled={animationsEnabled}
      />
    </div>
  );
}

export default function CardBody({
  segment,
  isPinOn,
  isCompact,
  isUltraCompact,
  isMobileTwoCol,
  densityFactor = 0,
  buttonProps,
  animationsEnabled = true,
}: CardBodyProps) {
  const containerClass = isUltraCompact
    ? "p-2 flex-grow flex items-center justify-center"
    : isCompact
      ? "p-3 flex-1 flex items-center"
      : "p-4 flex-1";

  return (
    <div className={containerClass}>
      {segment.type === "input" ? (
        <InputSegmentBody segment={segment} isPinOn={isPinOn} />
      ) : isUltraCompact ? (
        <UltraCompactSegmentBody
          isPinOn={isPinOn}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
        />
      ) : isMobileTwoCol ? (
        <MobileTwoColSegmentBody
          segment={segment}
          isPinOn={isPinOn}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
        />
      ) : isCompact ? (
        <CompactSegmentBody
          segment={segment}
          isPinOn={isPinOn}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
          densityFactor={densityFactor}
        />
      ) : (
        <StandardSegmentBody
          segment={segment}
          isPinOn={isPinOn}
          buttonProps={buttonProps}
          animationsEnabled={animationsEnabled}
        />
      )}
    </div>
  );
}
