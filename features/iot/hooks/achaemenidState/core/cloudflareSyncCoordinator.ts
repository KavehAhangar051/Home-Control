import type { EspConfig } from "@/features/iot/services/esp32Config";

export interface CloudflareInitSyncDeps {
  maxAttempts?: number;
  configLocalCacheEnabled: boolean;
  isCloudflareEnabled: () => boolean;
  isOnline: () => boolean;
  isBypassed: () => boolean;
  fetchConfig: (timeoutMs: number) => Promise<EspConfig | null>;
  readLocalCache: () => EspConfig | null;
  writeLocalCache: (config: EspConfig) => void;
  clearLocalCache: () => void;
  applyConfig: (config: EspConfig) => void;
  onWorkerUrlChange: (url: string) => void;
  onResetEmptyState: () => void;
  onSyncStatus: (loading: boolean, progress: number, message: string) => void;
  onBumpRemoteEpoch: () => void;
  onReady: () => void;
  sleep?: (ms: number) => Promise<void>;
  warn?: (tag: string, msg: string, data?: unknown) => void;
  info?: (tag: string, msg: string, data?: unknown) => void;
}

export type CloudflareInitSyncOutcome =
  | { kind: "remote_applied"; attempts: number }
  | { kind: "cache_recovered" }
  | { kind: "empty_fallback" }
  | { kind: "aborted_by_bypass" };

export function executeBypassFallback(
  deps: Pick<
    CloudflareInitSyncDeps,
    | "configLocalCacheEnabled"
    | "readLocalCache"
    | "applyConfig"
    | "onResetEmptyState"
    | "onBumpRemoteEpoch"
    | "onSyncStatus"
    | "onReady"
    | "warn"
  >,
): "cache_recovered" | "empty_fallback" {
  if (deps.configLocalCacheEnabled) {
    const cachedConfig = deps.readLocalCache();

    if (cachedConfig && Array.isArray(cachedConfig.segments) && cachedConfig.layout) {
      deps.applyConfig(cachedConfig);
      deps.onBumpRemoteEpoch();
      deps.onSyncStatus(false, 100, "اتصال به سرور برقرار نیست؛ تنظیمات کش‌شده بارگذاری شد.");
      deps.onReady();
      deps.warn?.("ConfigSync", "Recovered configuration from optional local cache.");

      return "cache_recovered";
    }
  }

  deps.onResetEmptyState();
  deps.onBumpRemoteEpoch();
  deps.onSyncStatus(
    false,
    0,
    "تنظیمات از سرور دریافت نشد؛ داشبورد با گروه‌ها و سگمنت‌های خالی آماده است.",
  );
  deps.onReady();
  deps.warn?.(
    "ConfigSync",
    "Cloud configuration unavailable; initialized empty groups and segments.",
  );

  return "empty_fallback";
}

/**
 * Coordinates initial Cloudflare configuration hydration with bounded retries,
 * offline short-circuiting, optional cache recovery, and bypass cancellation safety.
 */
export async function executeCloudflareInitSync(
  deps: CloudflareInitSyncDeps,
): Promise<CloudflareInitSyncOutcome> {
  const maxAttempts = Math.max(1, deps.maxAttempts ?? 2);
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  if (!deps.configLocalCacheEnabled) {
    deps.clearLocalCache();
  }

  if (!deps.isCloudflareEnabled()) {
    deps.warn?.("ConfigSync", "Cloudflare is disabled; no default configuration will be applied.");

    return { kind: executeBypassFallback(deps) };
  }

  if (!deps.isOnline()) {
    deps.warn?.("ConfigSync", "Browser offline detected; bypassing remote configuration wait.");

    return { kind: executeBypassFallback(deps) };
  }

  let attemptCount = 0;

  while (!deps.isBypassed() && attemptCount < maxAttempts) {
    attemptCount++;
    deps.onSyncStatus(
      true,
      Math.min(25 + attemptCount * 35, 95),
      `در حال دریافت تنظیمات از سرور ابری (تلاش ${attemptCount} از ${maxAttempts})...`,
    );

    try {
      const timeoutMs = attemptCount === 1 ? 3000 : 1800;
      const cfConfig = await deps.fetchConfig(timeoutMs);

      if (cfConfig && Array.isArray(cfConfig.segments)) {
        if (deps.isBypassed()) {
          return { kind: "aborted_by_bypass" };
        }

        if (cfConfig.worker_url) {
          deps.onWorkerUrlChange(cfConfig.worker_url);
        }

        if (deps.configLocalCacheEnabled) {
          deps.writeLocalCache(cfConfig);
        }

        deps.applyConfig(cfConfig);
        deps.onBumpRemoteEpoch();
        deps.onSyncStatus(false, 100, "همگام‌سازی تنظیمات انجام شد.");
        deps.onReady();
        deps.info?.("ConfigSync", "Cloud configuration applied.", {
          segments: cfConfig.segments.length,
          groups: cfConfig.layout?.groups_order?.length ?? 0,
        });

        return { kind: "remote_applied", attempts: attemptCount };
      }

      deps.warn?.("ConfigSync", "Cloudflare returned an invalid configuration payload.", {
        attempt: attemptCount,
      });
    } catch (error) {
      deps.warn?.("ConfigSync", "Cloud configuration request failed.", {
        attempt: attemptCount,
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    if (deps.isBypassed()) {
      return { kind: "aborted_by_bypass" };
    }

    if (attemptCount < maxAttempts) {
      deps.onSyncStatus(
        true,
        Math.min(25 + attemptCount * 35, 95),
        "دریافت تنظیمات ناموفق بود؛ تلاش مجدد...",
      );
      await sleep(250);
    }
  }

  if (deps.isBypassed()) {
    return { kind: "aborted_by_bypass" };
  }

  return { kind: executeBypassFallback(deps) };
}

export type CloudflarePushDecision = "reset" | "baseline" | "noop" | "schedule";

/**
 * Pure transition rule deciding whether a config signature change should reset,
 * establish a baseline (after remote hydration), no-op, or schedule a push.
 */
export function evaluateCloudflarePushTransition(params: {
  isFullyReady: boolean;
  remoteSyncEpoch: number;
  lastRemoteEpoch: number;
  lastSyncedSignature: string | null;
  configSignature: string;
}): CloudflarePushDecision {
  if (!params.isFullyReady) return "reset";

  if (params.lastSyncedSignature === null || params.lastRemoteEpoch !== params.remoteSyncEpoch) {
    return "baseline";
  }

  if (params.lastSyncedSignature === params.configSignature) {
    return "noop";
  }

  return "schedule";
}
