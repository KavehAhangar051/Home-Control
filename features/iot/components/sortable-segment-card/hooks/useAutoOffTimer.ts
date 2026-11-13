import { useEffect, useState } from "react";

interface UseAutoOffTimerProps {
  isPinOn: boolean;
  autoOff: number | undefined;
  mode: "switch" | "push";
  pin: string;
  onSetPinState?: (pin: string, state: boolean, force?: boolean) => void;
}

export function useAutoOffTimer({
  isPinOn,
  autoOff,
  mode,
  pin,
  onSetPinState,
}: UseAutoOffTimerProps) {
  const isTimerActive = Boolean(isPinOn && autoOff && autoOff > 0);
  const triggerKey = isTimerActive ? `${pin}:${autoOff}:on` : `${pin}:off`;

  const [timerState, setTimerState] = useState<{ key: string; remaining: number | null }>({
    key: "",
    remaining: null,
  });

  const countdown =
    timerState.key === triggerKey ? timerState.remaining : isTimerActive ? (autoOff ?? null) : null;

  useEffect(() => {
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
  }, [countdown, triggerKey, pin, onSetPinState, mode]);

  return { countdown };
}
