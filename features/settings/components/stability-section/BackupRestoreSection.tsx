"use client";

import { useState } from "react";
import { Download, Share } from "@/components/ui/hugeicons-groups/media";
import { CloudUpload } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  buildDashboardBackupBundle,
  restoreDashboardBackup,
} from "@/features/iot/services/configBackupService";
import {
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
      <div className="space-y-0.5">
        <div className="text-xs font-bold text-text-primary">پشتیبان‌گیری و بازیابی</div>
        <p className="text-[11px] leading-5 text-text-tertiary">
          تنظیمات داشبورد، قطعات، قوانین، اتصال‌ها، چیدمان‌ها و گردش‌های کاری را در یک فایل JSON ذخیره
          یا بازیابی کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleExportBackup}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-accent3/35 bg-accent3/15 px-3 py-2 text-xs font-bold text-accent3 transition-colors hover:bg-accent3 hover:text-accent3-foreground disabled:opacity-50"
        >
          <Download className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{busyAction === "export" ? "در حال ذخیره..." : "ذخیره پشتیبان"}</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleShareBackup}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-bg-main px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-accent3 hover:text-accent3 disabled:opacity-50"
        >
          <Share className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{busyAction === "share" ? "در حال ارسال..." : "اشتراک‌گذاری"}</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleImportBackup}
          className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border-color bg-bg-main px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-accent3 hover:text-accent3 disabled:opacity-50"
        >
          <CloudUpload className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{busyAction === "import" ? "در حال بازیابی..." : "بازیابی از فایل"}</span>
        </button>
      </div>
    </div>
  );
}
