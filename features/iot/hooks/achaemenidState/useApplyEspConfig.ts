import { useCallback } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { EspConfig } from "@/features/iot/services/esp32Config";

export function useApplyEspConfig() {
  const handleApplyEspConfig = useCallback((config: EspConfig) => {
    if (!config) return;

    // Delegate all config hydration to the single store slice action.
    useIoTStore.getState().applyEspConfig(config);
  }, []);

  return { handleApplyEspConfig };
}
