"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { shallow } from "zustand/shallow";
import type { IoTStoreState } from "@/features/iot/hooks/store/types";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import { scheduleIdleTask } from "@/lib/asyncScheduler";
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
    let cancelIdleEvaluation: (() => void) | null = null;

    // Capture a lightweight config snapshot for baseline establishment without blocking
    // the boot/epoch commit frame with synchronous JSON.stringify.
    let pendingBaselineConfig: ReturnType<typeof buildEspConfig> | null =
      lastSyncedSignatureRef.current === null || lastRemoteEpochRef.current !== remoteSyncEpoch
        ? buildEspConfig(useIoTStore.getState())
        : null;

    const ensureBaselineSignature = () => {
      if (!pendingBaselineConfig) return;

      const baselineSignature = JSON.stringify(pendingBaselineConfig);
      pendingBaselineConfig = null;

      const decision = evaluateCloudflarePushTransition({
        isFullyReady,
        remoteSyncEpoch,
        lastRemoteEpoch: lastRemoteEpochRef.current,
        lastSyncedSignature: lastSyncedSignatureRef.current,
        configSignature: baselineSignature,
      });

      if (decision === "baseline") {
        lastRemoteEpochRef.current = remoteSyncEpoch;
        lastSyncedSignatureRef.current = baselineSignature;
      } else if (decision === "reset") {
        lastSyncedSignatureRef.current = null;
        lastRemoteEpochRef.current = remoteSyncEpoch;
      }
    };

    const cancelBaselineIdle = pendingBaselineConfig
      ? scheduleIdleTask(ensureBaselineSignature, 1000)
      : null;

    const scheduleDebouncedEvaluation = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      if (cancelIdleEvaluation) {
        cancelIdleEvaluation();
        cancelIdleEvaluation = null;
      }

      debounceTimer = setTimeout(() => {
        debounceTimer = null;

        cancelIdleEvaluation = scheduleIdleTask(() => {
          cancelIdleEvaluation = null;
          ensureBaselineSignature();

          const configSignature = JSON.stringify(buildEspConfig(useIoTStore.getState()));

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

          if (decision === "schedule") {
            onFlushDebouncedPush(configSignature);
          }
        }, 800);
      }, 1200);
    };

    const unsubscribe = useIoTStore.subscribe(
      selectWatchedConfigSlice,
      scheduleDebouncedEvaluation,
      { equalityFn: shallow },
    );

    return () => {
      unsubscribe();
      cancelBaselineIdle?.();

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      if (cancelIdleEvaluation) {
        cancelIdleEvaluation();
      }
    };
  }, [isFullyReady, remoteSyncEpoch]);

  return { triggerCloudflarePush };
}
