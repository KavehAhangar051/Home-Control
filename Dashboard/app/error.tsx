"use client";

import { useEffect } from "react";

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
      className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0b0c10] px-4 text-center text-[#e5e7eb] font-sans"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-[#12141b] p-6 shadow-lg">
        <h1 className="text-lg font-bold text-zinc-100">خطایی در داشبورد رخ داد</h1>
        <p className="text-xs leading-6 text-zinc-400">
          مشکلی در اجرای صفحه پیش آمد. برای بازیابی وضعیت، دوباره تلاش کنید.
        </p>
        {error.message && (
          <p className="w-full rounded-lg border border-zinc-800 bg-[#0b0c10] px-3 py-2 font-mono text-[11px] text-zinc-400 break-words">
            {error.message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-100 px-4 text-xs font-bold text-zinc-900 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            تلاش مجدد
          </button>
          <a
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            بارگذاری مجدد صفحه
          </a>
        </div>
      </div>
    </main>
  );
}
