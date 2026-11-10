"use client";

import { Suspense } from "react";
import { DashboardProvider } from "@/features/dashboard";
import dynamic from "next/dynamic";

// Dynamically import DashboardContainer to reduce initial bundle size and speed up initial render.
const DashboardContainer = dynamic(
  () => import("@/features/dashboard").then((mod) => mod.DashboardContainer),
  { ssr: false },
);

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0c10]" />}>
      <DashboardProvider>
        <DashboardContainer />
      </DashboardProvider>
    </Suspense>
  );
}
