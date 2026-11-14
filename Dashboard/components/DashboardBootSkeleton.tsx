const SIDEBAR_NAV_SLOTS = [0, 1, 2, 3, 4] as const;
const GROUP_CARD_SLOTS = [0, 1] as const;
const INNER_TILE_SLOTS = [0, 1] as const;

/**
 * Renders the initial application boot skeleton matching the exact RTL sidebar,
 * breadcrumb header, group-filter strip, concentric group/segment cards, and footer chrome.
 */
export default function DashboardBootSkeleton() {
  return (
    <section
      dir="rtl"
      className="flex h-screen w-full overflow-hidden bg-[#0b0c10] text-[#e5e7eb]"
      aria-busy="true"
      aria-label="در حال بارگذاری داشبورد"
    >
      {/* Right Vertical Sidebar Skeleton */}
      <aside className="flex h-full w-16 shrink-0 flex-col justify-between border-l border-zinc-800/80 bg-[#0d0e13] md:w-64">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-2 md:px-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-md bg-zinc-800/80 animate-pulse" />
            <div className="hidden h-4 w-28 rounded bg-zinc-800/70 animate-pulse md:block" />
          </div>
          <div className="hidden h-8 w-8 shrink-0 rounded-md bg-zinc-800/50 animate-pulse md:block" />
        </div>

        <div className="flex flex-1 flex-col gap-2 px-2 py-3 md:px-3">
          {SIDEBAR_NAV_SLOTS.map((slot) => (
            <div
              key={slot}
              className={`flex h-10 items-center gap-3 rounded-lg px-2.5 ${
                slot === 0 ? "bg-zinc-800/60" : "bg-transparent"
              }`}
            >
              <div className="h-5 w-5 shrink-0 rounded bg-zinc-800/80 animate-pulse" />
              <div className="hidden h-3.5 flex-1 rounded bg-zinc-800/60 animate-pulse md:block" />
            </div>
          ))}
        </div>

        <div className="hidden h-14 shrink-0 items-center justify-between border-t border-zinc-800/80 px-3 md:flex">
          <div className="h-4 w-16 rounded bg-zinc-800/70 animate-pulse" />
          <div className="h-3.5 w-20 rounded bg-zinc-800/50 animate-pulse" />
        </div>
      </aside>

      {/* Main Workspace Column Skeleton */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Breadcrumb + Centered Filter Strip */}
        <header className="relative flex h-14 w-full shrink-0 items-center justify-between border-b border-zinc-800/80 bg-[#0d0e13] px-3 sm:px-4 md:px-8">
          <div className="flex items-center gap-2">
            <div className="h-6 w-14 rounded-md bg-zinc-800/70 animate-pulse" />
            <span className="text-xs text-zinc-700">/</span>
            <div className="h-6 w-24 rounded-md bg-zinc-800/80 animate-pulse" />
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <div className="h-6 w-16 rounded-lg border border-zinc-800/80 bg-zinc-900/70 animate-pulse" />
            <div className="h-7 w-24 rounded-lg border border-zinc-700/80 bg-zinc-800/80 animate-pulse" />
            <div className="h-6 w-16 rounded-lg border border-zinc-800/80 bg-zinc-900/70 animate-pulse" />
          </div>

          <div className="h-6 w-6 rounded-md bg-transparent" />
        </header>

        {/* Concentric Group & Segment Card Skeleton Grid */}
        <main className="flex-1 overflow-hidden p-3 md:p-6 md:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {GROUP_CARD_SLOTS.map((groupSlot) => (
              <div
                key={groupSlot}
                className="flex flex-col rounded-3xl border border-zinc-800/80 bg-[#12141b] sm:rounded-[28px]"
              >
                <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-zinc-800/80 animate-pulse" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-24 rounded bg-zinc-800/90 animate-pulse" />
                      <div className="h-2.5 w-14 rounded bg-zinc-800/60 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-7 w-14 rounded-lg bg-zinc-800/70 animate-pulse" />
                    <div className="h-7 w-7 rounded-lg bg-zinc-800/60 animate-pulse" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4">
                  {INNER_TILE_SLOTS.map((tileSlot) => (
                    <div
                      key={tileSlot}
                      className="flex min-h-[108px] flex-col justify-between rounded-xl border border-zinc-800/75 bg-[#0e1015] p-3.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-zinc-800/80 animate-pulse" />
                        <div className="h-4 w-24 rounded bg-zinc-800/80 animate-pulse" />
                      </div>

                      <div className="flex items-center justify-between pt-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-zinc-700 animate-pulse" />
                          <div className="h-3 w-16 rounded bg-zinc-800/70 animate-pulse" />
                        </div>
                        <div className="h-6 w-11 rounded-md bg-zinc-800/80 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Bottom Footer Chrome Skeleton */}
        <footer className="flex h-14 w-full shrink-0 items-center justify-end border-t border-zinc-800/80 bg-[#0d0e13] px-4 md:px-8">
          <div className="h-9 w-9 rounded-lg border border-zinc-800/80 bg-zinc-900/70 animate-pulse" />
        </footer>
      </div>
    </section>
  );
}
