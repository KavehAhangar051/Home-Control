"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type React from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { CloudUpload, WifiOff } from "@/components/ui/hugeicons-groups/shell";
import { DURATION, EASE_OUT, SPRING_PRESS } from "@/lib/ease";

interface LowDataModeBannerProps {
  lowDataMode: boolean;
  animationsEnabled: boolean;
  refetchIot: () => void;
  manualSaveMode?: boolean;
  unsavedChangesCount?: number;
  triggerCloudflarePush?: () => void;
}

const ALERT_LAYOUT =
  "!grid !grid-cols-[1.25rem_minmax(0,1fr)_auto] !items-start !gap-x-3 !gap-y-1 !px-4 !py-3.5 text-right";

const ACTION_BUTTON_CLASS =
  "inline-flex min-h-9 items-center justify-center rounded-md bg-accent3 px-3 py-2 text-xs font-medium text-accent3-foreground transition-colors hover:bg-accent3-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 max-sm:w-full";

interface WarningBannerCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  disabled?: boolean;
  reduceMotion: boolean;
}

function WarningBannerCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  disabled = false,
  reduceMotion,
}: WarningBannerCardProps) {
  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, height: 0, y: -6 }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              height: { duration: DURATION.standard, ease: EASE_OUT },
              opacity: { duration: DURATION.quick, ease: EASE_OUT },
              y: { duration: DURATION.quick, ease: EASE_OUT },
            }
      }
      className="w-full overflow-hidden"
      style={{ contain: "layout style", backfaceVisibility: "hidden" }}
    >
      <Alert dir="rtl" variant="warning" className={ALERT_LAYOUT}>
        {icon}
        <AlertTitle className="!col-start-2 !row-start-1 !min-h-0 !line-clamp-none min-w-0 break-words text-sm font-medium leading-5">
          {title}
        </AlertTitle>
        <AlertDescription className="!col-start-2 !row-start-2 min-w-0 break-words whitespace-normal text-xs leading-6">
          {description}
        </AlertDescription>
        <AlertAction className="max-sm:w-full">
          <m.button
            type="button"
            onClick={onAction}
            disabled={disabled}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={reduceMotion ? undefined : SPRING_PRESS}
            className={ACTION_BUTTON_CLASS}
          >
            {actionLabel}
          </m.button>
        </AlertAction>
      </Alert>
    </m.div>
  );
}

export default function LowDataModeBanner({
  lowDataMode,
  animationsEnabled,
  refetchIot,
  manualSaveMode = false,
  unsavedChangesCount = 0,
  triggerCloudflarePush,
}: LowDataModeBannerProps) {
  const prefersReduced = useReducedMotion();
  const reduceMotion = !animationsEnabled || Boolean(prefersReduced);
  const showUnsavedBanner = manualSaveMode && unsavedChangesCount > 0;
  const hasAnyBanner = lowDataMode || showUnsavedBanner;

  return (
    <AnimatePresence initial={false}>
      {hasAnyBanner && (
        <m.div
          key="low-data-banner-stack"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : DURATION.quick, ease: EASE_OUT }}
          className="mx-auto flex w-full max-w-5xl flex-col gap-2 max-md:mt-6 md:mt-0"
        >
          <AnimatePresence initial={false}>
            {lowDataMode && (
              <WarningBannerCard
                key="low-data-warning"
                icon={
                  <WifiOff
                    aria-hidden="true"
                    className="!col-start-1 !row-start-1 !mt-0.5 !size-5"
                  />
                }
                title="حالت صرفه‌جویی در مصرف اینترنت فعال است"
                description="دریافت خودکار داده‌ها متوقف شده است"
                actionLabel="به‌روزرسانی کنونی"
                onAction={refetchIot}
                reduceMotion={reduceMotion}
              />
            )}

            {showUnsavedBanner && (
              <WarningBannerCard
                key="unsaved-warning"
                icon={
                  <CloudUpload
                    aria-hidden="true"
                    className="!col-start-1 !row-start-1 !mt-0.5 !size-5"
                  />
                }
                title="تغییرات ذخیره‌نشده"
                description={`${unsavedChangesCount} تغییر هنوز در حافظه ابری کلودفلر ذخیره نشده است`}
                actionLabel="ذخیره‌سازی تغییرات"
                onAction={triggerCloudflarePush}
                disabled={!triggerCloudflarePush}
                reduceMotion={reduceMotion}
              />
            )}
          </AnimatePresence>
        </m.div>
      )}
    </AnimatePresence>
  );
}
