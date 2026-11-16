import type React from "react";
import { useRef } from "react";

interface UseSegmentButtonPropsParams {
  mode: "switch" | "push";
  pin: string;
  onTogglePin: (pin: string) => void;
  onSetPinState?: (pin: string, state: boolean) => void;
}

export default function useSegmentButtonProps({
  mode,
  pin,
  onTogglePin,
  onSetPinState,
}: UseSegmentButtonPropsParams) {
  const isPressedRef = useRef(false);

  if (mode === "push") {
    const releasePushPin = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button === 2) return;

      e.stopPropagation();

      if (!isPressedRef.current) return;

      isPressedRef.current = false;
      onSetPinState?.(pin, false);
    };

    return {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button === 2) return;

        e.stopPropagation();
        isPressedRef.current = true;
        onSetPinState?.(pin, true);
      },
      onPointerUp: releasePushPin,
      onPointerLeave: releasePushPin,
      onPointerCancel: releasePushPin,
    };
  }

  return {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onTogglePin(pin);
    },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button === 2) return;

      e.stopPropagation();
    },
  };
}
