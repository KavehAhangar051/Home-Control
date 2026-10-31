const DEFAULT_WORKER_URL = "https://apii.agkalaa.ir";
const LEGACY_WORKER_URL = "https://api.agkalaa.ir";

let inMemoryWorkerUrl = DEFAULT_WORKER_URL;

function normalizeWorkerUrl(url: string): string {
  const normalized = url.trim().replace(/\/$/, "");
  return normalized === LEGACY_WORKER_URL ? DEFAULT_WORKER_URL : normalized;
}

let isWorkerEnabled = inMemoryWorkerUrl !== "" && !inMemoryWorkerUrl.includes("YOUR_SUBDOMAIN");

function updateWorkerState(url: string) {
  inMemoryWorkerUrl = normalizeWorkerUrl(url);
  isWorkerEnabled = inMemoryWorkerUrl !== "" && !inMemoryWorkerUrl.includes("YOUR_SUBDOMAIN");
}

if (typeof window !== "undefined") {
  const saved = localStorage.getItem("cloudflare_worker_url");
  if (saved) {
    updateWorkerState(saved);
    if (inMemoryWorkerUrl !== saved) {
      localStorage.setItem("cloudflare_worker_url", inMemoryWorkerUrl);
    }
  }
} else if (typeof process !== "undefined" && process.env) {
  updateWorkerState(process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL || DEFAULT_WORKER_URL);
}

export function getCloudflareWorkerUrl(): string {
  return inMemoryWorkerUrl;
}

export function setCloudflareWorkerUrl(url: string) {
  updateWorkerState(url);
  if (typeof window !== "undefined") {
    localStorage.setItem("cloudflare_worker_url", inMemoryWorkerUrl);
  }
}

/**
 * Checks if the Cloudflare Worker URL is actually customized/active rather than the placeholder.
 */
export function isCloudflareEnabled(): boolean {
  return isWorkerEnabled;
}
