"use client";

import dynamic from "next/dynamic";
import DashboardBootSkeleton from "@/components/DashboardBootSkeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { retryDynamicImport } from "@/lib/dynamicRetry";

const DashboardShell = dynamic(
  () => retryDynamicImport(() => import("@/features/dashboard/components/layout/DashboardShell")),
  {
    ssr: false,
    loading: () => <DashboardBootSkeleton />,
  },
);

export default function DashboardClientEntry() {
  return (
    <ErrorBoundary
      fallbackTitle="خطا در بارگذاری پوسته داشبورد"
      fallbackDescription="بخشی از فایل‌های برنامه بارگذاری نشد. روی دکمه تلاش مجدد کلیک کنید تا صفحه دوباره بارگذاری شود."
      onReset={() => window.location.reload()}
    >
      <DashboardShell />
    </ErrorBoundary>
  );
}
