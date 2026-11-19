import { useEffect, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";

interface UseAutoOffTimerProps {
  isPinOn: boolean;
  autoOff: number | undefined;
  mode: "switch" | "push";
  pin: string;
  onSetPinState?: (pin: string, state: boolean, preventMqtt?: boolean) => void;
}

export function useAutoOffTimer({
  isPinOn,
  autoOff,
  mode,
  pin,
  onSetPinState,
}: UseAutoOffTimerProps) {
  const synchronizedTimer = useIoTStore((state) => state.autoOffRemaining[pin]);
  const initialRemaining = synchronizedTimer !== undefined ? synchronizedTimer : autoOff;
  const isTimerActive = Boolean(isPinOn && initialRemaining && initialRemaining > 0);
  const triggerKey = isTimerActive ? `${pin}:${autoOff}:${initialRemaining}:on` : `${pin}:off`;

  const [timerState, setTimerState] = useState<{ key: string; remaining: number | null }>({
    key: `${pin}:off`,
    remaining: null,
  });

  const countdown =
    timerState.key === triggerKey
      ? timerState.remaining
      : isTimerActive
        ? (initialRemaining ?? null)
        : null;

  const isResetState = timerState.key === `${pin}:off` && timerState.remaining === null;

  useEffect(() => {
    if (!isTimerActive) {
      if (isResetState) {
        return;
      }

      const resetId = setTimeout(() => {
        setTimerState((prev) =>
          prev.key === `${pin}:off` && prev.remaining === null
            ? prev
            : { key: `${pin}:off`, remaining: null },
        );
      }, 0);

      return () => clearTimeout(resetId);
    }

    if (countdown === null) return;

    const timerId = setTimeout(() => {
      if (countdown <= 1) {
        if (mode === "switch" || mode === "push") {
          onSetPinState?.(pin, false, true);
        }

        setTimerState({ key: triggerKey, remaining: null });

        return;
      }

      setTimerState({ key: triggerKey, remaining: countdown - 1 });
    }, 1000);

    return () => clearTimeout(timerId);
  }, [isTimerActive, isResetState, countdown, triggerKey, pin, onSetPinState, mode]);

  return { countdown };
}
