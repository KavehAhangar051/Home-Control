"use client";

import { useEffect, useState } from "react";
import { subscribePinCommandAck } from "@/features/iot/services/pinAckBus";

export const ACK_INDICATOR_DURATION_MS = 700;

/**
 * Listens for hardware `command_ack` pulses for a single GPIO pin and returns
 * a transient boolean flag without triggering state store updates or rollback.
 */
export function usePinCommandAck(pin: string): boolean {
  const [ackReceived, setAckReceived] = useState(false);

  useEffect(() => {
    setAckReceived(false);

    if (!pin) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = subscribePinCommandAck(pin, () => {
      setAckReceived(true);

      if (timer !== null) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = null;
        setAckReceived(false);
      }, ACK_INDICATOR_DURATION_MS);
    });

    return () => {
      unsubscribe();

      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [pin]);

  return ackReceived;
}
