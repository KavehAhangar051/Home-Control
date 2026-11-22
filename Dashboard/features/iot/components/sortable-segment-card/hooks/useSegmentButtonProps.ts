import type React from "react";
import { useEffect, useRef } from "react";
import { triggerHaptic } from "@/lib/haptics";

interface UseSegmentButtonPropsParams {
  mode: "switch" | "push";
  pin: string;
  isPinOn?: boolean;
  onTogglePin: (pin: string) => void;
  onSetPinState?: (pin: string, state: boolean) => void;
}

interface TouchGestureTracker {
  pointerId: number;
  startX: number;
  startY: number;
  cancelled: boolean;
  cleanupListeners: () => void;
}

const TOUCH_MOVE_CANCEL_THRESHOLD_PX = 10;
const TOUCH_PUSH_HOLD_DELAY_MS = 115;
const TOUCH_PUSH_PULSE_MS = 140;

export default function useSegmentButtonProps({
  mode,
  pin,
  isPinOn = false,
  onTogglePin,
  onSetPinState,
}: UseSegmentButtonPropsParams) {
  const isPressedRef = useRef(false);
  const touchStateRef = useRef<TouchGestureTracker | null>(null);
  const pushHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTouchHoldTimer = () => {
    if (pushHoldTimerRef.current !== null) {
      clearTimeout(pushHoldTimerRef.current);
      pushHoldTimerRef.current = null;
    }
  };

  const clearTouchClearTimer = () => {
    if (touchClearTimerRef.current !== null) {
      clearTimeout(touchClearTimerRef.current);
      touchClearTimerRef.current = null;
    }
  };

  const beginTouchGestureTracking = (
    pointerId: number,
    startX: number,
    startY: number,
    onCancelCallback?: () => void,
  ): TouchGestureTracker => {
    touchStateRef.current?.cleanupListeners();
    clearTouchClearTimer();

    const tracker: TouchGestureTracker = {
      pointerId,
      startX,
      startY,
      cancelled: false,
      cleanupListeners: () => {},
    };

    const handleWindowMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== tracker.pointerId || tracker.cancelled) return;

      if (
        Math.hypot(moveEvent.clientX - tracker.startX, moveEvent.clientY - tracker.startY) >=
        TOUCH_MOVE_CANCEL_THRESHOLD_PX
      ) {
        tracker.cancelled = true;
        tracker.cleanupListeners();
        onCancelCallback?.();
      }
    };

    const handleMultiTouchDown = (downEvent: PointerEvent) => {
      if (downEvent.pointerType === "touch" && downEvent.pointerId !== tracker.pointerId) {
        tracker.cancelled = true;
        tracker.cleanupListeners();
        onCancelCallback?.();
      }
    };

    const handleWindowCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== tracker.pointerId) return;
      tracker.cancelled = true;
      tracker.cleanupListeners();
      onCancelCallback?.();
    };

    const handleWindowUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== tracker.pointerId) return;
      tracker.cleanupListeners();
      clearTouchClearTimer();
      // Preserve cancelled flag long enough for synchronous click handler, then reset
      touchClearTimerRef.current = setTimeout(() => {
        if (touchStateRef.current === tracker) {
          touchStateRef.current = null;
        }
      }, 60);
    };

    tracker.cleanupListeners = () => {
      window.removeEventListener("pointermove", handleWindowMove);
      window.removeEventListener("pointerdown", handleMultiTouchDown, true);
      window.removeEventListener("pointercancel", handleWindowCancel);
      window.removeEventListener("pointerup", handleWindowUp);
      window.removeEventListener("blur", handleBlurAbort);
    };

    const handleBlurAbort = () => {
      tracker.cancelled = true;
      tracker.cleanupListeners();
      onCancelCallback?.();
    };

    window.addEventListener("pointermove", handleWindowMove);
    window.addEventListener("pointerdown", handleMultiTouchDown, true);
    window.addEventListener("pointercancel", handleWindowCancel);
    window.addEventListener("pointerup", handleWindowUp);
    window.addEventListener("blur", handleBlurAbort);

    touchStateRef.current = tracker;
    return tracker;
  };

  useEffect(() => {
    return () => {
      touchStateRef.current?.cleanupListeners();
      touchStateRef.current = null;
      if (pushHoldTimerRef.current !== null) {
        clearTimeout(pushHoldTimerRef.current);
        pushHoldTimerRef.current = null;
      }
      if (pushPulseTimerRef.current !== null) {
        clearTimeout(pushPulseTimerRef.current);
        pushPulseTimerRef.current = null;
      }
      if (touchClearTimerRef.current !== null) {
        clearTimeout(touchClearTimerRef.current);
        touchClearTimerRef.current = null;
      }
    };
  }, []);

  if (mode === "push") {
    const releasePushPin = (e: React.PointerEvent<HTMLButtonElement>, withHaptic = true) => {
      if (e.button === 2) return;

      if (e.pointerType !== "touch") {
        e.stopPropagation();
      }

      clearTouchHoldTimer();

      if (!isPressedRef.current) return;

      isPressedRef.current = false;
      if (withHaptic) triggerHaptic("tap");
      onSetPinState?.(pin, false);
    };

    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button === 2) return;

        if (e.pointerType === "touch") {
          clearTouchHoldTimer();
          const tracker = beginTouchGestureTracking(e.pointerId, e.clientX, e.clientY, () => {
            clearTouchHoldTimer();
            if (isPressedRef.current) {
              isPressedRef.current = false;
              onSetPinState?.(pin, false);
            }
          });

          pushHoldTimerRef.current = setTimeout(() => {
            pushHoldTimerRef.current = null;
            if (touchStateRef.current !== tracker || tracker.cancelled) return;
            isPressedRef.current = true;
            triggerHaptic("push");
            onSetPinState?.(pin, true);
          }, TOUCH_PUSH_HOLD_DELAY_MS);
          return;
        }

        e.stopPropagation();
        isPressedRef.current = true;
        triggerHaptic("push");
        onSetPinState?.(pin, true);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => releasePushPin(e, true),
      onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.pointerType === "touch") return;
        releasePushPin(e, true);
      },
      onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (touchStateRef.current?.pointerId === e.pointerId) {
          touchStateRef.current.cancelled = true;
          touchStateRef.current.cleanupListeners();
        }
        releasePushPin(e, false);
      },
      onClick: (e?: React.MouseEvent<HTMLButtonElement>) => {
        const tracker = touchStateRef.current;
        clearTouchClearTimer();
        touchStateRef.current = null;

        if (!tracker || e?.defaultPrevented || tracker.cancelled) {
          e?.stopPropagation();
          return;
        }

        // Clean momentary pulse when a touch tap completes before hold delay
        e?.stopPropagation();
        if (pushPulseTimerRef.current !== null) {
          clearTimeout(pushPulseTimerRef.current);
          pushPulseTimerRef.current = null;
        }
        triggerHaptic("push");
        onSetPinState?.(pin, true);
        pushPulseTimerRef.current = setTimeout(() => {
          pushPulseTimerRef.current = null;
          triggerHaptic("tap");
          onSetPinState?.(pin, false);
        }, TOUCH_PUSH_PULSE_MS);
      },
    };
  }

  return {
    onClick: (e?: React.MouseEvent<HTMLButtonElement>) => {
      const cancelled = touchStateRef.current?.cancelled === true;
      clearTouchClearTimer();
      touchStateRef.current = null;

      if (e?.defaultPrevented || cancelled) return;

      e?.stopPropagation();
      triggerHaptic(isPinOn ? "toggleOff" : "toggleOn");
      onTogglePin(pin);
    },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button === 2) return;

      if (e.pointerType === "touch") {
        beginTouchGestureTracking(e.pointerId, e.clientX, e.clientY);
        return;
      }

      e.stopPropagation();
    },
  };
}
