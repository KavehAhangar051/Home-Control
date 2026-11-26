"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  fetchConfigFromCloudflare,
  getCloudflareWorkerUrl,
  isCloudflareEnabled,
  setCloudflareWorkerUrl,
} from "@/features/iot/services/cloudflareService";
import type { EspConfig } from "@/features/iot/services/esp32Config";
import { cancelIdleStorageWrite } from "@/lib/asyncScheduler";
import { debugLog } from "@/lib/debug";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

import { executeBypassFallback, executeCloudflareInitSync } from "./core/cloudflareSyncCoordinator";

interface UseCloudflareInitProps {
  mounted: boolean;
  handleApplyEspConfig: (config: EspConfig) => void;
}

export function useCloudflareInit({ handleApplyEspConfig }: UseCloudflareInitProps) {
  const setSegments = useIoTStore((state) => state.setSegments);
  const setGroupsOrder = useIoTStore((state) => state.setGroupsOrder);
  const setGroupConfigs = useIoTStore((state) => state.setGroupConfigs);
  const setSyncStatus = useIoTStore((state) => state.setSyncStatus);
  const [isFullyReady, setIsFullyReady] = useState(false);
  const [remoteSyncEpoch, setRemoteSyncEpoch] = useState(0);
  const [workerUrl, setWorkerUrlState] = useState(() => getCloudflareWorkerUrl());
  const bypassedRef = useRef(false);

  const handleWorkerUrlChange = useCallback((url: string) => {
    setWorkerUrlState(url);
    setCloudflareWorkerUrl(url);
  }, []);

  const readLocalCache = useCallback((): EspConfig | null => {
    if (globalThis.window === undefined) return null;

    try {
      const cached = localStorage.getItem("cached_esp_config");

      if (!cached) return null;

      // SAFETY: cached_esp_config holds serialized EspConfig structure
      return JSON.parse(cached) as EspConfig;
    } catch (error) {
      debugLog.error("ConfigSync", "Could not read optional configuration cache.", error);

      return null;
    }
  }, []);

  const resetEmptyState = useCallback(() => {
    setSegments([]);
    setGroupsOrder([]);
    setGroupConfigs({});
  }, [setGroupConfigs, setGroupsOrder, setSegments]);

  const bumpRemoteEpoch = useCallback(() => {
    setRemoteSyncEpoch((prev) => prev + 1);
  }, []);

  const markReady = useCallback(() => {
    setIsFullyReady(true);
  }, []);

  const handleBypassSync = useCallback(() => {
    bypassedRef.current = true;
    executeBypassFallback({
      configLocalCacheEnabled: FEATURE_FLAGS.configLocalCache,
      readLocalCache,
      applyConfig: handleApplyEspConfig,
      onResetEmptyState: resetEmptyState,
      onBumpRemoteEpoch: bumpRemoteEpoch,
      onSyncStatus: setSyncStatus,
      onReady: markReady,
      warn: debugLog.warn,
    });
  }, [
    bumpRemoteEpoch,
    handleApplyEspConfig,
    markReady,
    readLocalCache,
    resetEmptyState,
    setSyncStatus,
  ]);

  const initCloudflareSync = useCallback(async () => {
    bypassedRef.current = false;

    await executeCloudflareInitSync({
      configLocalCacheEnabled: FEATURE_FLAGS.configLocalCache,
      isCloudflareEnabled,
      isOnline: () => globalThis.navigator?.onLine !== false,
      isBypassed: () => bypassedRef.current,
      fetchConfig: (timeoutMs) => fetchConfigFromCloudflare({ timeoutMs, retryAttempts: 1 }),
      readLocalCache,
      writeLocalCache: (cfConfig) => {
        if (globalThis.window === undefined) return;

        scheduleIdleStorageWrite("cached_esp_config", () => JSON.stringify(cfConfig), {
          onError: (error) => {
            debugLog.error("ConfigSync", "Could not write optional configuration cache.", error);
          },
        });
      },
      clearLocalCache: () => {
        if (globalThis.window === undefined) return;

        cancelIdleStorageWrite("cached_esp_config");

        try {
          localStorage.removeItem("cached_esp_config");
        } catch (error) {
          debugLog.warn("ConfigSync", "Could not clear the legacy configuration cache.", error);
        }
      },
      applyConfig: handleApplyEspConfig,
      onWorkerUrlChange: handleWorkerUrlChange,
      onResetEmptyState: resetEmptyState,
      onSyncStatus: setSyncStatus,
      onBumpRemoteEpoch: bumpRemoteEpoch,
      onReady: markReady,
      warn: debugLog.warn,
      info: debugLog.info,
    });
  }, [
    bumpRemoteEpoch,
    handleApplyEspConfig,
    handleWorkerUrlChange,
    markReady,
    readLocalCache,
    resetEmptyState,
    setSyncStatus,
  ]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (!cancelled) {
          return initCloudflareSync();
        }
      })
      .catch((error) => {
        debugLog.error("ConfigSync", "Unexpected initialization failure; falling back.", error);

        if (!cancelled) {
          handleBypassSync();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handleBypassSync, initCloudflareSync]);

  return {
    isFullyReady,
    setIsFullyReady,
    remoteSyncEpoch,
    handleBypassSync,
    workerUrl,
    setWorkerUrl: handleWorkerUrlChange,
    handleRetrySync: initCloudflareSync,
  };
}
