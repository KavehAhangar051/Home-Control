"use client";

import { useEffect } from "react";
import {
  DISPLAY_MODE_STORAGE_KEY,
  readSavedDisplayMode,
} from "@/features/iot/hooks/store/slices/createUiSlice";
import type { WorkspaceDisplayMode } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  PREFERENCES_STORAGE_KEY,
  usePreferencesStore,
} from "@/features/iot/hooks/usePreferencesStore";
import {
  applyDashboardFontToDocument,
  type DashboardFontId,
  resolveDashboardFontId,
} from "@/lib/fonts";

const CHANNEL_NAME = "home-control-dashboard-sync-v1";

interface SyncedUiPayload {
  isDark: boolean;
  accent3: string;
  accent4: string;
  darkBlackness: number;
  lightWhiteness: number;
  selectedFont: DashboardFontId;
  animationsEnabled: boolean;
  animationsFps: number;
  lowDataMode: boolean;
  workspaceDisplayMode: WorkspaceDisplayMode;
}

interface CrossTabSyncMessage {
  type: "ui-state-sync";
  senderId: string;
  payload: SyncedUiPayload;
}

function selectSyncedUiPayload(): SyncedUiPayload {
  const s = useIoTStore.getState();

  return {
    isDark: s.isDark,
    accent3: s.accent3,
    accent4: s.accent4,
    darkBlackness: s.darkBlackness,
    lightWhiteness: s.lightWhiteness,
    selectedFont: s.selectedFont,
    animationsEnabled: s.animationsEnabled,
    animationsFps: s.animationsFps,
    lowDataMode: s.lowDataMode,
    workspaceDisplayMode: s.workspaceDisplayMode,
  };
}

function payloadsEqual(a: SyncedUiPayload, b: SyncedUiPayload): boolean {
  return (
    a.isDark === b.isDark &&
    a.accent3 === b.accent3 &&
    a.accent4 === b.accent4 &&
    a.darkBlackness === b.darkBlackness &&
    a.lightWhiteness === b.lightWhiteness &&
    a.selectedFont === b.selectedFont &&
    a.animationsEnabled === b.animationsEnabled &&
    a.animationsFps === b.animationsFps &&
    a.lowDataMode === b.lowDataMode &&
    a.workspaceDisplayMode === b.workspaceDisplayMode
  );
}

/**
 * Synchronizes visual theme, accent colors, font, display mode, and persisted UX preferences
 * live across open browser tabs via `BroadcastChannel` + `storage` events with strict loop guards.
 * Also restores the persisted `workspaceDisplayMode` post-mount to preserve SSR hydration parity.
 */
export function useCrossTabSync(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Post-mount restoration guarantees zero SSR/hydration mismatch on initial render
    const savedMode = readSavedDisplayMode();

    if (useIoTStore.getState().workspaceDisplayMode !== savedMode) {
      useIoTStore.setState({ workspaceDisplayMode: savedMode });
    }

    const tabId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let isApplyingRemote = false;
    let lastBroadcasted = selectSyncedUiPayload();
    let channel: BroadcastChannel | null = null;

    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<CrossTabSyncMessage>) => {
          const data = event.data;

          if (data?.type !== "ui-state-sync" || data.senderId === tabId) return;

          const incoming = data.payload;

          if (!incoming || payloadsEqual(incoming, selectSyncedUiPayload())) return;

          isApplyingRemote = true;
          try {
            const resolvedFont = resolveDashboardFontId(incoming.selectedFont);
            applyDashboardFontToDocument(resolvedFont);
            useIoTStore.setState({
              isDark: incoming.isDark,
              accent3: incoming.accent3,
              accent4: incoming.accent4,
              darkBlackness: incoming.darkBlackness,
              lightWhiteness: incoming.lightWhiteness,
              selectedFont: resolvedFont,
              animationsEnabled: incoming.animationsEnabled,
              animationsFps: incoming.animationsFps,
              lowDataMode: incoming.lowDataMode,
              workspaceDisplayMode: incoming.workspaceDisplayMode,
            });
            lastBroadcasted = selectSyncedUiPayload();
          } finally {
            isApplyingRemote = false;
          }
        };
      } catch {
        channel = null;
      }
    }

    const unsubscribeStore = useIoTStore.subscribe(() => {
      if (isApplyingRemote || !channel) return;

      const current = selectSyncedUiPayload();

      if (payloadsEqual(current, lastBroadcasted)) return;

      lastBroadcasted = current;

      try {
        const message: CrossTabSyncMessage = {
          type: "ui-state-sync",
          senderId: tabId,
          payload: current,
        };
        channel.postMessage(message);
      } catch {
        // Ignore closed channel or serialization edge cases
      }
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PREFERENCES_STORAGE_KEY) {
        void usePreferencesStore.persist.rehydrate();
      } else if (event.key === DISPLAY_MODE_STORAGE_KEY) {
        const nextMode = readSavedDisplayMode();

        if (useIoTStore.getState().workspaceDisplayMode !== nextMode) {
          isApplyingRemote = true;
          try {
            useIoTStore.setState({ workspaceDisplayMode: nextMode });
            lastBroadcasted = selectSyncedUiPayload();
          } finally {
            isApplyingRemote = false;
          }
        }
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      unsubscribeStore();
      window.removeEventListener("storage", handleStorage);

      if (channel) {
        try {
          channel.close();
        } catch {
          // Ignore close errors
        }
      }
    };
  }, []);
}
