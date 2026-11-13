import { useCallback } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import type { EspConfig } from "@/features/iot/services/esp32Config";
import { resolveDashboardFontId } from "@/lib/fonts";

export function useApplyEspConfig() {
  const handleApplyEspConfig = useCallback((config: EspConfig) => {
    if (!config) return;

    // Read the store imperatively so this callback stays stable across state updates.
    const store = useIoTStore.getState();

    if (config.preferences.theme_mode) {
      store.setIsDark(config.preferences.theme_mode !== "light");
    }

    if (config.preferences.font_family) {
      store.setSelectedFont(resolveDashboardFontId(config.preferences.font_family));
    }

    store.setAnimationsEnabled(config.preferences.animations_enabled);

    if (config.preferences.animations_fps !== undefined)
      store.setAnimationsFps(config.preferences.animations_fps);
    store.setHeaderTitle(config.preferences.header_title);

    if (config.preferences.manual_save_mode !== undefined) {
      store.setManualSaveMode(config.preferences.manual_save_mode);
    }

    store.applyEspConfig(config);
  }, []);

  return { handleApplyEspConfig };
}
