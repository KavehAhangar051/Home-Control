"use client";

import { useState } from "react";
import { CloudLightning, Server } from "@/components/ui/hugeicons-groups/controls";
import { Globe } from "@/components/ui/hugeicons-groups/media";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { persistStoreConfigToCloudflare } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  getCloudflareWorkerUrl,
  isCloudflareEnabled,
  setCloudflareWorkerUrl,
} from "@/features/iot/services/cloudflareService";

interface CloudflareIntegrationProps {
  isDark?: boolean;
}

export default function CloudflareIntegration({
  isDark: _isDark = true,
}: CloudflareIntegrationProps) {
  const [cfUrl, setCfUrl] = useState(() => getCloudflareWorkerUrl());
  const showToast = useIoTStore((s) => s.showToast);
  const manualSaveMode = useIoTStore((s) => s.manualSaveMode);
  const setManualSaveMode = useIoTStore((s) => s.setManualSaveMode);

  const [isSavingUrl, setIsSavingUrl] = useState(false);

  const handleSaveUrl = async () => {
    if (!cfUrl || cfUrl.includes("YOUR_SUBDOMAIN") || cfUrl.length < 10) {
      showToast("لطفاً یک آدرس معتبر وارد کنید.", "error");

      return;
    }

    setIsSavingUrl(true);
    setCloudflareWorkerUrl(cfUrl);

    if (!isCloudflareEnabled()) {
      setIsSavingUrl(false);

      return;
    }

    try {
      await persistStoreConfigToCloudflare({
        successToast: "آدرس ورکر جدید با موفقیت ذخیره شد.",
        errorToast: "خطا در ذخیره آدرس ورکر جدید.",
      });
    } catch (error) {
      console.error("Failed to persist Cloudflare worker URL", error);
    }

    setIsSavingUrl(false);
  };

  const isCfConnected = isCloudflareEnabled();

  return (
    <div className="pt-1 sm:pt-2 space-y-3.5 sm:space-y-4 text-right">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-xs text-accent3">اتصال کلودفلر</span>
        <span className="text-[11px] text-text-tertiary">همگام‌سازی ابری تنظیمات و چیدمان</span>
      </div>
      <p className="text-[11px] sm:text-xs text-text-tertiary leading-relaxed">
        برای ذخیره‌سازی ابری چیدمان و پایش وضعیت کلیدها، آدرس ورکر کلودفلر خود را وارد کنید:
      </p>
      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleSaveUrl}
          disabled={isSavingUrl}
          className="min-h-10 sm:min-h-0 px-4 py-2.5 bg-accent3/20 text-accent3 hover:bg-accent3 hover:text-accent3-foreground border border-accent3/30 rounded-xl text-xs font-bold transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] disabled:opacity-50 shrink-0"
        >
          {isSavingUrl ? "در حال ذخیره..." : "ذخیره آدرس"}
        </button>
        <div className="relative flex-1 min-w-0">
          <Label htmlFor="cloudflare-worker-url" className="sr-only">
            آدرس Cloudflare Worker
          </Label>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
            <Globe aria-hidden="true" className="size-4 text-accent3 opacity-70" />
          </div>
          <Input
            id="cloudflare-worker-url"
            type="url"
            dir="ltr"
            value={cfUrl}
            onChange={(e) => setCfUrl(e.target.value)}
            placeholder="https://home-control-db.kamyarahangar157.workers.dev"
            className="w-full py-2.5 pr-10 pl-3 border-border-color rounded-xl bg-bg-main text-xs text-text-primary placeholder:text-text-muted focus:border-accent3 font-mono"
          />
        </div>
      </div>
      <div className="p-3 rounded-xl border border-border-color bg-card-hover-bg flex items-center justify-between">
        <label htmlFor="manual-save-mode" className="flex items-center cursor-pointer gap-3 w-full">
          <span className="relative shrink-0">
            <input
              id="manual-save-mode"
              type="checkbox"
              className="sr-only"
              checked={manualSaveMode}
              onChange={(e) => setManualSaveMode(e.target.checked)}
            />
            <span
              aria-hidden="true"
              className={`block w-10 h-6 rounded-[8px] transition-colors ${manualSaveMode ? "bg-accent3" : "bg-border-color"}`}
            />
            <span
              aria-hidden="true"
              className={`dot absolute top-1 left-1 size-4 rounded-[5px] transition-transform ${manualSaveMode ? "bg-accent3-foreground transform translate-x-4" : "bg-text-secondary"}`}
            />
          </span>
          <span className="flex flex-col flex-1 min-w-0 text-right">
            <span className="text-xs font-bold text-text-primary">ذخیره دستی تغییرات چیدمان</span>
            <span className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed">
              تغییرات چیدمان فقط زمانی که دکمه «ذخیره‌سازی تغییرات» را بزنید به سرور ارسال می‌شوند.
            </span>
          </span>
        </label>
      </div>
      <div
        className={`p-3 rounded-xl border flex items-center justify-between text-right text-xs ${isCfConnected ? "bg-success-soft border-success/40 text-success" : "bg-card-hover-bg border-border-color text-text-tertiary"}`}
      >
        <div className="flex items-center gap-2 justify-start w-full">
          {isCfConnected ? (
            <CloudLightning aria-hidden="true" className="size-4 text-success shrink-0" />
          ) : (
            <Server aria-hidden="true" className="size-4 text-text-tertiary shrink-0" />
          )}
          <span className="font-medium leading-relaxed">
            {isCfConnected
              ? "متصل به فضای ابری کلودفلر"
              : "ذخیره‌سازی در حافظه محلی مرورگر (آدرس ورکر تنظیم نشده است)"}
          </span>
        </div>
      </div>
    </div>
  );
}
