"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { shallow } from "zustand/shallow";
import type { IoTStoreState } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { buildEspConfig, persistStoreConfigToCloudflare } from "./core/buildEspConfig";
import { evaluateCloudflarePushTransition } from "./core/cloudflareSyncCoordinator";

/**
 * Projects only the ESP32/Cloudflare-persisted fields from `useIoTStore`.
 * Combined with Zustand 5 `subscribeWithSelector` + `shallow`, transient UI/pin updates
 * never wake the Cloudflare config serializer.
 */
function selectWatchedConfigSlice(state: IoTStoreState) {
  return {
    isDark: state.isDark,
    accent3: state.accent3,
    accent4: state.accent4,
    animationsEnabled: state.animationsEnabled,
    animationsFps: state.animationsFps,
    headerTitle: state.headerTitle,
    selectedFont: state.selectedFont,
    manualSaveMode: state.manualSaveMode,
    segments: state.segments,
    groupsOrder: state.groupsOrder,
    groupConfigs: state.groupConfigs,
    groupsCols: state.groupsCols,
    automations: state.automations,
    macros: state.macros,
    voiceCommands: state.voiceCommands,
    wifiNetworks: state.wifiNetworks,
    wifiNetworksConfigured: state.wifiNetworksConfigured,
    wifiApConfig: state.wifiApConfig,
    mqttConfig: state.mqttConfig,
  };
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

  const onFlushDebouncedPush = useEffectEvent((configSignature: string) => {
    const latestState = useIoTStore.getState();

    if (latestState.manualSaveMode) {
      lastSyncedSignatureRef.current = configSignature;
      latestState.incrementUnsavedChanges();
    } else {
      void triggerCloudflarePush();
    }
  });

  useEffect(() => {
    if (!isFullyReady) {
      lastSyncedSignatureRef.current = null;
      lastRemoteEpochRef.current = remoteSyncEpoch;

      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const evaluateState = (state: IoTStoreState) => {
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
        onFlushDebouncedPush(configSignature);
      }, 1200);
    };

    evaluateState(useIoTStore.getState());

    const unsubscribe = useIoTStore.subscribe(
      selectWatchedConfigSlice,
      () => {
        evaluateState(useIoTStore.getState());
      },
      { equalityFn: shallow },
    );

    return () => {
      unsubscribe();

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isFullyReady, remoteSyncEpoch]);

  return { triggerCloudflarePush };
}
