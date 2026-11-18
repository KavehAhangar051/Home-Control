import type { EspConfig } from "@/features/iot/services/esp32Config";
import {
  CircuitBreaker,
  CircuitOpenError,
  createTimeoutSignal,
  getReliabilityHealthSnapshot,
  recordCircuitOpen,
  recordIntegrationRequest,
  recordIntegrationRetry,
  type ReliabilityHealthSnapshot,
  retryWithBackoff,
} from "@/lib/resilience";
import { getCloudflareWorkerUrl, isCloudflareEnabled } from "./config";
import { deserializeFromCloudflare, serializeToCloudflare } from "./mappers";

const REQUEST_TIMEOUT_MS = 8000;

export const cloudflareCircuitBreaker = new CircuitBreaker({
  serviceName: "cloudflare-worker",
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
});

export function getCloudflareReliabilityHealth(): ReliabilityHealthSnapshot {
  return getReliabilityHealthSnapshot({ cloudflare: cloudflareCircuitBreaker });
}

export type FetchFn = typeof fetch;

export interface CloudflareRequestOptions {
  timeoutMs?: number;
  fetchFn?: FetchFn;
  circuitBreaker?: CircuitBreaker;
  retryAttempts?: number;
}

class HttpStatusError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

function isRetryableCloudflareError(cause: unknown): boolean {
  if (cause instanceof CircuitOpenError) return false;

  if (cause instanceof HttpStatusError && cause.status >= 400 && cause.status < 500) {
    return cause.status === 408 || cause.status === 429;
  }

  return true;
}

async function fetchCloudflareConfigOnce(
  url: string,
  executeFetch: FetchFn,
  timeoutMs: number,
): Promise<EspConfig> {
  const timeout = createTimeoutSignal(timeoutMs);

  try {
    const res = await executeFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: timeout.signal,
    });

    if (!res.ok) {
      throw new HttpStatusError(
        res.status,
        `Failed to fetch Cloudflare config from ${url}: ${res.status} ${res.statusText}`,
      );
    }

    const data = await res.json();
    const parsed = deserializeFromCloudflare(data);
    // Keep active endpoint authoritative; older saved configs may contain legacy URL.
    parsed.worker_url = getCloudflareWorkerUrl();

    return parsed;
  } finally {
    timeout.cleanup();
  }
}

/**
 * Fetch the latest config from Cloudflare Worker with timeout, circuit breaker, and idempotent retry+jitter.
 */
export async function fetchConfigFromCloudflare(
  options?: CloudflareRequestOptions,
): Promise<EspConfig | null> {
  if (!isCloudflareEnabled()) return null;

  const baseUrl = getCloudflareWorkerUrl();
  const url = `${baseUrl}/config`;
  const executeFetch = options?.fetchFn ?? globalThis.fetch;
  const breaker = options?.circuitBreaker ?? cloudflareCircuitBreaker;
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retryAttempts = options?.retryAttempts ?? 3;

  const startedAt = Date.now();

  try {
    const config = await breaker.execute(
      () =>
        retryWithBackoff(() => fetchCloudflareConfigOnce(url, executeFetch, timeoutMs), {
          maxAttempts: retryAttempts,
          baseDelayMs: 250,
          maxDelayMs: 2000,
          isRetryable: isRetryableCloudflareError,
          onRetry: () => recordIntegrationRetry("cloudflare"),
        }),
      { shouldCountFailure: isRetryableCloudflareError },
    );

    recordIntegrationRequest("cloudflare", Date.now() - startedAt, true);

    return config;
  } catch (error) {
    recordIntegrationRequest("cloudflare", Date.now() - startedAt, false);

    if (error instanceof CircuitOpenError) {
      recordCircuitOpen("cloudflare");
    }

    const isTimeout =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

    if (!isTimeout && !(error instanceof CircuitOpenError)) {
      console.warn("Cloudflare fetchConfig failed:", error);
    }

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

type WorkerPayload =
  | ReturnType<typeof serializeToCloudflare>
  | { value: boolean }
  | { actions: Array<{ pin: string; state: boolean }> };

async function parseWorkerErrorMessage(res: Response, fallbackMessage: string): Promise<string> {
  try {
    // SAFETY: error responses from Cloudflare Worker optionally contain JSON with an error field
    const errorData = (await res.json()) as WorkerAckResponse;

    if (errorData?.error) {
      return errorData.error;
    }
  } catch {
    // Non-JSON error body; fall back to contextual error message.
  }

  return fallbackMessage;
}

async function sendWorkerPostOnce(
  url: string,
  payload: WorkerPayload,
  defaultSuccessMessage: string,
  errorContextLabel: string,
  executeFetch: FetchFn,
  timeoutMs: number,
): Promise<AckResult> {
  const timeout = createTimeoutSignal(timeoutMs);

  try {
    const res = await executeFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: timeout.signal,
    });

    if (!res.ok) {
      const errorMessage = await parseWorkerErrorMessage(res, `خطا در ${errorContextLabel}.`);

      if (res.status >= 500) {
        throw new HttpStatusError(res.status, errorMessage);
      }

      return { success: false, message: errorMessage };
    }

    // SAFETY: fetch response JSON adheres to WorkerAckResponse schema from Cloudflare Worker
    const data = (await res.json()) as WorkerAckResponse;

    if (data?.ack) {
      return { success: true, message: data.message || defaultSuccessMessage };
    }

    return { success: false, message: data?.error || `خطا در ${errorContextLabel}.` };
  } finally {
    timeout.cleanup();
  }
}

/**
 * Deep helper to execute Cloudflare Worker JSON POST requests with explicit timeout,
 * circuit breaker fast-fail protection, RED metrics, ACK parsing, and error conditions.
 */
async function postWorkerJson(
  endpoint: string,
  payload: WorkerPayload,
  defaultSuccessMessage: string,
  errorContextLabel: string,
  options?: CloudflareRequestOptions,
): Promise<AckResult> {
  if (!isCloudflareEnabled()) {
    return { success: false, message: "اتصال کلودفلر غیرفعال است." };
  }

  const baseUrl = getCloudflareWorkerUrl();
  const executeFetch = options?.fetchFn ?? globalThis.fetch;
  const breaker = options?.circuitBreaker ?? cloudflareCircuitBreaker;
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const startedAt = Date.now();

  try {
    const ackResult = await breaker.execute(
      () =>
        sendWorkerPostOnce(
          `${baseUrl}${endpoint}`,
          payload,
          defaultSuccessMessage,
          errorContextLabel,
          executeFetch,
          timeoutMs,
        ),
      { shouldCountFailure: isRetryableCloudflareError },
    );

    recordIntegrationRequest("cloudflare", Date.now() - startedAt, ackResult.success);

    return ackResult;
  } catch (error) {
    recordIntegrationRequest("cloudflare", Date.now() - startedAt, false);

    if (error instanceof CircuitOpenError) {
      recordCircuitOpen("cloudflare");

      return {
        success: false,
        message: "سرویس کلودفلر موقتاً در دسترس نیست؛ لطفاً کمی بعد دوباره تلاش کنید.",
      };
    }

    if (error instanceof HttpStatusError) {
      return { success: false, message: error.message };
    }

    console.error(`Cloudflare ${endpoint} error:`, error);

    return { success: false, message: `تغییرات ${errorContextLabel} بنا به دلایل فنی ذخیره نشد.` };
  }
}

/**
 * Save configuration to Cloudflare Worker.
 */
export async function saveConfigToCloudflare(
  config: EspConfig,
  options?: CloudflareRequestOptions,
): Promise<AckResult> {
  const payload = serializeToCloudflare(config);

  return postWorkerJson(
    "/config",
    payload,
    "تنظیمات با موفقیت ذخیره شد.",
    "ذخیره تنظیمات",
    options,
  );
}

/**
 * Update pin state on Durable Objects via Cloudflare Worker.
 */
export async function updatePinOnCloudflare(
  pin: string,
  value: boolean,
  options?: CloudflareRequestOptions,
): Promise<AckResult> {
  return postWorkerJson(
    `/pins/${pin}`,
    { value },
    `وضعیت پین ${pin} ذخیره شد.`,
    `پین ${pin}`,
    options,
  );
}

/**
 * Update multiple pins state simultaneously on Durable Objects via Cloudflare Worker.
 */
export async function updateBatchPinsOnCloudflare(
  actions: Array<{ pin: string; state: boolean }>,
  options?: CloudflareRequestOptions,
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
    options,
  );
}
