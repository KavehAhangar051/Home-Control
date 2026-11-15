"use client";

import { useEffect } from "react";

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
    <html lang="fa" dir="rtl">
      <body className="flex min-h-screen w-full items-center justify-center bg-[#0b0c10] px-4 text-[#e5e7eb] font-sans">
        <main
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-[#12141b] p-6 text-center shadow-lg"
        >
          <h1 className="text-lg font-bold text-zinc-100">خطای بحرانی در بارگذاری برنامه</h1>
          <p className="text-xs leading-6 text-zinc-400">
            اجرای لایه اصلی داشبورد با خطا متوقف شد. می‌توانید صفحه را مجدداً راه‌اندازی کنید.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-zinc-100 px-4 text-xs font-bold text-zinc-900 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            راه‌اندازی مجدد
          </button>
        </main>
      </body>
    </html>
  );
}
