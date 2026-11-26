"use client";

import { useEffect } from "react";
import { ToastProvider, useToast } from "@/components/dissolve/toast";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { soundManager } from "@/lib/audio";
import { triggerHaptic } from "@/lib/haptics";

function LegacyToastBridge() {
  const toast = useToast();

  useEffect(() => {
    const showLegacyToast = (item: { message: string; type: "success" | "error" }) => {
      toast.show({
        title: item.message,
        tone: item.type,
        duration: item.type === "success" ? 2200 : 3600,
      });

      if (item.type === "success") {
        soundManager.playSuccess();
        triggerHaptic("success");
      } else {
        soundManager.playError();
        triggerHaptic("error");
      }

      useIoTStore.getState().clearToast();
    };

    const current = useIoTStore.getState().toast;
    if (current) showLegacyToast(current);

    return useIoTStore.subscribe((state, previousState) => {
      if (state.toast && state.toast !== previousState.toast) {
        showLegacyToast(state.toast);
      }
    });
  }, [toast]);

  return null;
}

export function GlobalToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider
      top={8}
      max={3}
      className="!z-[200]"
      cardClassName="border border-[var(--border-color)] shadow-lg"
    >
      <LegacyToastBridge />
      {children}
    </ToastProvider>
  );
}
