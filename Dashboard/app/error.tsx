"use client";

import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError] Route boundary caught error:", error);
  }, [error]);

  return (
    <main
      dir="rtl"
      role="alert"
      className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 text-center text-foreground font-sans"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-lg font-bold text-foreground">خطایی در داشبورد رخ داد</h1>
        <p className="text-xs leading-6 text-muted-foreground">
          مشکلی در اجرای صفحه پیش آمد. برای بازیابی وضعیت، دوباره تلاش کنید.
        </p>
        {error.message && (
          <p className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground break-words">
            {error.message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button type="button" variant="default" size="sm" onClick={reset} className="rounded-xl">
            تلاش مجدد
          </Button>
          <a
            href="/"
            className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-xl" })}
          >
            بارگذاری مجدد صفحه
          </a>
        </div>
      </div>
    </main>
  );
}
