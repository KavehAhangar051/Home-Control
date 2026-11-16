# Testing

## Test Strategy
- **Pyramid:** Fast deterministic unit & boundary contract tests run natively in Node (`node --import ./tests/ts-loader.mjs --test tests/*.test.mjs`), covering domain logic (pin validation, voice fuzzy matching, workflow graph evaluation, canvas geometry, easing specs), wire protocols (Cloudflare mappers, MQTT binary encoders & JSON/binary decoders), HTTP gateways (Cloudflare API client, Archive.org playlist resolver), multi-transport orchestration (`LiveDeviceSyncAdapter`, `InMemoryDeviceSyncAdapter`), store reducers (`useIoTStore` + `applyEspConfig`), resilience primitives (`CircuitBreaker`, `retryWithBackoff`, `createTimeoutSignal`, RED metrics), and concurrency/consistency invariants (monotonic KV saves, live ESP32 SSOT priority, batch catch rollback).
- **Tooling:** Node built-in `node:test` + `node:assert/strict` with custom TypeScript path-alias loader (`tests/ts-loader.mjs`), paired with Biome (`npm run lint`), TypeScript (`npm run typecheck`), and Next.js static export (`npm run build`).
- **What "green" gates:** `npm run check` (`biome lint` + `tsc --noEmit` + `node --test`) and `npm run build` must pass with 0 diagnostics, 0 type errors, and 100% passing test assertions.

## Safety Net Map
| Module | Pinned behaviors | Test files | Gaps |
|---|---|---|---|
| `features/iot/utils/pinValidation.ts` | GPIO range, SPI flash 6..11 rejection, input-only 34/35/36/39 constraints | `tests/domain-contracts.test.mjs` | None |
| `components/MasterHeader/VoiceCommandButton/utils.ts` | Persian phonetic normalization, Levenshtein similarity, custom voice command macro unfolding | `tests/domain-contracts.test.mjs` | Browser SpeechRecognition API requires manual verification |
| `features/iot/components/workflows/{workflowEngine.ts,workflowRuntimeHelpers.ts}` | Port rules, grid snapping, directed cycle rejection, graph evaluation, timer edge-latching, level vs toggle dispatch dedup | `tests/domain-contracts.test.mjs`, `tests/legacy-seams.test.mjs` | React effect interval tick wiring inside `useWorkflowRuntime` |
| `features/iot/components/canvas/{canvasGeometry,canvasStorage,nodeMotion}.ts` | Viewport fitting, grid snap, node reconciliation, magnetic snap, injected `CanvasStorageLike` SSR & settings/nodes/viewport persistence | `tests/domain-contracts.test.mjs`, `tests/legacy-seams.test.mjs` | Interactive pointer drag DOM events |
| `features/iot/services/cloudflare/mappers.ts` | Legacy/canonical schema serialization & normalization | `tests/domain-contracts.test.mjs` | None |
| `features/iot/services/mqtt/{pinPublishers,segmentPublishers,messageParser,client,init}.ts` | Binary frames, incoming state/status parsing, settings priority resolution, bounded 256-entry pin queue, connect/message generation guards | `tests/safety-net.test.mjs`, `tests/legacy-seams.test.mjs` | Live `mqtt.connect` WebSocket broker handshake |
| `features/iot/services/cloudflare/{config,api}.ts` | Worker URL normalization/legacy migration, GET/POST ACK & error handling, CircuitBreaker & 4xx/5xx retry policy | `tests/safety-net.test.mjs` | Live Cloudflare Worker integration |
| `features/iot/services/deviceGatewayAdapter.ts` | `LiveDeviceSyncAdapter` WS/MQTT/CF routing, push-mode exclusion, `InMemoryDeviceSyncAdapter` bounded dispatch log | `tests/safety-net.test.mjs` | Real browser WebSocket / Capacitor native runtime |
| `features/iot/hooks/useIoTStore.ts` + `createConfigSlice.ts` | Store state updates, `applyEspConfig` hydration, live ESP32 RAM SSOT preservation over KV | `tests/safety-net.test.mjs` | React component selector re-renders |
| `features/iot/hooks/achaemenidState/{usePinOperations,useConnectionStrategy,useAchaemenidDnd}.ts` + `core/{buildEspConfig,segmentOperations,cloudflareSyncCoordinator}.ts` | Single/batch optimistic rollback, AP validation, monotonic KV saves, Capacitor WS handshake/jittered reconnect, segment/group planning, CF init sync & push state transitions, DnD index/drop decisions | `tests/safety-net.test.mjs`, `tests/legacy-seams.test.mjs` | React DOM DnD pointer events |
| `features/iot/hooks/voiceRecognitionHelpers.ts`, `features/iot/components/AutomationsDrawer/hooks/{useAutomationForm,useAutomationActions}.ts` | `SpeechRecognition` session & restart abort guard, deterministic timer rollover (`now` seam), action list mutations | `tests/legacy-seams.test.mjs` | Live browser Web Speech / Geolocation prompts |
| `features/iot/components/{trellis/trellisLayout,workspace/core/gridUtils,sortable-segment-card/hooks/useSegmentDensity}.ts`, `features/dashboard/{navigation.ts,hooks/useWorkspaceSwipe.ts}`, `components/MasterHeader/ClockWidget/persianDateUtils.ts`, `lib/fonts.ts` | Fractal & group Trellis docks, LCM grid spans, segment card density, swipe filter resolution, settings tab alias resolution, Shahanshahi dates, font CSS resolution | `tests/legacy-seams.test.mjs` | Visual layout in DOM viewports |
| `features/iot/services/localWs/client.ts` | Local WS listener register/dispatch/unsubscribe | `tests/safety-net.test.mjs` | Native Capacitor `ws://<ip>:81` socket |
| `lib/resilience.ts` & `lib/audio/{playlist,AmbientManager,SoundManager}.ts` | `CircuitBreaker` state machine, exponential backoff + full jitter, `createTimeoutSignal`, RED metrics, Archive.org URL resolution, `AmbientManagerDeps` & `SoundManagerDeps` playback seams | `tests/safety-net.test.mjs`, `tests/legacy-seams.test.mjs` | Real browser Web Audio playback |

## Characterization Backlog
- [x] `features/iot/services/mqtt/{pinPublishers,segmentPublishers,messageParser}` — wire frame & parser pinning (Phase 1 — Done)
- [x] `features/iot/services/cloudflare/{config,api}` — URL normalization, HTTP ACK, Circuit Breaker & Retry pinning (Phases 1 & 7 — Done)
- [x] `features/iot/services/deviceGatewayAdapter` — `LiveDeviceSyncAdapter` WS/MQTT/CF routing & bounded sim log (Phases 1 & 8 — Done)
- [x] `features/iot/hooks/useIoTStore` + `createConfigSlice` + `buildEspConfig` — hydration, live SSOT preservation, serialized writes (Phases 1 & 9 — Done)
- [x] `features/iot/hooks/achaemenidState/usePinOperations` — optimistic rollback on failure/exception (Phases 2–4 — Done)
- [x] Legacy seams extraction (`mqtt/{client,init}`, `useConnectionStrategy`, `segmentOperations`, `cloudflareSyncCoordinator`, `useAchaemenidDnd`, `useAutomationForm`/`Actions`, `workflowRuntimeHelpers`, `voiceRecognitionHelpers`, `canvasStorage`, `AmbientManager`/`SoundManager`, layout/date/font utilities) — `tests/legacy-seams.test.mjs` (Done)

## CI Gates
- **Primary gate:** `npm run check` (`npm run lint && npm run typecheck && npm run test`)
- **Static export verification:** `npm run build` (`NODE_ENV=production next build`)
