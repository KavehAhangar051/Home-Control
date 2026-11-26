"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { ToggleIndicator } from "@/components/dissolve/toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { HugeIconComponent } from "@/components/ui/hugeicon-factory";
import { Check, Info, ShieldCheck } from "@/components/ui/hugeicons-groups/controls";
import { HardDrive, Monitor, Volume2 } from "@/components/ui/hugeicons-groups/media";
import { Bell, Lock, Mic, X } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { soundManager } from "@/lib/audio";
import { DURATION, EASE_OUT, TRANSITION_ENTER_STANDARD, TRANSITION_EXIT_QUICK } from "@/lib/ease";
import { triggerHaptic } from "@/lib/haptics";
import {
  DEFAULT_PERMISSION_SELECTION,
  type DashboardPermissionId,
  type DashboardPermissionSnapshot,
  hasDashboardConsent,
  type PermissionSelectionMap,
  type PermissionStateStatus,
  probeAllDashboardPermissions,
  readDashboardConsent,
  requestSelectedDashboardPermissions,
  subscribePermissionsModal,
} from "@/lib/permissions";

interface PermissionDescriptor {
  id: DashboardPermissionId;
  title: string;
  description: string;
  required?: boolean;
  Icon: HugeIconComponent;
}

const PERMISSION_ITEMS: readonly PermissionDescriptor[] = [
  {
    id: "storage",
    title: "کوکی و حافظه محلی",
    description: "ذخیره تنظیمات، فونت‌ها و کش آفلاین داشبورد در مرورگر",
    required: true,
    Icon: HardDrive,
  },
  {
    id: "microphone",
    title: "میکروفون فرمان صوتی",
    description: "اجرای مستقیم دستورات صوتی بدون نیاز به تایید مجدد",
    Icon: Mic,
  },
  {
    id: "audio",
    title: "خروجی صدا و بازخورد لمسی",
    description: "پخش افکت‌های صوتی و لرزش لمسی هنگام کنترل قطعات",
    Icon: Volume2,
  },
  {
    id: "notifications",
    title: "اعلان‌های پس‌زمینه",
    description: "نمایش تغییر وضعیت اتصال ESP32 هنگام بسته بودن تب",
    Icon: Bell,
  },
  {
    id: "wakeLock",
    title: "بیدار نگه‌داشتن نمایشگر",
    description: "جلوگیری از خاموش شدن خودکار صفحه روی تبلت یا نمایشگر ثابت",
    Icon: Monitor,
  },
];

function formatStatusLabel(
  status?: PermissionStateStatus,
  detail?: string,
): {
  text: string;
  toneClass: string;
} {
  switch (status) {
    case "granted":
      return { text: detail ?? "فعال و تاییدشده", toneClass: "text-success" };
    case "denied":
      return { text: "مسدود در تنظیمات مرورگر", toneClass: "text-destructive" };
    case "unsupported":
      return { text: "پشتیبانی نمی‌شود", toneClass: "text-text-muted" };
    default:
      return { text: "آماده درخواست", toneClass: "text-text-secondary" };
  }
}

export default function PermissionsOnboardingModal() {
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const showToast = useIoTStore((s) => s.showToast);
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReviewedOnce, setHasReviewedOnce] = useState(false);
  const [blockedIds, setBlockedIds] = useState<DashboardPermissionId[]>([]);
  const [statuses, setStatuses] = useState<
    Partial<Record<DashboardPermissionId, DashboardPermissionSnapshot>>
  >({});
  const [selection, setSelection] = useState<PermissionSelectionMap>(DEFAULT_PERMISSION_SELECTION);

  const syncLiveStatus = useCallback(async () => {
    const probed = await probeAllDashboardPermissions();
    setStatuses(probed);
    const saved = readDashboardConsent();

    setSelection({
      storage: true,
      microphone: saved
        ? saved.permissions.microphone || probed.microphone.status !== "denied"
        : true,
      audio: saved ? saved.permissions.audio : true,
      notifications: saved
        ? saved.permissions.notifications || probed.notifications.status !== "denied"
        : true,
      wakeLock: probed.wakeLock.status === "granted" || Boolean(saved?.permissions.wakeLock),
    });
  }, []);

  useEffect(() => {
    if (!hasDashboardConsent()) {
      setIsOpen(true);
      void syncLiveStatus();
    }

    return subscribePermissionsModal((nextOpen) => {
      if (nextOpen) {
        setBlockedIds([]);
        setHasReviewedOnce(false);
        setIsOpen(true);
        void syncLiveStatus();
      } else {
        setIsOpen(false);
      }
    });
  }, [syncLiveStatus]);

  const handleCloseAsEssential = useCallback(async () => {
    if (isSubmitting) return;
    soundManager.playClick();
    triggerHaptic("tap");

    if (!hasDashboardConsent()) {
      setIsSubmitting(true);
      try {
        await requestSelectedDashboardPermissions(
          {
            storage: true,
            microphone: false,
            audio: selection.audio,
            notifications: false,
            wakeLock: selection.wakeLock,
          },
          "essential",
        );
      } finally {
        setIsSubmitting(false);
      }
    }

    setIsOpen(false);
  }, [isSubmitting, selection.audio, selection.wakeLock]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void handleCloseAsEssential();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCloseAsEssential, isOpen]);

  const handleToggleItem = (id: DashboardPermissionId) => {
    if (id === "storage" || isSubmitting) return;
    soundManager.playClick();
    triggerHaptic("tap");
    setSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGrantAll = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setBlockedIds([]);

    try {
      const result = await requestSelectedDashboardPermissions(selection, "all");
      setStatuses(result.statuses);
      setBlockedIds(result.blockedIds);
      setHasReviewedOnce(true);

      if (result.blockedIds.length === 0) {
        soundManager.playSuccess();
        showToast("دسترسی‌ها تایید و در کوکی داشبورد ذخیره شد.", "success");
        setIsOpen(false);
      } else {
        soundManager.playError();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          key="permissions-onboarding-backdrop"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="permissions-modal-title"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : DURATION.quick, ease: EASE_OUT }}
          onClick={() => void handleCloseAsEssential()}
          className="fixed inset-0 z-[185] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[2px] sm:p-5"
        >
          <m.div
            key="permissions-onboarding-dialog"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: 8, scale: 0.98, transition: TRANSITION_EXIT_QUICK }
            }
            transition={reduceMotion ? { duration: 0 } : TRANSITION_ENTER_STANDARD}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-xl"
          >
            <div className="bezel-shell">
              <Card className="bezel-core max-h-[90dvh] overflow-y-auto bg-card-bg-solid text-right shadow-2xl">
                <CardHeader className="border-b border-border-color pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle
                        id="permissions-modal-title"
                        className="flex items-center gap-2 text-base font-semibold text-balance text-text-primary sm:text-lg"
                      >
                        <ShieldCheck
                          strokeWidth={1.8}
                          aria-hidden="true"
                          className="size-4.5 shrink-0 text-accent3"
                        />
                        <span>دسترسی‌های داشبورد</span>
                      </CardTitle>
                      <p className="text-xs leading-6 text-text-secondary">
                        مجوزهای دلخواه را انتخاب کنید؛ تصمیم شما در مرورگر ذخیره می‌شود.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCloseAsEssential()}
                      disabled={isSubmitting}
                      aria-label="بستن پنجره دسترسی‌ها"
                      className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border-color bg-card-bg text-text-secondary transition-colors hover:bg-card-hover-bg hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
                    >
                      <X aria-hidden="true" className="size-4" strokeWidth={2} />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="divide-y divide-border-color">
                    {PERMISSION_ITEMS.map(({ id, title, description, required, Icon }) => {
                      const snapshot = statuses[id];
                      const statusMeta = formatStatusLabel(snapshot?.status, snapshot?.detail);
                      const isUnsupported = snapshot?.status === "unsupported";
                      const isChecked = required ? true : selection[id] && !isUnsupported;

                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-color bg-bg-main text-text-primary">
                              <Icon aria-hidden="true" className="size-4" strokeWidth={1.7} />
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="text-xs font-semibold text-text-primary sm:text-sm">
                                  {title}
                                </span>
                                <span aria-hidden="true" className="text-text-muted">
                                  ·
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${statusMeta.toneClass}`}
                                >
                                  {snapshot?.status === "granted" && (
                                    <Check aria-hidden="true" className="size-3 shrink-0" />
                                  )}
                                  {snapshot?.status === "denied" && (
                                    <Info aria-hidden="true" className="size-3 shrink-0" />
                                  )}
                                  {statusMeta.text}
                                </span>
                              </div>
                              <p className="text-[11px] leading-5 text-text-secondary sm:text-xs">
                                {description}
                              </p>
                            </div>
                          </div>

                          {required ? (
                            <span
                              title="برای ذخیره رضایت کوکی و تنظیمات ضروری است"
                              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-muted whitespace-nowrap"
                            >
                              <Lock aria-hidden="true" className="size-3.5" />
                              ضروری
                            </span>
                          ) : (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isChecked}
                              aria-label={title}
                              disabled={isUnsupported || isSubmitting}
                              onClick={() => handleToggleItem(id)}
                              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-[9px] p-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3 disabled:cursor-not-allowed disabled:opacity-45 ${
                                isChecked
                                  ? "border border-transparent bg-accent3"
                                  : "border border-border-color bg-bg-main"
                              }`}
                            >
                              <ToggleIndicator
                                value={isChecked}
                                size="sm"
                                onColor="var(--accent3)"
                                offColor="var(--bg-main)"
                                reducedMotion={reduceMotion}
                                className="scale-[0.95]"
                              />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {hasReviewedOnce && blockedIds.length > 0 && (
                    <div className="border-t border-border-color px-4 py-3 sm:px-6">
                      <Alert variant="warning" dir="rtl">
                        <Info aria-hidden="true" className="size-4" />
                        <AlertTitle>برخی دسترسی‌ها در مرورگر مسدود شده‌اند</AlertTitle>
                        <AlertDescription>
                          از تنظیمات کنار نوار آدرس مرورگر مجوزهای مسدودشده را آزاد کنید یا مستقیم
                          وارد داشبورد شوید.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col-reverse gap-2.5 border-t border-border-color px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCloseAsEssential()}
                    disabled={isSubmitting}
                    className="min-h-11 w-full whitespace-nowrap shrink-0 sm:w-auto"
                  >
                    فقط موارد ضروری
                  </Button>

                  {hasReviewedOnce && blockedIds.length > 0 ? (
                    <Button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="min-h-11 w-full bg-accent3 text-accent3-foreground hover:opacity-90 whitespace-nowrap shrink-0 sm:w-auto"
                    >
                      ورود به داشبورد
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleGrantAll()}
                      disabled={isSubmitting}
                      className="min-h-11 w-full bg-accent3 text-accent3-foreground hover:opacity-90 whitespace-nowrap shrink-0 sm:w-auto"
                    >
                      <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
                      <span>{isSubmitting ? "در حال دریافت مجوزها..." : "تایید و فعال‌سازی"}</span>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
