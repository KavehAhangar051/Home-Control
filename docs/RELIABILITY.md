# Reliability

## Integration-Point Audit
| Dependency | Timeout | Circuit breaker | Bulkhead / Bound | Retry policy | Status |
|---|---|---|---|---|---|
| Cloudflare Worker `GET /config` | 8000ms (`AbortController` via `createTimeoutSignal`) | `cloudflareCircuitBreaker` (trips after 3 transient/5xx failures, 30s reset, half-open single probe) | Latest config cached in memory/Zustand store; 4xx never retried/tripped | 3 attempts, 250ms–2000ms exponential backoff + full jitter (skip 4xx & `CircuitOpenError`) | Hardened (Phase 7) |
| Cloudflare Worker `POST /config`, `/pins/:pin`, `/pins/batch` | 8000ms (`createTimeoutSignal`) | Shared `cloudflareCircuitBreaker` fast-fails when OPEN | Serialized single-flight queue on `persistStoreConfigToCloudflare` | Non-idempotent writes do NOT blind-retry; client shows localized fallback status | Hardened (Phases 7 & 9) |
| Archive.org Metadata & Playlist API (`fetchArchivePlaylist`, `fetchTrackUrl`) | 8000ms (`createTimeoutSignal`) | Online-only playlist; dispatches localized `ambientMusicError` when unreachable | Bounded `Math.min(5, playlist.length)` track resolution attempts | No aggressive retry loop; skips unavailable track to next item | Hardened (Phase 7) |
| Ambient Audio Download (`AmbientManager.getPlayableUrl`) | 15000ms (`createTimeoutSignal`) | Falls back to direct streaming URL on cache/download timeout | Uses browser Cache API for single active track | Single attempt; safe fallback | Hardened (Phase 7) |
| Capacitor Local WebSocket (`ws://<ip>:81`) | Handshake governed by OS/WebView socket; falls back to MQTT immediately | Automatic fallback to MQTT when `readyState !== OPEN` or `!isLocal` | Bounded single socket instance managed per `localIp` (`useConnectionStrategy`) | Bounded exponential backoff + full jitter (`1000ms` -> `30000ms`), reset on `onopen` | Hardened (Phase 7) |
| MQTT over WebSocket (`mqtt.connect`) | `reconnectPeriod: 5000` (mqtt.js) | LWT Status topic switches `isLocal` offline cleanly | `pendingStateUpdates` map capped at `MAX_PENDING_PIN_UPDATES = 256` entries + double-buffered rAF flush | Handled by mqtt.js with connection-generation guards on reconnect | Hardened (Phases 7–8) |

## Query & Resource Findings
- **Unbounded queues closed:**
  - `mqtt/init.ts`: `pendingStateUpdates` Map bounded to 256 entries so runaway broker message bursts cannot leak memory before `requestAnimationFrame` flushes.
  - `deviceGatewayAdapter.ts`: `InMemoryDeviceSyncAdapter.dispatchLog` capped at 500 FIFO entries.
  - `lib/resilience.ts`: Per-integration RED latency sample ring buffer fixed at 64 entries (`O(1)` bounded memory).
- **WebView Timeout Compatibility:** Replaced optional `AbortSignal.timeout?.()` (which silently returned `undefined` in older Android WebViews) with explicit `AbortController` + `setTimeout` (`finally` cleanup) via `createTimeoutSignal()`.
- **UI Main-Thread Safety:** MQTT incoming state updates coalesce through double-buffered maps into a single `requestAnimationFrame` Zustand update per animation frame.

## Health Checks & Metrics
- **Deep Health Snapshot (`getCloudflareReliabilityHealth()` / `getReliabilityHealthSnapshot()`):**
  - Reports overall status (`"healthy"` | `"degraded"`) derived from active `CircuitBreaker` state (`CLOSED`, `OPEN`, `HALF_OPEN`) plus per-integration RED metrics (`requests`, `errors`, `retries`, `circuitOpens`, `lastLatencyMs`, `p95LatencyMs`) for `cloudflare`, `archive`, `localWs`, and `mqtt`.
  - Kept strictly in service diagnostics & `debugLog` without cluttering the user dashboard UI.
- **Key Symptom Alerts:**
  - `cloudflareCircuitBreaker` transitioning `CLOSED -> OPEN` emits `debugLog.warn("Resilience", ...)`.
  - Transport offline condition during user pin toggle surfaces clear localized toast feedback and triggers optimistic state rollback.

## Deploy vs Release
- **Feature Flags (`lib/featureFlags.ts`):** Runtime feature toggles (such as `audioLocalCache`) separate deployment of static assets from activation.
- **Static Export Deploy (`npm run build` / `.github/workflows/deploy-pages.yml`):** Generates deterministic static artifacts in `out/` with `GITHUB_PAGES=true` basePath compatibility.
- **Expand-Contract Schema Compatibility:** `cloudflare/mappers.ts` retains dual-read backward compatibility for legacy Cloudflare/ESP32 config payloads while writing canonical `1.2.0` payloads, allowing safe zero-downtime firmware/frontend upgrades and rollbacks.
