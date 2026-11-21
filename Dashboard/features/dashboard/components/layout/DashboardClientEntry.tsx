"use client";

import { Suspense } from "react";
import DashboardBootSkeleton from "@/components/DashboardBootSkeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import DashboardShell from "@/features/dashboard/components/layout/DashboardShell";

export default function DashboardClientEntry() {
  return (
    <ErrorBoundary
      fallbackTitle="خطا در بارگذاری پوسته داشبورد"
      fallbackDescription="بخشی از فایل‌های برنامه بارگذاری نشد. روی دکمه تلاش مجدد کلیک کنید تا صفحه دوباره بارگذاری شود."
      onReset={() => window.location.reload()}
    >
      <Suspense fallback={<DashboardBootSkeleton />}>
        <DashboardShell />
      </Suspense>
    </ErrorBoundary>
  );
}
