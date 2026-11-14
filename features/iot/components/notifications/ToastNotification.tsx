"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect } from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, XCircle } from "@/components/ui/hugeicons";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { soundManager } from "@/lib/audio";
import {
  DURATION,
  EASE_IN_OUT,
  ERROR_SHAKE_KEYFRAMES,
  SPRING_BOUNCE,
  TRANSITION_ENTER_STANDARD,
  TRANSITION_EXIT_STANDARD,
} from "@/lib/ease";

/**
 * Displays ESP32 acknowledgement feedback using the shared ReUI Alert styling.
 * Toasts remain transient and can also be dismissed manually.
 */
export default function ToastNotification() {
  const toast = useIoTStore((s) => s.toast);
  const clearToast = useIoTStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;

    if (toast.type === "success") {
      soundManager.playSuccess();
    } else {
      soundManager.playError();
    }

    const timer = setTimeout(clearToast, 3500);

    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <AnimatePresence>
      {toast && (
        <m.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            x: toast.type === "error" ? [...ERROR_SHAKE_KEYFRAMES] : 0,
          }}
          exit={{
            opacity: 0,
            y: -10,
            scale: 0.96,
            transition: TRANSITION_EXIT_STANDARD,
          }}
          transition={{
            ...TRANSITION_ENTER_STANDARD,
            x:
              toast.type === "error"
                ? { duration: DURATION.slow, ease: EASE_IN_OUT }
                : TRANSITION_ENTER_STANDARD,
          }}
          className="pointer-events-auto fixed bottom-6 left-6 z-[200] w-[calc(100vw-3rem)] max-w-sm"
        >
          <Alert
            dir="rtl"
            variant={toast.type === "success" ? "success" : "destructive"}
            className="!grid !grid-cols-[auto_minmax(0,1fr)_auto] !items-start !gap-x-3 !gap-y-1 !px-4 !py-3.5 text-right shadow-lg"
          >
            <div className="!col-start-2 !row-start-1 min-w-0 text-right">
              <AlertTitle className="!col-start-1 !row-start-1 !m-0 !min-h-0 !line-clamp-none break-words text-right text-sm font-semibold leading-5">
                {toast.type === "success" ? "عملیات موفق" : "خطا در انجام عملیات"}
              </AlertTitle>
            </div>
            <div className="!col-start-2 !row-start-2 min-w-0 text-right">
              <AlertDescription className="!col-start-1 !row-start-2 !m-0 min-w-0 break-words whitespace-normal text-right text-xs leading-6">
                {toast.message}
              </AlertDescription>
            </div>
            <AnimatePresence initial={false} mode="popLayout">
              <m.span
                key={toast.type}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: TRANSITION_EXIT_STANDARD }}
                transition={{ ...SPRING_BOUNCE, delay: 0.05 }}
                className="!col-start-1 !row-start-1 !mt-0.5 inline-flex"
              >
                {toast.type === "success" ? (
                  <CheckCircle aria-hidden="true" strokeWidth={2} className="!size-5" />
                ) : (
                  <XCircle aria-hidden="true" strokeWidth={2} className="!size-5" />
                )}
              </m.span>
            </AnimatePresence>
            <AlertAction className="!col-start-3 !row-start-1 !mt-0 !self-start">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={clearToast}
                aria-label="بستن اعلان"
                className="text-muted-foreground"
              >
                <X aria-hidden="true" className="size-4" strokeWidth={2} />
              </Button>
            </AlertAction>
          </Alert>
        </m.div>
      )}
    </AnimatePresence>
  );
}
