import { getCanvasGridStyle } from "@/features/iot/components/canvas/canvasGeometry";

const FORM_ROW_SLOTS = [0, 1, 2] as const;
const LIST_ITEM_SLOTS = [0, 1, 2, 3] as const;
const WORKFLOW_NODE_SLOTS = [0, 1] as const;

/**
 * Matches settings and creation form panels (header, labeled input rows, action footer).
 */
export function FormPanelSkeleton() {
  return (
    <div
      dir="rtl"
      aria-busy="true"
      className="space-y-5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-4 sm:p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FORM_ROW_SLOTS.map((slot) => (
          <div key={slot} className="space-y-2">
            <div className="h-3.5 w-24 rounded bg-[var(--text-muted)]/20 animate-pulse" />
            <div className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]/70 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--border-color)] pt-4">
        <div className="h-9 w-28 rounded-lg bg-[var(--text-muted)]/20 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Matches segment and automation management lists (toolbar + stacked item cards).
 */
export function ListPanelSkeleton() {
  return (
    <div dir="rtl" aria-busy="true" className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-1">
        <div className="h-9 w-48 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]/70 animate-pulse" />
        <div className="h-7 w-20 rounded-md bg-[var(--text-muted)]/15 animate-pulse" />
      </div>

      {LIST_ITEM_SLOTS.map((slot) => (
        <div
          key={slot}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg-solid)] p-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-[var(--text-muted)]/20 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 rounded bg-[var(--text-muted)]/20 animate-pulse" />
              <div className="h-3 w-40 rounded bg-[var(--text-muted)]/15 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-11 rounded-md bg-[var(--text-muted)]/20 animate-pulse" />
            <div className="h-7 w-7 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Matches the outer WorkspaceSection header and body when lazily loading a sub-section.
 */
export function WorkspaceSectionSkeleton() {
  return (
    <section
      dir="rtl"
      aria-busy="true"
      className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 text-right sm:px-6 sm:py-10 lg:py-12"
    >
      <header className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-40 rounded bg-[var(--text-muted)]/20 animate-pulse" />
            <div className="h-4 w-64 rounded bg-[var(--text-muted)]/15 animate-pulse" />
          </div>
        </div>
        <div className="h-4 w-24 rounded bg-[var(--text-muted)]/15 animate-pulse" />
      </header>

      <FormPanelSkeleton />
    </section>
  );
}

/**
 * Matches the n8n WorkflowStudio header toolbar, left palette rail, dot-grid plane, and sample node cards.
 */
export function WorkflowStudioSkeleton() {
  const gridStyle = getCanvasGridStyle(0, 0, 1);

  return (
    <section
      dir="rtl"
      aria-busy="true"
      aria-label="در حال بارگذاری استودیوی گردش کار"
      className="relative flex h-full min-h-[480px] w-full flex-1 flex-col overflow-hidden bg-[var(--bg-main)]"
    >
      {/* Top Workflow Header Bar Skeleton */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-color)] bg-[var(--card-bg-solid)] px-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded-lg bg-[var(--text-muted)]/20 animate-pulse" />
          <div className="h-8 w-32 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-[var(--text-muted)]/20 animate-pulse" />
        </div>
      </div>

      {/* Dot-grid Studio Surface + Node Silhouettes */}
      <div
        style={gridStyle}
        className="relative flex flex-1 flex-col justify-between overflow-hidden p-6 md:p-10"
      >
        <div className="flex flex-wrap items-start gap-10">
          {WORKFLOW_NODE_SLOTS.map((slot) => (
            <div
              key={slot}
              className="relative w-60 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)] shadow-sm"
            >
              <div className="flex h-8 items-center justify-between rounded-t-2xl border-b border-[var(--border-color)]/70 bg-[var(--secondary)]/70 px-3">
                <div className="h-3.5 w-24 rounded bg-[var(--text-muted)]/20 animate-pulse" />
                <div className="h-3.5 w-10 rounded bg-[var(--text-muted)]/15 animate-pulse" />
              </div>
              <div className="space-y-2.5 p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[var(--text-muted)]/20 animate-pulse" />
                  <div className="space-y-1">
                    <div className="h-3.5 w-24 rounded bg-[var(--text-muted)]/20 animate-pulse" />
                    <div className="h-2.5 w-16 rounded bg-[var(--text-muted)]/15 animate-pulse" />
                  </div>
                </div>
                <div className="h-7 w-full rounded-lg bg-[var(--text-muted)]/15 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto h-9 w-48 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg-solid)]/90 animate-pulse" />
      </div>
    </section>
  );
}
