"use client";

import { useEffect } from "react";
import "./globals.css";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError] Root layout boundary caught error:", error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl" className="dark">
      <body className="flex min-h-screen w-full items-center justify-center bg-background px-4 text-foreground font-sans">
        <main
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-lg"
        >
          <h1 className="text-lg font-bold text-foreground">خطای بحرانی در بارگذاری برنامه</h1>
          <p className="text-xs leading-6 text-muted-foreground">
            اجرای لایه اصلی داشبورد با خطا متوقف شد. می‌توانید صفحه را مجدداً راه‌اندازی کنید.
          </p>
          <Button type="button" variant="default" size="sm" onClick={reset} className="rounded-xl">
            راه‌اندازی مجدد
          </Button>
        </main>
      </body>
    </html>
  );
}
