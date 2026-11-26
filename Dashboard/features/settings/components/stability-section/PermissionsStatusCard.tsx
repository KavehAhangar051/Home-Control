"use client";

import { useCallback, useEffect, useState } from "react";
import type { HugeIconComponent } from "@/components/ui/hugeicon-factory";
import { ShieldCheck } from "@/components/ui/hugeicons-groups/controls";
import { HardDrive, Monitor, Volume2 } from "@/components/ui/hugeicons-groups/media";
import { Bell, CheckCircle, Mic, RefreshCw } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { soundManager } from "@/lib/audio";
import { triggerHaptic } from "@/lib/haptics";
import {
  clearDashboardConsent,
  type DashboardPermissionId,
  type DashboardPermissionSnapshot,
  openPermissionsSetupModal,
  type PermissionStateStatus,
  probeAllDashboardPermissions,
  readDashboardConsent,
} from "@/lib/permissions";

const STATUS_ROWS: ReadonlyArray<{
  id: DashboardPermissionId;
  label: string;
  Icon: HugeIconComponent;
}> = [
  { id: "storage", label: "ذخیره‌سازی مرورگر", Icon: HardDrive },
  { id: "microphone", label: "میکروفون فرمان صوتی", Icon: Mic },
  { id: "audio", label: "صدای داشبورد", Icon: Volume2 },
  { id: "notifications", label: "اعلان‌های پس‌زمینه", Icon: Bell },
  { id: "wakeLock", label: "روشن‌ماندن نمایشگر", Icon: Monitor },
];

function getStatusText(status?: PermissionStateStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "granted":
      return { label: "مجاز", className: "text-success" };
    case "denied":
      return { label: "ردشده", className: "text-destructive" };
    case "unsupported":
      return { label: "پشتیبانی نمی‌شود", className: "text-text-muted" };
    default:
      return { label: "درخواست‌نشده", className: "text-text-secondary" };
  }
}

/**
 * Displays live dashboard permission & consent cookie state inside Settings -> Stability
 * and lets the user re-open the permissions onboarding flow or reset the consent cookie.
 */
export default function PermissionsStatusCard() {
  const showToast = useIoTStore((s) => s.showToast);
  const [statuses, setStatuses] = useState<
    Partial<Record<DashboardPermissionId, DashboardPermissionSnapshot>>
  >({});
  const [hasCookie, setHasCookie] = useState(false);

  const refresh = useCallback(async () => {
    const [nextStatuses] = await Promise.all([probeAllDashboardPermissions()]);
    setStatuses(nextStatuses);
    setHasCookie(readDashboardConsent() !== null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpenWizard = () => {
    soundManager.playClick();
    triggerHaptic("tap");
    openPermissionsSetupModal();
  };

  const handleResetConsent = () => {
    soundManager.playClick();
    triggerHaptic("tap");
    clearDashboardConsent();
    setHasCookie(false);
    openPermissionsSetupModal();
    showToast("تنظیمات راه‌اندازی اولیه بازنشانی شد.", "success");
  };

  return (
    <div className="border-b border-border-color pb-3.5 sm:pb-4">
      <div className="w-full rounded-xl border border-border-color bg-card-bg p-3 text-right sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
            {hasCookie ? (
              <CheckCircle aria-hidden="true" className="size-4 shrink-0 text-accent3" />
            ) : (
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
            )}
            <span>{hasCookie ? "راه‌اندازی اولیه تکمیل شده است" : "راه‌اندازی اولیه تکمیل نشده است"}</span>
          </span>

          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="به‌روزرسانی وضعیت دسترسی‌ها"
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-color bg-bg-main text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
          >
            <RefreshCw aria-hidden="true" className="size-3.5" />
          </button>
        </div>

        <div className="divide-y divide-border-color/70 border-y border-border-color/70">
          {STATUS_ROWS.map(({ id, label, Icon }) => {
            const meta = getStatusText(statuses[id]?.status);

            return (
              <div key={id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="flex items-center gap-2 text-text-secondary">
                  <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>{label}</span>
                </span>
                <span className={`font-medium tabular-nums ${meta.className}`}>{meta.label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleOpenWizard}
            className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent3 px-3 py-2 text-xs font-medium text-accent3-foreground transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
            <span>بازبینی و درخواست دسترسی‌ها</span>
          </button>

          {hasCookie && (
            <button
              type="button"
              onClick={handleResetConsent}
              className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border-color bg-bg-main px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary whitespace-nowrap"
            >
              <RefreshCw aria-hidden="true" className="size-3.5 shrink-0" />
              <span>بازنشانی راه‌اندازی</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
