import { EspConfig } from "@/features/iot/services/esp32Config";
import { getCloudflareWorkerUrl, isCloudflareEnabled } from "./config";
import { serializeToCloudflare, deserializeFromCloudflare } from "./mappers";

/**
 * Fetch the latest config from Cloudflare Worker.
 */
export async function fetchConfigFromCloudflare(): Promise<EspConfig | null> {
  if (!isCloudflareEnabled()) return null;

  const baseUrl = getCloudflareWorkerUrl();
  const url = `${baseUrl}/config`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch Cloudflare config from ${url}: ${res.status} ${res.statusText}`,
      );
    }

    const data = await res.json();
    const config = deserializeFromCloudflare(data);

    // Keep the active endpoint authoritative; older saved configs may still contain the legacy URL.
    config.worker_url = getCloudflareWorkerUrl();
    return config;
  } catch (error) {
    console.error("Cloudflare fetchConfig error:", error);
    throw error;
  }
}

/** نتیجه استاندارد ACK از سرور */
export interface AckResult {
  success: boolean;
  message: string;
}

interface WorkerAckResponse {
  ack?: boolean;
  message?: string;
  error?: string;
}

/**
 * Deep helper to execute Cloudflare Worker JSON POST requests,
 * validating configuration, status, ACK responses, and error conditions.
 */
async function postWorkerJson(
  endpoint: string,
  payload: unknown,
  defaultSuccessMessage: string,
  errorContextLabel: string,
): Promise<AckResult> {
  if (!isCloudflareEnabled()) {
    return { success: false, message: "اتصال کلودفلر غیرفعال است." };
  }

  const baseUrl = getCloudflareWorkerUrl();
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as WorkerAckResponse;
    if (res.ok && data?.ack) {
      return { success: true, message: data.message || defaultSuccessMessage };
    }

    return { success: false, message: data?.error || `خطا در ${errorContextLabel}.` };
  } catch (error) {
    console.error(`Cloudflare ${endpoint} error:`, error);
    return { success: false, message: `تغییرات ${errorContextLabel} بنا به دلایل فنی ذخیره نشد.` };
  }
}

/**
 * Save configuration to Cloudflare Worker.
 */
export async function saveConfigToCloudflare(config: EspConfig): Promise<AckResult> {
  const payload = serializeToCloudflare(config);
  return postWorkerJson("/config", payload, "تنظیمات با موفقیت ذخیره شد.", "ذخیره تنظیمات");
}

/**
 * Update pin state on Durable Objects via Cloudflare Worker.
 */
export async function updatePinOnCloudflare(pin: string, value: boolean): Promise<AckResult> {
  return postWorkerJson(`/pins/${pin}`, { value }, `وضعیت پین ${pin} ذخیره شد.`, `پین ${pin}`);
}

/**
 * Update multiple pins state simultaneously on Durable Objects via Cloudflare Worker.
 */
export async function updateBatchPinsOnCloudflare(
  actions: Array<{ pin: string; state: boolean }>,
): Promise<AckResult> {
  if (!isCloudflareEnabled()) {
    return { success: false, message: "اتصال کلودفلر غیرفعال است." };
  }
  if (actions.length === 0) {
    return { success: true, message: "دستوری برای اجرا وجود ندارد." };
  }

  return postWorkerJson(
    "/pins/batch",
    { actions },
    `وضعیت ${actions.length} پین گروهی ذخیره شد.`,
    "گروهی",
  );
}
