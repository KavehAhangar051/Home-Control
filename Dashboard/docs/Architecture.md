# Software Architecture & System Design

## Layer Map & Dependency Rule
Dependencies point strictly **inward** (`UI / Hooks -> Application Use Cases & Ports -> Domain / Protocol Rules`) and **infrastructure adapters implement inward ports**:

1. **Pure Domain & Wire Rules (Inner Core — zero React/DOM/network imports):**
   - `features/iot/utils/pinValidation.ts` — ESP32 hardware pin invariants (`0..39`, SPI flash `6..11`, input-only `34/35/36/39`).
   - `features/iot/services/config/{types,defaults}.ts` — canonical schema contract (`CANONICAL_CONFIG_VERSION = "1.2.0"`, `DEFAULT_DEVICE_INFO`).
   - `features/iot/services/cloudflare/mappers.ts` — pure boundary serialization/deserialization & legacy rule/automation normalization.
   - `features/iot/services/mqtt/{protocol,messageParser}.ts` & `build*Frame` helpers — binary opcodes, big/little-endian framing, incoming state/status parsing.
   - `features/iot/components/workflows/workflowEngine.ts` & `features/iot/components/canvas/canvasGeometry.ts` — deterministic DAG evaluation and layout math.
2. **Ports & Interfaces (Boundary Contracts):**
   - `features/iot/services/ports.ts` (`IDeviceCommandPort`, `IConfigStoragePort`, `IDeviceSyncPort`).
   - `features/iot/services/storeBridge.ts` (`IoTStoreBridge` — Dependency Inversion bridge allowing services to read/update store state without importing React hooks).
3. **Interface Adapters & External Transports (`features/iot/services/*`, `lib/resilience.ts`):**
   - `deviceGatewayAdapter.ts` (`LiveDeviceSyncAdapter`, `InMemoryDeviceSyncAdapter`, `DeviceCommandAdapter`, `CloudflareStorageAdapter`).
   - `cloudflare/api.ts`, `mqtt/{client,init,pinPublishers,segmentPublishers,systemPublishers}.ts`, `localWs/client.ts`.
   - `lib/resilience.ts` — timeouts, circuit breakers, exponential backoff + full jitter, bounded RED metrics.
4. **Application State & UI Presentation (Outer Layer — React / Zustand):**
   - `features/iot/hooks/useIoTStore.ts` (composition root registering `registerIoTStoreBridge`), store slices (`store/slices/*`), and orchestration hooks (`achaemenidState/*`).
   - Next.js static-export pages/components (`app/*`, `components/*`, `features/*/components/*`).

## Decision Log
| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-11-15 | 4 | Delete `pinSyncUtils.ts` pass-through and inject `IDeviceSyncPort` into `usePinOperations` | Eliminates shallow indirection while enabling deterministic exception/failure rollback testing |
| 2026-11-15 | 5 | Introduce `storeBridge.ts` registered in `useIoTStore.ts` | Eliminates direct React/Zustand hook imports inside `mqtt/{client,init}.ts` and `deviceGatewayAdapter.ts` |
| 2026-11-15 | 6 | Centralize `"1.2.0"` schema version & `DEFAULT_DEVICE_INFO` in `config/defaults.ts` | Eliminates duplicated schema knowledge across `mappers.ts` and `buildEspConfig.ts` |
| 2026-11-15 | 7 | Centralize timeouts, `CircuitBreaker`, retries, and RED metrics in `lib/resilience.ts` | Protects browser/Capacitor clients from hanging requests, retry storms, and WebViews without `AbortSignal.timeout` |
| 2026-11-15 | 9 | Serialize `persistStoreConfigToCloudflare` saves & preserve live `pinsState` in `applyEspConfig` | Prevents out-of-order Cloudflare KV lost-update races and protects live ESP32 RAM SSOT from stale KV hydration |

## System Context & Sizing
- **Deployment Model:** Static-export Next.js 15 frontend (`output: "export"`), running entirely inside user browsers or native Capacitor mobile shells; no backend Node server or `app/api/*` routes exist.
- **Real Load Envelope (Household Automation):**
  - **Users:** 1–10 DAU per home deployment.
  - **Throughput:** ~0.001–0.05 avg QPS; peak burst ~1–10 ops/sec during macro scenes or multi-relay sweeps.
  - **MQTT Frame Budget:** Single pin `7 B`, batch pins `2 + 6N B`, presence `2 B` (~20–300 B even on max batch).
  - **Cloudflare KV Payload:** Full `EspConfig` JSON typically `4–35 KB` (well under Cloudflare KV 25 MB limit and HTTP 100 KB fast path).
  - **Client Memory & Storage Budgets:** `localStorage` footprint < 200 KB (`worker_url`, MQTT settings, canvas node positions, cached track metadata); in-memory latency histogram bounded to 64 samples/integration; `pendingStateUpdates` capped at 256 pins; `InMemoryDeviceSyncAdapter.dispatchLog` capped at 500 entries.

## Data & Storage Decisions
- **Authoritative Sources of Truth (Dual-Domain Separation):**
  - **Live Hardware Pin States (`pinsState`):** ESP32 RAM is the strict **Single Source of Truth (SSOT)**. UI pin toggles are optimistic updates with guarded rollback (`rollbackSinglePinState`, `rollbackBatchPinState`) that only revert a pin if no newer state change has modified that pin in the meantime. When `applyEspConfig` hydrates configuration from Cloudflare KV, `pinsState[pin]` entries already populated by live ESP32 MQTT/LocalWS traffic are preserved rather than overwritten by potentially stale KV `seg.state` fields.
  - **Configuration & Layout (`EspConfig`):** Cloudflare Workers + Durable Objects / KV store durable dashboard configuration (`/config`) and persistent pin state (`/pins/:pin`, `/pins/batch`). Push-mode momentary segments are excluded from Cloudflare pin persistence.
- **Concurrency & Lost-Update Prevention:**
  - `persistStoreConfigToCloudflare` assigns monotonically increasing generation numbers and chains writes sequentially through `configSaveQueue`, reading the freshest store snapshot immediately before issuing `POST /config`. Older stalled saves can never complete out-of-order and clobber newer KV configurations, nor prematurely reset `unsavedChangesCount` when newer edits occurred while in flight.
- **Schema Evolution & Boundary Normalization:**
  - `cloudflare/mappers.ts` handles forward/backward normalization of legacy single-target rules, legacy dual-target rules, legacy `segments` arrays, and legacy `automations` records into canonical v`1.2.0` shapes at ingress/egress boundaries.
