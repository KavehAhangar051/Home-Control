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

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const isVisible = !document.hidden;
        syncDocumentPageHidden(isVisible);
        setIsPageVisible(isVisible);

        if (isVisible) {
          notifyMqttResume();
        }
      }
    };

    const handlePageHide = () => {
      syncDocumentPageHidden(false);
      setIsPageVisible(false);
      publishPresence(false);
    };

    const handleResume = () => {
      if (!document.hidden) {
        syncDocumentPageHidden(true);
        setIsPageVisible(true);
        notifyMqttResume();
      }
    };

    const initialVisible = !document.hidden;
    syncDocumentPageHidden(initialVisible);
    setIsPageVisible(initialVisible);

    document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });
    document.addEventListener("resume", handleResume, { passive: true });
    window.addEventListener("online", handleOnline, { passive: true });
    window.addEventListener("pageshow", handlePageShow, { passive: true });
    window.addEventListener("pagehide", handlePageHide, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("resume", handleResume);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [setIsPageVisible]);
}
