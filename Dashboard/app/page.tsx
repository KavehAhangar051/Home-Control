"use client";

import dynamic from "next/dynamic";

const DashboardShellSkeleton = () => (
  <section
    dir="rtl"
    className="flex h-screen w-full overflow-hidden bg-[#0b0c10] text-[#e5e7eb]"
    aria-busy="true"
    aria-label="در حال بارگذاری داشبورد"
  >
    <div className="hidden h-full w-16 shrink-0 border-l border-zinc-800/80 bg-zinc-950/80 md:block md:w-64" />
    <div className="flex flex-1 flex-col min-w-0">
      <div className="h-14 w-full shrink-0 border-b border-zinc-800/80 bg-zinc-950/80" />
      <div className="flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-44 rounded-2xl border border-zinc-800/70 bg-zinc-900/50 animate-pulse" />
          <div className="h-44 rounded-2xl border border-zinc-800/70 bg-zinc-900/50 animate-pulse" />
          <div className="hidden h-44 rounded-2xl border border-zinc-800/70 bg-zinc-900/50 animate-pulse lg:block" />
        </div>
      </div>
    </div>
  </section>
);

const DashboardShell = dynamic(
  () => import("@/features/dashboard/components/layout/DashboardShell"),
  {
    ssr: false,
    loading: DashboardShellSkeleton,
  },
);

export default function Home() {
  return <DashboardShell />;
}
