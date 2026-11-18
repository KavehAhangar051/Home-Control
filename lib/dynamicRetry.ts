export interface RetryDynamicImportOptions {
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Retries a dynamic ES module import with bounded linear backoff so transient
 * proxy/CDN hiccups during chunk loading recover automatically instead of
 * trapping the view in a loading skeleton.
 */
export async function retryDynamicImport<T>(
  loader: () => Promise<T>,
  options: RetryDynamicImportOptions = {},
): Promise<T> {
  const maxRetries = Math.max(0, options.retries ?? 2);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries && baseDelayMs > 0) {
        await sleep(baseDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError;
}
