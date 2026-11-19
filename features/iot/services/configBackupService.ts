import {
  readStoredWorkflowState,
  writeStoredWorkflowState,
} from "@/features/iot/components/workflows/workflowStorage";
import type { WorkflowStudioState } from "@/features/iot/components/workflows/workflowTypes";
import {
  buildEspConfig,
  persistStoreConfigToCloudflare,
} from "@/features/iot/hooks/achaemenidState/core/buildEspConfig";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  type SavedTrellisLayout,
  usePreferencesStore,
} from "@/features/iot/hooks/usePreferencesStore";
import {
  type CloudflareRawPayload,
  deserializeFromCloudflare,
} from "@/features/iot/services/cloudflare/mappers";
import { isCloudflareEnabled } from "@/features/iot/services/cloudflareService";
import type { EspConfig } from "@/features/iot/services/esp32Config";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { resolveSliderStyle, type SliderStylePreference } from "@/lib/sliderStyles";

export const DASHBOARD_BACKUP_SCHEMA = "home-control-backup-v1";
export const WORKFLOWS_UPDATED_EVENT = "iot-workflows-updated";

export interface DashboardBackupBundle {
  schema: typeof DASHBOARD_BACKUP_SCHEMA;
  exportedAt: string;
  espConfig: EspConfig;
  preferences?: {
    hapticsEnabled?: boolean;
    sliderStyle?: SliderStylePreference;
    savedTrellisLayouts?: SavedTrellisLayout[];
  };
  workflows?: WorkflowStudioState;
}

export interface RestoreDashboardResult {
  segmentsCount: number;
  automationsCount: number;
  workflowsCount: number;
  layoutsCount: number;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Snapshots the complete dashboard state into a single portable JSON bundle:
 * - Canonical `EspConfig` (segments, groups, automations, macros, voice commands, Wi-Fi, MQTT, theme)
 * - Browser-local preferences (`hapticsEnabled`, `savedTrellisLayouts`)
 * - Visual Workflow Studio graphs (`workflows`, `activeWorkflowId`)
 */
export function buildDashboardBackupBundle(): DashboardBackupBundle {
  const iotState = useIoTStore.getState();
  const prefsState = usePreferencesStore.getState();
  const workflowsState = readStoredWorkflowState();

  return {
    schema: DASHBOARD_BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    espConfig: buildEspConfig(iotState),
    preferences: {
      hapticsEnabled: prefsState.hapticsEnabled,
      sliderStyle: prefsState.sliderStyle,
      savedTrellisLayouts: prefsState.savedTrellisLayouts,
    },
    workflows: workflowsState,
  };
}

/**
 * Validates and normalizes an imported JSON object.
 * Accepts either a full `DashboardBackupBundle` (`home-control-backup-v1`)
 * or a standalone `EspConfig` / `CloudflareSerializedConfig` file.
 */
export function parseDashboardBackupPayload(raw: unknown): DashboardBackupBundle {
  if (!isObjectRecord(raw)) {
    throw new Error("ساختار فایل JSON معتبر نیست.");
  }

  if (raw.schema === DASHBOARD_BACKUP_SCHEMA && isObjectRecord(raw.espConfig)) {
    const normalizedConfig = deserializeFromCloudflare(raw.espConfig as CloudflareRawPayload);

    return {
      schema: DASHBOARD_BACKUP_SCHEMA,
      exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString(),
      espConfig: normalizedConfig,
      preferences: isObjectRecord(raw.preferences)
        ? {
            hapticsEnabled:
              typeof raw.preferences.hapticsEnabled === "boolean"
                ? raw.preferences.hapticsEnabled
                : undefined,
            sliderStyle:
              typeof raw.preferences.sliderStyle === "string"
                ? resolveSliderStyle(raw.preferences.sliderStyle)
                : undefined,
            savedTrellisLayouts: Array.isArray(raw.preferences.savedTrellisLayouts)
              ? (raw.preferences.savedTrellisLayouts as SavedTrellisLayout[])
              : undefined,
          }
        : undefined,
      workflows:
        isObjectRecord(raw.workflows) && Array.isArray(raw.workflows.workflows)
          ? (raw.workflows as unknown as WorkflowStudioState)
          : undefined,
    };
  }

  const hasEspConfigFields =
    Array.isArray(raw.segments) ||
    Array.isArray(raw.segments_definition) ||
    isObjectRecord(raw.preferences) ||
    isObjectRecord(raw.layout);

  if (!hasEspConfigFields) {
    throw new Error("فایل انتخاب‌شده شامل پیکربندی معتبر داشبورد نیست.");
  }

  return {
    schema: DASHBOARD_BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    espConfig: deserializeFromCloudflare(raw as CloudflareRawPayload),
  };
}

/**
 * Restores a validated backup bundle into `useIoTStore`, `usePreferencesStore`,
 * `workflowStorage`, local cache, and (when configured) Cloudflare KV.
 */
export async function restoreDashboardBackup(raw: unknown): Promise<RestoreDashboardResult> {
  const bundle = parseDashboardBackupPayload(raw);

  useIoTStore.getState().applyEspConfig(bundle.espConfig);

  if (FEATURE_FLAGS.configLocalCache && globalThis.window !== undefined) {
    try {
      globalThis.window.localStorage.setItem("cached_esp_config", JSON.stringify(bundle.espConfig));
    } catch {
      // Ignore restricted iframe storage errors
    }
  }

  let layoutsCount = usePreferencesStore.getState().savedTrellisLayouts.length;

  if (bundle.preferences) {
    const prefs = usePreferencesStore.getState();

    if (typeof bundle.preferences.hapticsEnabled === "boolean") {
      prefs.setHapticsEnabled(bundle.preferences.hapticsEnabled);
    }

    if (typeof bundle.preferences.sliderStyle === "string") {
      prefs.setSliderStyle(bundle.preferences.sliderStyle);
    }

    if (Array.isArray(bundle.preferences.savedTrellisLayouts)) {
      const validLayouts = bundle.preferences.savedTrellisLayouts.filter(
        (item) =>
          isObjectRecord(item) &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          isObjectRecord(item.document),
      );
      usePreferencesStore.setState({ savedTrellisLayouts: validLayouts.slice(0, 12) });
      layoutsCount = validLayouts.length;
    }
  }

  let workflowsCount = readStoredWorkflowState().workflows.length;

  if (bundle.workflows && Array.isArray(bundle.workflows.workflows)) {
    writeStoredWorkflowState(bundle.workflows);
    const hydrated = readStoredWorkflowState();
    workflowsCount = hydrated.workflows.length;

    if (globalThis.window !== undefined) {
      globalThis.window.dispatchEvent(new CustomEvent(WORKFLOWS_UPDATED_EVENT));
    }
  }

  if (isCloudflareEnabled()) {
    await persistStoreConfigToCloudflare({
      successToast: "پشتیبان بازیابی و با فضای ابری همگام‌سازی شد.",
    });
  }

  return {
    segmentsCount: bundle.espConfig.segments.length,
    automationsCount: bundle.espConfig.automations?.length ?? 0,
    workflowsCount,
    layoutsCount,
  };
}
