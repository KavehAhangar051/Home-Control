"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { soundManager } from "@/lib/audio";
import {
  DURATION,
  EASE_IN_OUT,
  ERROR_SHAKE_KEYFRAMES,
  TRANSITION_ENTER_STANDARD,
  TRANSITION_EXIT_STANDARD,
} from "@/lib/ease";

const SUCCESS_DISMISS_MS = 2200;
const ERROR_DISMISS_MS = 3600;

/**
 * Compact, non-blocking top-center status toast.
 * Anchored in the header band with a pointer-events-none outer wrapper so segment cards,
 * toolbar buttons, and mobile navigation remain clickable at all times.
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

    const durationMs = toast.type === "success" ? SUCCESS_DISMISS_MS : ERROR_DISMISS_MS;
    const timer = setTimeout(clearToast, durationMs);

    return () => clearTimeout(timer);
  }, [toast, clearToast]);

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
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: isError ? [...ERROR_SHAKE_KEYFRAMES] : 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
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
            className={`pointer-events-auto inline-flex max-w-[min(22rem,calc(100vw-1.5rem))] cursor-pointer items-center gap-2 rounded-full border bg-sidebar-bg py-1.5 ps-3 pe-2 text-right shadow-lg transition-colors ${
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
              <CheckCircle2
                aria-hidden="true"
                strokeWidth={2}
                className="size-4 shrink-0 text-success"
              />
            )}

            <span className="min-w-0 truncate text-xs font-medium leading-5 text-text-primary">
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
