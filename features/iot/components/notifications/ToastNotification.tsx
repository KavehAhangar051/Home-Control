"use client";

import { AnimatePresence, m, type PanInfo, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent } from "react";
import { CheckCircle, X, XCircle } from "@/components/ui/hugeicons-groups/shell";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { soundManager } from "@/lib/audio";
import {
  DURATION,
  EASE_IN_OUT,
  ERROR_SHAKE_KEYFRAMES,
  TRANSITION_ENTER_STANDARD,
  TRANSITION_EXIT_STANDARD,
} from "@/lib/ease";
import { triggerHaptic } from "@/lib/haptics";

const SUCCESS_DISMISS_MS = 2200;
const ERROR_DISMISS_MS = 3600;
const SWIPE_DISMISS_OFFSET_Y = -22;
const SWIPE_DISMISS_VELOCITY_Y = -220;

/**
 * Compact, non-blocking top-center status toast.
 * Supports click-to-dismiss and Motion 14 upward swipe-to-dismiss, anchored in the header band
 * with a pointer-events-none outer wrapper so cards and controls stay clickable underneath.
 */
export default function ToastNotification() {
  const toast = useIoTStore((s) => s.toast);
  const clearToast = useIoTStore((s) => s.clearToast);
  const reduceMotion = useReducedMotion();

  const onAnnounceToast = useEffectEvent((type: "success" | "error") => {
    if (type === "success") {
      soundManager.playSuccess();
      triggerHaptic("success");
    } else {
      soundManager.playError();
      triggerHaptic("error");
    }
  });

  const onAutoDismiss = useEffectEvent(() => {
    clearToast();
  });

  useEffect(() => {
    if (!toast) return;

    onAnnounceToast(toast.type);

    const durationMs = toast.type === "success" ? SUCCESS_DISMISS_MS : ERROR_DISMISS_MS;
    const timer = setTimeout(onAutoDismiss, durationMs);

    return () => clearTimeout(timer);
  }, [toast]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < SWIPE_DISMISS_OFFSET_Y || info.velocity.y < SWIPE_DISMISS_VELOCITY_Y) {
      triggerHaptic("tap");
      clearToast();
    }
  };

  const isError = toast?.type === "error";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-1.5 z-[200] flex justify-center px-3 md:top-2">
      <AnimatePresence mode="wait">
        {toast && (
          <m.div
            key={`${toast.type}-${toast.message}`}
            dir="rtl"
            role={isError ? "alert" : "status"}
            aria-live={isError ? "assertive" : "polite"}
            aria-atomic="true"
            drag={reduceMotion ? false : "y"}
            dragDirectionLock
            dragConstraints={{ top: -90, bottom: 0 }}
            dragElastic={{ top: 0.35, bottom: 0.06 }}
            dragSnapToOrigin
            onDragEnd={handleDragEnd}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: isError && !reduceMotion ? [...ERROR_SHAKE_KEYFRAMES] : 0,
            }}
            exit={{
              opacity: 0,
              y: -12,
              scale: 0.96,
              transition: TRANSITION_EXIT_STANDARD,
            }}
            transition={{
              ...TRANSITION_ENTER_STANDARD,
              x: isError
                ? { duration: DURATION.slow, ease: EASE_IN_OUT }
                : TRANSITION_ENTER_STANDARD,
            }}
            onClick={clearToast}
            className={`pointer-events-auto inline-flex max-w-[min(28rem,calc(100vw-1.5rem))] cursor-pointer touch-pan-x items-center gap-2 rounded-2xl border bg-sidebar-bg py-2 ps-3 pe-2.5 text-right shadow-lg transition-colors select-none ${
              isError
                ? "border-destructive/60 text-text-primary"
                : "border-success/55 text-text-primary"
            }`}
          >
            {isError ? (
              <XCircle
                aria-hidden="true"
                strokeWidth={2}
                className="size-4 shrink-0 text-destructive"
              />
            ) : (
              <CheckCircle
                aria-hidden="true"
                strokeWidth={2}
                className="size-4 shrink-0 text-success"
              />
            )}

            <span className="min-w-0 line-clamp-2 break-words text-xs font-medium leading-5 text-text-primary">
              {toast.message}
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearToast();
              }}
              aria-label="بستن اعلان"
              className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors hover:bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent3"
            >
              <X aria-hidden="true" className="size-3" strokeWidth={2.2} />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
