"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  isCloudflareEnabled,
  saveConfigToCloudflare,
} from "@/features/iot/services/cloudflareService";
import { buildEspConfig } from "./core/buildEspConfig";

export function useCloudflarePush(isFullyReady: boolean) {
  const isDark = useIoTStore((s) => s.isDark);
  const accent3 = useIoTStore((s) => s.accent3);
  const accent4 = useIoTStore((s) => s.accent4);
  const animationsEnabled = useIoTStore((s) => s.animationsEnabled);
  const animationsFps = useIoTStore((s) => s.animationsFps);
  const headerTitle = useIoTStore((s) => s.headerTitle);
  const selectedFont = useIoTStore((s) => s.selectedFont);
  const manualSaveMode = useIoTStore((s) => s.manualSaveMode);
  const segments = useIoTStore((s) => s.segments);
  const groupsOrder = useIoTStore((s) => s.groupsOrder);
  const groupConfigs = useIoTStore((s) => s.groupConfigs);
  const groupsCols = useIoTStore((s) => s.groupsCols);
  const automations = useIoTStore((s) => s.automations);
  const macros = useIoTStore((s) => s.macros);
  const voiceCommands = useIoTStore((s) => s.voiceCommands);
  const wifiNetworks = useIoTStore((s) => s.wifiNetworks);
  const wifiNetworksConfigured = useIoTStore((s) => s.wifiNetworksConfigured);
  const wifiApConfig = useIoTStore((s) => s.wifiApConfig);
  const mqttConfig = useIoTStore((s) => s.mqttConfig);

  const lastSyncedSignatureRef = useRef<string | null>(null);

  const currentConfig = useMemo(
    () =>
      buildEspConfig({
        isDark,
        accent3,
        accent4,
        animationsEnabled,
        animationsFps,
        headerTitle,
        selectedFont,
        manualSaveMode,
        segments,
        groupsOrder,
        groupConfigs,
        groupsCols,
        automations,
        macros,
        voiceCommands,
        wifiNetworks,
        wifiNetworksConfigured,
        wifiApConfig,
        mqttConfig,
      }),
    [
      isDark,
      accent3,
      accent4,
      animationsEnabled,
      animationsFps,
      headerTitle,
      selectedFont,
      manualSaveMode,
      segments,
      groupsOrder,
      groupConfigs,
      groupsCols,
      automations,
      macros,
      voiceCommands,
      wifiNetworks,
      wifiNetworksConfigured,
      wifiApConfig,
      mqttConfig,
    ],
  );

  const configSignature = useMemo(() => JSON.stringify(currentConfig), [currentConfig]);

  const triggerCloudflarePush = useCallback(async () => {
    if (!isCloudflareEnabled() || !isFullyReady) return;

    const latestState = useIoTStore.getState();
    const snapshotToSave = buildEspConfig(latestState);
    const signatureToSave = JSON.stringify(snapshotToSave);

    const result = await saveConfigToCloudflare(snapshotToSave);

    if (result.success) {
      lastSyncedSignatureRef.current = signatureToSave;
      latestState.showToast(result.message, "success");
      latestState.resetUnsavedChanges();
    } else {
      latestState.showToast(result.message, "error");
    }
  }, [isFullyReady]);

  useEffect(() => {
    if (!isFullyReady) {
      lastSyncedSignatureRef.current = null;

      return;
    }

    if (lastSyncedSignatureRef.current === null) {
      lastSyncedSignatureRef.current = configSignature;

      return;
    }

    if (lastSyncedSignatureRef.current === configSignature) {
      return;
    }

    const handler = setTimeout(() => {
      const latestState = useIoTStore.getState();

      if (latestState.manualSaveMode) {
        lastSyncedSignatureRef.current = configSignature;
        latestState.incrementUnsavedChanges();
      } else {
        void triggerCloudflarePush();
      }
    }, 1200);

    return () => clearTimeout(handler);
  }, [isFullyReady, configSignature, triggerCloudflarePush]);

  return { triggerCloudflarePush };
}
