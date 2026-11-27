"use client";

import { type ReactNode, useEffect } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { ToastProvider, useToast } from "./toast";

function StoreToastBridge() {
  const storeToast = useIoTStore((state) => state.toast);
  const clearToast = useIoTStore((state) => state.clearToast);
  const toast = useToast();

  useEffect(() => {
    if (!storeToast) return;

    toast.show({
      title: storeToast.message,
      tone: storeToast.type,
    });
    clearToast();
  }, [storeToast, clearToast, toast]);

  return null;
}

export function GlobalToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StoreToastBridge />
      {children}
    </ToastProvider>
  );
}
