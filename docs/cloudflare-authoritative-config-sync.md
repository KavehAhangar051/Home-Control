# Cloudflare Authoritative Configuration Sync

## Source of truth

The Cloudflare Worker `GET /config` response is authoritative whenever it is successfully received and validated. The browser's `cached_esp_config` entry is only an instant-render/offline fallback; it must never suppress or override a successful Worker response.

## Startup sequence

1. If local configuration caching is enabled, hydrate the dashboard from the last valid local snapshot so the interface can render immediately.
2. Request `/config` with Fetch `cache: "no-store"`, no-cache request headers, and a unique `_fresh` query value to avoid ordinary browser and URL-keyed edge cache reuse.
3. Validate that the response contains the expected configuration structure.
4. Cancel any queued write to the old cache key, replace the previous local snapshot synchronously, and apply the returned configuration to the store even when its serialized signature matches the fallback snapshot.
5. If the Worker cannot be reached, retain or recover the last valid local snapshot. If no valid snapshot exists, initialize the empty fallback state.

## Manual refresh

The Stability and Optimization settings section exposes a manual refresh action. It skips initial cache hydration, requests the current Worker configuration, then applies and stores the successful response. A failed request leaves the current dashboard state intact and reports the failure.

## Persistence

Automatic configuration persistence remains on the existing `useCloudflarePush` path. Changes to watched configuration fields (including segment configuration) are serialized from the latest Zustand state and saved through `POST /config`; manual-save mode continues to honor its existing explicit-save behavior.

## Worker HTTP cache policy

The Worker returns `Cache-Control: no-store, private` for every JSON response from `GET /config`, including the empty-config response. This prevents the browser and Cloudflare Workers Cache from treating the mutable dashboard configuration as a reusable HTTP response. The ESP configuration text response retains its existing no-store policy.

## Important boundary

The dashboard can bypass browser HTTP caching and normal URL-keyed edge cache entries, but a custom Worker cache key that deliberately ignores query parameters must also be configured not to cache `GET /config`. The Worker response's `no-store` policy is the primary server-side safeguard.
