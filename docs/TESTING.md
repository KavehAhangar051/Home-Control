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
| `features/iot/components/workflows/workflowEngine.ts` | Port rules, grid snapping, directed cycle rejection, graph evaluation | `tests/domain-contracts.test.mjs` | React timer effect lifecycle inside `useWorkflowRuntime` |
| `features/iot/components/canvas/{canvasGeometry,canvasStorage,nodeMotion}.ts` | Viewport fitting, grid snap, node reconciliation, magnetic snap | `tests/domain-contracts.test.mjs` | Interactive pointer drag DOM events |
| `features/iot/services/cloudflare/mappers.ts` | Legacy/canonical schema serialization & normalization | `tests/domain-contracts.test.mjs` | None |
| `features/iot/services/mqtt/{pinPublishers,segmentPublishers,messageParser}.ts` | Binary frames (`TOGGLE_PIN`, `BATCH_PINS`, `ADD_SEGMENT`, `DELETE_SEGMENT`, `UPDATE_RULE`) & incoming state/status parsing | `tests/safety-net.test.mjs` | Live `mqtt.connect` WebSocket broker handshake |
| `features/iot/services/cloudflare/{config,api}.ts` | Worker URL normalization/legacy migration, GET/POST ACK & error handling, CircuitBreaker & 4xx/5xx retry policy | `tests/safety-net.test.mjs` | Live Cloudflare Worker integration |
| `features/iot/services/deviceGatewayAdapter.ts` | `LiveDeviceSyncAdapter` WS/MQTT/CF routing, push-mode exclusion, `InMemoryDeviceSyncAdapter` bounded dispatch log | `tests/safety-net.test.mjs` | Real browser WebSocket / Capacitor native runtime |
| `features/iot/hooks/useIoTStore.ts` + `createConfigSlice.ts` | Store state updates, `applyEspConfig` hydration, live ESP32 RAM SSOT preservation over KV | `tests/safety-net.test.mjs` | React component selector re-renders |
| `features/iot/hooks/achaemenidState/usePinOperations.ts` & `core/buildEspConfig.ts` | Single/batch optimistic rollback on false or exception, AP validation, serialized monotonic KV config writes | `tests/safety-net.test.mjs` | Hook effect wiring inside mounted tree |
| `features/iot/services/localWs/client.ts` | Local WS listener register/dispatch/unsubscribe | `tests/safety-net.test.mjs` | Native Capacitor `ws://<ip>:81` socket |
| `lib/resilience.ts` & `lib/audio/playlist.ts` | `CircuitBreaker` state machine, exponential backoff + full jitter, `createTimeoutSignal`, RED metrics, Archive.org URL resolution | `tests/safety-net.test.mjs` | Web Audio `AudioContext` playback |

## Characterization Backlog
- [x] `features/iot/services/mqtt/{pinPublishers,segmentPublishers,messageParser}` — wire frame & parser pinning (Phase 1 — Done)
- [x] `features/iot/services/cloudflare/{config,api}` — URL normalization, HTTP ACK, Circuit Breaker & Retry pinning (Phases 1 & 7 — Done)
- [x] `features/iot/services/deviceGatewayAdapter` — `LiveDeviceSyncAdapter` WS/MQTT/CF routing & bounded sim log (Phases 1 & 8 — Done)
- [x] `features/iot/hooks/useIoTStore` + `createConfigSlice` + `buildEspConfig` — hydration, live SSOT preservation, serialized writes (Phases 1 & 9 — Done)
- [x] `features/iot/hooks/achaemenidState/usePinOperations` — optimistic rollback on failure/exception (Phases 2–4 — Done)

## CI Gates
- **Primary gate:** `npm run check` (`npm run lint && npm run typecheck && npm run test`)
- **Static export verification:** `npm run build` (`NODE_ENV=production next build`)
