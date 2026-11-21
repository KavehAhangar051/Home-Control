"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { debugLog } from "@/lib/debug";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

let cachedDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  for (const listener of promptListeners) {
    listener();
  }
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

/**
 * SSR-safe reactive online/offline network status hook.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
}

/**
 * Registers the static Service Worker (`./sw.js`) in production builds
 * and captures `beforeinstallprompt` globally even before Settings is opened.
 */
export function useServiceWorkerRegistration(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      cachedDeferredPrompt = event as BeforeInstallPromptEvent;
      notifyPromptListeners();
    };

    const handleAppInstalled = () => {
      cachedDeferredPrompt = null;
      notifyPromptListeners();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    let registrationTimer: number | null = null;

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      const registerSw = () => {
        navigator.serviceWorker
          .register("./sw.js", { scope: "./" })
          .then((registration) => {
            debugLog.info("PWA", "Service Worker registered.", { scope: registration.scope });
          })
          .catch((error) => {
            debugLog.warn("PWA", "Service Worker registration skipped or failed.", error);
          });
      };

      if (document.readyState === "complete") {
        registrationTimer = window.setTimeout(registerSw, 1200);
      } else {
        window.addEventListener("load", registerSw, { once: true });
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);

      if (registrationTimer !== null) {
        window.clearTimeout(registrationTimer);
      }
    };
  }, []);
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;

  const nav = navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    nav.standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return isAppleMobile || isIpadOS;
}

export interface PWAInstallState {
  isStandalone: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

/**
 * Exposes PWA installation capability, standalone status, iOS Safari fallback detection,
 * and one-click native install prompt trigger.
 */
export function usePWAInstall(): PWAInstallState {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => cachedDeferredPrompt,
  );

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setIsIOS(detectIOS());
    setDeferredPrompt(cachedDeferredPrompt);

    const syncPrompt = () => {
      setDeferredPrompt(cachedDeferredPrompt);
      setIsStandalone(detectStandalone());
    };

    promptListeners.add(syncPrompt);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => setIsStandalone(detectStandalone());
    mediaQuery.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      promptListeners.delete(syncPrompt);
      mediaQuery.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const promptEvent = deferredPrompt ?? cachedDeferredPrompt;

    if (!promptEvent) return "unavailable";

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    if (outcome === "accepted") {
      cachedDeferredPrompt = null;
      setDeferredPrompt(null);
      notifyPromptListeners();
    }

    return outcome;
  }, [deferredPrompt]);

  return {
    isStandalone,
    isInstallable: !isStandalone && deferredPrompt !== null,
    isIOS,
    install,
  };
}
