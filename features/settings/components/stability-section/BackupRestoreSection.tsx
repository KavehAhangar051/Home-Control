"use client";

import { Download, FolderOpen, Share2 } from "lucide-react";
import { useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  buildDashboardBackupBundle,
  restoreDashboardBackup,
} from "@/features/iot/services/configBackupService";
import {
  isFileSystemAccessSupported,
  isWebShareSupported,
  openJsonWithFilePicker,
  saveJsonWithFilePicker,
  shareJsonPayload,
} from "@/lib/fileTransfer";
import { triggerHaptic } from "@/lib/haptics";

function buildBackupFilename(): string {
  const datePart = new Date().toISOString().slice(0, 10);

  return `home-control-backup-${datePart}.json`;
}

export default function BackupRestoreSection() {
  const showToast = useIoTStore((s) => s.showToast);
  const [busyAction, setBusyAction] = useState<"export" | "share" | "import" | null>(null);

  const fsSupported = isFileSystemAccessSupported();
  const shareSupported = isWebShareSupported();

  const handleExportBackup = async () => {
    setBusyAction("export");

    try {
      const bundle = buildDashboardBackupBundle();
      const result = await saveJsonWithFilePicker({
        filename: buildBackupFilename(),
        description: "پشتیبان کامل داشبورد کنترل خانه",
        data: bundle,
      });

      if (result.saved) {
        triggerHaptic("success");
        showToast(
          result.method === "fs-access"
            ? "فایل پشتیبان با File System Access ذخیره شد."
            : "فایل پشتیبان داشبورد دانلود شد.",
          "success",
        );
      }
    } catch {
      triggerHaptic("error");
      showToast("خطا در تولید فایل پشتیبان.", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleShareBackup = async () => {
    setBusyAction("share");

    try {
      const bundle = buildDashboardBackupBundle();
      const result = await shareJsonPayload({
        title: "پشتیبان داشبورد کنترل خانه",
        text: "فایل پیکربندی کامل داشبورد هوشمند (EspConfig + Trellis + Workflows)",
        filename: buildBackupFilename(),
        data: bundle,
      });

      if (result.shared) {
        triggerHaptic("success");
        showToast(
          result.method === "clipboard"
            ? "پیکربندی کامل در کلیپ‌بورد کپی شد."
            : "پشتیبان داشبورد به اشتراک گذاشته شد.",
          "success",
        );
      }
    } catch {
      triggerHaptic("error");
      showToast("خطا در اشتراک‌گذاری پشتیبان.", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportBackup = async () => {
    setBusyAction("import");

    try {
      const picked = await openJsonWithFilePicker({
        description: "فایل پشتیبان داشبورد (JSON)",
      });

      if (!picked) {
        setBusyAction(null);

        return;
      }

      const summary = await restoreDashboardBackup(picked.data);
      triggerHaptic("success");
      showToast(
        `پشتیبان بازیابی شد (${summary.segmentsCount} قطعه، ${summary.workflowsCount} گردش کار، ${summary.layoutsCount} چیدمان).`,
        "success",
      );
    } catch (error) {
      triggerHaptic("error");
      const message =
        error instanceof Error ? error.message : "فایل انتخاب‌شده معتبر یا قابل بازیابی نیست.";
      showToast(message, "error");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border-color bg-card-hover-bg p-3 sm:p-3.5 text-right">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-xs font-bold text-text-primary">
            پشتیبان‌گیری و انتقال مستقیم فایل (Backup & Restore)
          </div>
          <p className="text-[11px] leading-5 text-text-tertiary">
            خروجی گرفتن، اشتراک‌گذاری یا بازیابی کامل قطعات (`EspConfig`)، چیدمان‌های آزاد (`Trellis`)
            و سناریوهای گردش کار در یک فایل JSON.
          </p>
        </div>

        <span className="hidden sm:inline font-mono text-[10px] tabular-nums text-text-muted shrink-0">
          {fsSupported ? "File System API" : "Direct JSON"}
          {shareSupported ? " · Web Share" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleExportBackup}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-accent3/35 bg-accent3/15 px-3 py-2 text-xs font-bold text-accent3 transition-colors hover:bg-accent3 hover:text-bg-main disabled:opacity-50"
        >
          <Download className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{busyAction === "export" ? "در حال ذخیره..." : "ذخیره فایل پشتیبان"}</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleShareBackup}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-bg-main px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-accent3 hover:text-accent3 disabled:opacity-50"
        >
          <Share2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{busyAction === "share" ? "در حال ارسال..." : "اشتراک‌گذاری (Share)"}</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleImportBackup}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-bg-main px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-accent3 hover:text-accent3 disabled:opacity-50"
        >
          <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{busyAction === "import" ? "در حال بازیابی..." : "بازیابی از فایل (Restore)"}</span>
        </button>
      </div>
    </div>
  );
}
