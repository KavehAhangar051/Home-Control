"use client";

import { useEffect } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { notifyMqttResume, publishPresence } from "@/features/iot/services/mqttService";

const syncDocumentPageHidden = (isVisible: boolean) => {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.pageHidden = isVisible ? "false" : "true";
  }
};

export function usePageVisibility() {
  const setIsPageVisible = useIoTStore((state) => state.setIsPageVisible);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      syncDocumentPageHidden(isVisible);
      setIsPageVisible(isVisible);

      if (isVisible) {
        notifyMqttResume();
      } else {
        publishPresence(false);
      }
    };

    const handleOnline = () => {
      if (!document.hidden) {
        notifyMqttResume();
      }
    };

    const initialVisible = !document.hidden;
    syncDocumentPageHidden(initialVisible);
    setIsPageVisible(initialVisible);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [setIsPageVisible]);
}
