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
    <div className="flex min-h-[108px] flex-col justify-between rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-solid)] p-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--text-muted)]/15 animate-pulse" />
          <div className="h-4 w-24 rounded bg-[var(--text-muted)]/20 animate-pulse" />
        </div>
        <div className="h-5 w-5 rounded-md bg-[var(--text-muted)]/15 animate-pulse" />
      </div>

      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[var(--text-muted)]/30 animate-pulse" />
          <div className="h-3 w-16 rounded bg-[var(--text-muted)]/15 animate-pulse" />
        </div>
        <div className="h-6 w-11 rounded-md bg-[var(--text-muted)]/20 animate-pulse" />
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
      className="relative flex h-full min-h-[480px] w-full flex-1 flex-col justify-between overflow-hidden bg-[var(--bg-main)] p-6 md:p-10"
    >
      <div className="grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {[0, 1].map((nodeIdx) => (
          <div
            key={nodeIdx}
            className="flex flex-col rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg-solid)] shadow-sm"
          >
            <div className="flex items-center justify-between rounded-t-3xl border-b border-[var(--border-color)] bg-[var(--card-hover-bg)]/65 px-4 py-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-[var(--text-muted)]/20 animate-pulse" />
                <div className="h-7 w-7 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
                <div className="space-y-1">
                  <div className="h-3.5 w-20 rounded bg-[var(--text-muted)]/20 animate-pulse" />
                  <div className="h-2.5 w-14 rounded bg-[var(--text-muted)]/15 animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-7 w-14 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
                <div className="h-7 w-7 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
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
      <div className="mx-auto flex items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)]/90 px-3 py-1.5 shadow-lg">
        <div className="h-7 w-28 rounded-xl bg-[var(--text-muted)]/15 animate-pulse" />
        <div className="h-7 w-16 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
        <div className="h-7 w-20 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
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
      className="grid h-full min-h-[460px] w-full flex-1 grid-cols-1 gap-3 md:grid-cols-2"
    >
      {[0, 1].map((paneIdx) => (
        <div
          key={paneIdx}
          className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)]"
        >
          <div className="flex h-10 items-center justify-between border-b border-[var(--border-color)] bg-[var(--card-hover-bg)]/60 px-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-[var(--text-muted)]/20 animate-pulse" />
              <div className="h-3.5 w-24 rounded bg-[var(--text-muted)]/20 animate-pulse" />
            </div>
            <div className="h-6 w-14 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
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
          <Card className="relative w-full !gap-0 !rounded-3xl sm:!rounded-[28px] !border-[var(--border-color)] !bg-[var(--card-bg)] !p-0 !shadow-xs">
            <div className="flex w-full items-center justify-between rounded-t-3xl border-b border-[var(--border-color)] bg-[var(--card-hover-bg)] px-4 py-3 sm:rounded-t-[28px]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[var(--text-muted)]/20 animate-pulse" />
                <div className="h-4 w-24 rounded bg-[var(--text-muted)]/20 animate-pulse" />
                <div className="h-5 w-12 rounded-md bg-[var(--text-muted)]/15 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-7 w-14 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
                <div className="h-7 w-7 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
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
