"use client";

import React, { useState } from "react";
import { CloudLightning, Globe, Server } from "@/components/ui/hugeicons";
import { buildEspConfig } from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { saveConfigToCloudflare } from "@/features/iot/services/cloudflare/api";
import {
  getCloudflareWorkerUrl,
  isCloudflareEnabled,
  setCloudflareWorkerUrl,
} from "@/features/iot/services/cloudflareService";
import type { EspConfig } from "@/features/iot/services/esp32Config";

interface CloudflareIntegrationProps {
  isDark?: boolean;
}

async function submitCloudflareConfig(
  currentConfig: EspConfig,
  showToast: (msg: string, type: "success" | "error") => void,
  setIsSavingUrl: (val: boolean) => void,
): Promise<void> {
  try {
    const result = await saveConfigToCloudflare(currentConfig);

    if (result.success) {
      useIoTStore.getState().resetUnsavedChanges();
    }

    showToast(
      result.success ? "آدرس ورکر جدید با موفقیت ذخیره شد." : "خطا در ذخیره آدرس ورکر جدید.",
      result.success ? "success" : "error",
    );
  } finally {
    setIsSavingUrl(false);
  }
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

    const currentConfig = buildEspConfig(useIoTStore.getState());
    currentConfig.worker_url = getCloudflareWorkerUrl();

    await submitCloudflareConfig(currentConfig, showToast, setIsSavingUrl);
  };

  const isCfConnected = isCloudflareEnabled();

  return (
    <div className="pt-2 space-y-4 text-right">
      <div className="flex items-center justify-between">
        <span className="text-[11px] theme-text-tertiary">همگام‌سازی ابری تنظیمات و چیدمان</span>
        <span className="font-bold text-xs text-accent3">اتصال کلودفلر</span>
      </div>
      <p className="text-xs theme-text-tertiary leading-relaxed">
        برای ذخیره‌سازی ابری چیدمان و پایش وضعیت کلیدها، آدرس ورکر کلودفلر خود را وارد کنید:
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSaveUrl}
          disabled={isSavingUrl}
          className="px-4 py-2.5 bg-accent3/20 text-accent3 hover:bg-[var(--accent3)] hover:text-[var(--bg-main)] border border-accent3/30 rounded-xl text-xs font-bold transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] disabled:opacity-50"
        >
          {isSavingUrl ? "در حال ذخیره..." : "ذخیره آدرس"}
        </button>
        <div className="relative flex-1">
          <label htmlFor="cloudflare-worker-url" className="sr-only">
            آدرس Cloudflare Worker
          </label>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Globe aria-hidden="true" className="h-4 w-4 text-accent3 opacity-70" />
          </div>
          <input
            id="cloudflare-worker-url"
            type="url"
            dir="ltr"
            value={cfUrl}
            onChange={(e) => setCfUrl(e.target.value)}
            placeholder="https://home-control-db.kamyarahangar157.workers.dev"
            className="block w-full py-2.5 pr-10 pl-3 border border-[var(--border-color)] rounded-xl bg-[var(--bg-main)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-accent3 font-mono transition-colors"
          />
        </div>
      </div>
      <div className="p-3 mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-hover-bg)] flex items-center justify-between">
        <label htmlFor="manual-save-mode" className="flex items-center cursor-pointer gap-3 w-full">
          <span className="relative">
            <input
              id="manual-save-mode"
              type="checkbox"
              className="sr-only"
              checked={manualSaveMode}
              onChange={(e) => setManualSaveMode(e.target.checked)}
            />
            <span
              aria-hidden="true"
              className={`block w-10 h-6 rounded-[8px] transition-colors ${manualSaveMode ? "bg-[var(--accent3)]" : "bg-[var(--border-color)]"}`}
            />
            <span
              aria-hidden="true"
              className={`dot absolute top-1 left-1 w-4 h-4 rounded-[5px] transition-transform ${manualSaveMode ? "bg-[var(--bg-main)] transform translate-x-4" : "bg-[var(--text-secondary)]"}`}
            />
          </span>
          <span className="flex flex-col flex-1 text-right">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              ذخیره دستی تغییرات چیدمان
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              تغییرات چیدمان فقط زمانی که دکمه «ذخیره‌سازی تغییرات» را بزنید به سرور ارسال می‌شوند.
            </span>
          </span>
        </label>
      </div>
      <div
        className={`p-3 rounded-xl border flex items-center justify-between text-right text-xs ${isCfConnected ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "bg-[var(--card-hover-bg)] border-[var(--border-color)] text-[var(--text-tertiary)]"}`}
      >
        <div className="flex items-center gap-2 justify-end w-full">
          <span className="font-medium">
            {isCfConnected
              ? "متصل به فضای ابری کلودفلر"
              : "ذخیره‌سازی در حافظه محلی مرورگر (آدرس ورکر تنظیم نشده است)"}
          </span>
          {isCfConnected ? (
            <CloudLightning
              aria-hidden="true"
              className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
            />
          ) : (
            <Server aria-hidden="true" className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}
