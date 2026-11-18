/**
 * Runtime switches for optional browser-side behavior.
 * `configLocalCache` enables instant Stale-While-Revalidate hydration while Cloudflare stays authoritative in background sync.
 */
export const FEATURE_FLAGS = {
  configLocalCache: true,
  audioLocalCache: true,
  debugLogging: true,
} as const;
