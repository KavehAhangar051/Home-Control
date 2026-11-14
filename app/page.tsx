"use client";

import dynamic from "next/dynamic";
import DashboardBootSkeleton from "@/components/DashboardBootSkeleton";

const DashboardShell = dynamic(
  () => import("@/features/dashboard/components/layout/DashboardShell"),
  {
    ssr: false,
    loading: () => <DashboardBootSkeleton />,
  },
);

export default function Home() {
  return <DashboardShell />;
}
