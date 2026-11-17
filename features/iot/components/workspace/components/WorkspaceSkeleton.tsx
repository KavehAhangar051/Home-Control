import { Card } from "@/components/ui/card";
import { getCanvasGridStyle } from "@/features/iot/components/canvas/canvasGeometry";
import type { WorkspaceDisplayMode } from "@/features/iot/hooks/store/types";

interface WorkspaceSkeletonProps {
  groupsCols?: number;
  mode?: WorkspaceDisplayMode;
}

const SEGMENT_TILE_SLOTS = [1, 2] as const;
const GRID_GROUP_SLOTS = [1, 2, 3] as const;

function SegmentCardSkeleton() {
  return (
    <div className="flex min-h-[108px] flex-col justify-between rounded-xl border border-border-color bg-card-bg-solid p-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="size-9 shrink-0 rounded-xl bg-text-muted/15 animate-pulse" />
          <div className="h-4 w-24 rounded bg-text-muted/20 animate-pulse" />
        </div>
        <div className="size-5 rounded-md bg-text-muted/15 animate-pulse" />
      </div>

      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-1.5">
          <div className="size-2 rounded-full bg-text-muted/30 animate-pulse" />
          <div className="h-3 w-16 rounded bg-text-muted/15 animate-pulse" />
        </div>
        <div className="h-6 w-11 rounded-md bg-text-muted/20 animate-pulse" />
      </div>
    </div>
  );
}

function CanvasModeSkeleton() {
  const gridStyle = getCanvasGridStyle(0, 0, 1);

  return (
    <section
      dir="rtl"
      style={gridStyle}
      aria-busy="true"
      aria-label="در حال بارگذاری بوم آزاد"
      className="relative flex size-full min-h-[480px] flex-1 flex-col justify-between overflow-hidden bg-bg-main p-6 md:p-10"
    >
      <div className="grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {[0, 1].map((nodeIdx) => (
          <div
            key={nodeIdx}
            className="flex flex-col rounded-2xl border border-border-color bg-card-bg-solid"
          >
            <div className="flex items-center justify-between rounded-t-2xl border-b border-border-color bg-card-hover-bg/65 px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="size-4 rounded bg-text-muted/20 animate-pulse" />
                <div className="size-7 rounded-lg bg-text-muted/15 animate-pulse" />
                <div className="space-y-1">
                  <div className="h-3.5 w-20 rounded bg-text-muted/20 animate-pulse" />
                  <div className="h-2.5 w-14 rounded bg-text-muted/15 animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-7 w-14 rounded-lg bg-text-muted/15 animate-pulse" />
                <div className="size-7 rounded-lg bg-text-muted/15 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {SEGMENT_TILE_SLOTS.map((slot) => (
                <SegmentCardSkeleton key={slot} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Floating Canvas Chrome Bar Skeleton */}
      <div className="mx-auto flex items-center gap-2 rounded-xl border border-border-color bg-card-bg-solid/90 px-3 py-1.5">
        <div className="h-7 w-28 rounded-lg bg-text-muted/15 animate-pulse" />
        <div className="h-7 w-16 rounded-lg bg-text-muted/15 animate-pulse" />
        <div className="h-7 w-20 rounded-lg bg-text-muted/15 animate-pulse" />
      </div>
    </section>
  );
}

function TrellisModeSkeleton() {
  return (
    <section
      dir="rtl"
      aria-busy="true"
      aria-label="در حال بارگذاری چیدمان شبکه‌ای"
      className="grid size-full min-h-[460px] flex-1 grid-cols-1 gap-3 md:grid-cols-2"
    >
      {[0, 1].map((paneIdx) => (
        <div
          key={paneIdx}
          className="flex flex-col overflow-hidden rounded-2xl border border-border-color bg-card-bg-solid"
        >
          <div className="flex h-10 items-center justify-between border-b border-border-color bg-card-hover-bg/60 px-3">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-lg bg-text-muted/20 animate-pulse" />
              <div className="h-3.5 w-24 rounded bg-text-muted/20 animate-pulse" />
            </div>
            <div className="h-6 w-14 rounded-lg bg-text-muted/15 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {SEGMENT_TILE_SLOTS.map((slot) => (
              <SegmentCardSkeleton key={slot} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Renders an element-matched workspace skeleton aligned to the active layout mode
 * (columnar grid, trellis split-pane, or infinite dot-grid canvas).
 */
export default function WorkspaceSkeleton({
  groupsCols = 2,
  mode = "grid",
}: WorkspaceSkeletonProps) {
  if (mode === "canvas") {
    return <CanvasModeSkeleton />;
  }

  if (mode === "trellis") {
    return <TrellisModeSkeleton />;
  }

  const flexBasis =
    groupsCols === 1
      ? "100%"
      : groupsCols === 2
        ? "calc(50% - 1rem - 0.1px)"
        : "calc(33.3333% - 1.3333rem - 0.1px)";

  return (
    <div dir="rtl" className="flex w-full flex-wrap items-start gap-8">
      {GRID_GROUP_SLOTS.map((groupId) => (
        <div
          key={groupId}
          className="min-w-0 max-w-full flex-shrink-0 flex-grow space-y-3 max-[767px]:basis-full"
          style={{ flexBasis }}
        >
          <Card className="relative w-full !gap-0 !rounded-2xl !border-border-color !bg-card-bg !p-0 !shadow-none">
            <div className="flex w-full items-center justify-between rounded-t-2xl border-b border-border-color bg-card-hover-bg px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-text-muted/20 animate-pulse" />
                <div className="h-4 w-24 rounded bg-text-muted/20 animate-pulse" />
                <div className="h-4 w-10 rounded bg-text-muted/15 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-7 w-14 rounded-lg bg-text-muted/15 animate-pulse" />
                <div className="size-7 rounded-lg bg-text-muted/15 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4">
              {SEGMENT_TILE_SLOTS.map((segId) => (
                <SegmentCardSkeleton key={segId} />
              ))}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
