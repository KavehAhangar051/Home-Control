"use client";

import { CheckCircle2, Download, Share, Smartphone, WifiOff } from "lucide-react";
import { useState } from "react";
import { soundManager } from "@/lib/audio";
import { triggerHaptic } from "@/lib/haptics";
import { useOnlineStatus, usePWAInstall } from "@/lib/hooks/use-pwa";

/**
 * In-app PWA install & offline readiness card inside Settings -> Stability.
 * Uses native `beforeinstallprompt` on Chromium/Android/Desktop, provides an iOS Safari
 * Home Screen guide when applicable, and hides install actions when already running standalone.
 */
export default function PwaInstallCard() {
  const { isStandalone, isInstallable, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [isPrompting, setIsPrompting] = useState(false);

  const handleInstall = async () => {
    soundManager.playClick();
    triggerHaptic("tap");
    setIsPrompting(true);

    try {
      await install();
    } finally {
      setIsPrompting(false);
    }
  };

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4 space-y-2.5 sm:space-y-3">
      <p className="text-[11px] text-text-muted leading-relaxed sm:text-xs sm:text-text-secondary">
        نصب داشبورد به‌صورت اپلیکیشن مستقل (PWA) با کش آفلاین پوسته، اجرای تمام‌صفحه و همگام‌سازی زنده
        بین تب‌ها
      </p>

      <div className="w-full p-3 sm:p-4 rounded-xl border border-border-color bg-card-bg flex flex-col gap-3 text-right">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <span className="font-sans font-medium text-xs flex items-center gap-1.5 text-text-primary">
              {isStandalone ? (
                <CheckCircle2
                  strokeWidth={1.6}
                  aria-hidden="true"
                  className="size-4 shrink-0 text-accent3"
                />
              ) : (
                <Smartphone
                  strokeWidth={1.6}
                  aria-hidden="true"
                  className="size-4 shrink-0 text-text-secondary"
                />
              )}
              <span className="leading-5">
                {isStandalone
                  ? "اپلیکیشن نصب شده و در حالت مستقل (Standalone) اجرا می‌شود"
                  : "نصب اپلیکیشن وب پیشرونده (PWA)"}
              </span>
            </span>

            <p className="text-[11px] sm:text-xs leading-relaxed font-sans text-text-muted sm:text-text-secondary">
              {isStandalone
                ? "فایل‌های پوسته و فونت‌ها توسط Service Worker برای بارگذاری سریع و آفلاین آماده هستند."
                : isInstallable
                  ? "داشبورد آماده نصب مستقیم روی صفحه اصلی دستگاه بدون نیاز به فروشگاه است."
                  : isIOS
                    ? "برای نصب در iOS: دکمه Share در نوار پایین Safari را بزنید و گزینه Add to Home Screen را انتخاب کنید."
                    : "پوسته آفلاین آماده است؛ در مرورگرهای پشتیبان می‌توانید از نوار آدرس یا منو گزینه نصب اپلیکیشن را انتخاب کنید."}
            </p>
          </div>

          {!isStandalone && isInstallable && (
            <button
              type="button"
              onClick={handleInstall}
              disabled={isPrompting}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-accent4 text-accent4-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Download strokeWidth={1.7} aria-hidden="true" className="size-3.5" />
              <span>{isPrompting ? "در حال نصب..." : "نصب اپ"}</span>
            </button>
          )}
        </div>

        {!isStandalone && isIOS && !isInstallable && (
          <div className="flex items-center gap-2 rounded-lg border border-border-color/70 bg-bg-main/70 px-3 py-2 text-[11px] text-text-secondary">
            <Share
              strokeWidth={1.6}
              aria-hidden="true"
              className="size-3.5 shrink-0 text-accent3"
            />
            <span>Safari ← Share ← Add to Home Screen</span>
          </div>
        )}

        {!isOnline && (
          <div className="flex items-center gap-2 rounded-lg border border-border-color/70 bg-bg-main/70 px-3 py-2 text-[11px] text-text-secondary">
            <WifiOff
              strokeWidth={1.6}
              aria-hidden="true"
              className="size-3.5 shrink-0 text-destructive"
            />
            <span>اتصال اینترنت قطع است؛ رابط کاربری از کش آفلاین بارگذاری شده است.</span>
          </div>
        )}
      </div>
    </div>
  );
}
