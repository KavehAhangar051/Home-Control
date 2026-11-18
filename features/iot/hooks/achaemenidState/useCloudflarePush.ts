"use client";

import { useCallback, useEffect, useRef } from "react";
import type { IoTStoreState } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { buildEspConfig, persistStoreConfigToCloudflare } from "./core/buildEspConfig";
import { evaluateCloudflarePushTransition } from "./core/cloudflareSyncCoordinator";

const CONFIG_WATCHED_KEYS = [
  "isDark",
  "accent3",
  "accent4",
  "animationsEnabled",
  "animationsFps",
  "headerTitle",
  "selectedFont",
  "manualSaveMode",
  "segments",
  "groupsOrder",
  "groupConfigs",
  "groupsCols",
  "automations",
  "macros",
  "voiceCommands",
  "wifiNetworks",
  "wifiNetworksConfigured",
  "wifiApConfig",
  "mqttConfig",
] as const satisfies ReadonlyArray<keyof IoTStoreState>;

function hasWatchedConfigFieldsChanged(prev: IoTStoreState | null, next: IoTStoreState): boolean {
  if (!prev) return true;

  for (let i = 0; i < CONFIG_WATCHED_KEYS.length; i++) {
    const key = CONFIG_WATCHED_KEYS[i];

    if (prev[key] !== next[key]) {
      return true;
    }
  }

  return false;
}

export function useCloudflarePush(isFullyReady: boolean, remoteSyncEpoch = 0) {
  const lastSyncedSignatureRef = useRef<string | null>(null);
  const lastRemoteEpochRef = useRef(remoteSyncEpoch);

  const triggerCloudflarePush = useCallback(async () => {
    if (!isCloudflareEnabled() || !isFullyReady) return;

    const { result, signature } = await persistStoreConfigToCloudflare();

    if (result.success) {
      lastSyncedSignatureRef.current = signature;
    }
  }, [isFullyReady]);

  useEffect(() => {
    if (!isFullyReady) {
      lastSyncedSignatureRef.current = null;
      lastRemoteEpochRef.current = remoteSyncEpoch;

      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastObservedState: IoTStoreState | null = null;

    const evaluateState = (state: IoTStoreState, forceCheck: boolean) => {
      if (!forceCheck && !hasWatchedConfigFieldsChanged(lastObservedState, state)) {
        return;
      }

      lastObservedState = state;
      const configSignature = JSON.stringify(buildEspConfig(state));

      const decision = evaluateCloudflarePushTransition({
        isFullyReady,
        remoteSyncEpoch,
        lastRemoteEpoch: lastRemoteEpochRef.current,
        lastSyncedSignature: lastSyncedSignatureRef.current,
        configSignature,
      });

      if (decision === "reset") {
        lastSyncedSignatureRef.current = null;
        lastRemoteEpochRef.current = remoteSyncEpoch;

        return;
      }

      if (decision === "baseline") {
        lastRemoteEpochRef.current = remoteSyncEpoch;
        lastSyncedSignatureRef.current = configSignature;

        return;
      }

      if (decision === "noop") {
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        const latestState = useIoTStore.getState();

        if (latestState.manualSaveMode) {
          lastSyncedSignatureRef.current = configSignature;
          latestState.incrementUnsavedChanges();
        } else {
          void triggerCloudflarePush();
        }
      }, 1200);
    };

    evaluateState(useIoTStore.getState(), true);

    const unsubscribe = useIoTStore.subscribe((nextState) => {
      evaluateState(nextState, false);
    });

    return () => {
      unsubscribe();

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isFullyReady, remoteSyncEpoch, triggerCloudflarePush]);

  return { triggerCloudflarePush };
}
