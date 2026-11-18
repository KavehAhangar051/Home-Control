# Testing

## Test Strategy
- **Pyramid:** Fast deterministic unit & boundary contract tests run natively in Node (`node --import ./tests/ts-loader.mjs --test tests/*.test.mjs`), covering domain logic (pin validation, voice fuzzy matching, workflow graph evaluation, canvas geometry, easing specs), wire protocols (Cloudflare mappers, MQTT binary encoders & JSON/binary decoders), HTTP gateways (Cloudflare API client, Archive.org playlist resolver), multi-transport orchestration (`LiveDeviceSyncAdapter`, `InMemoryDeviceSyncAdapter`), store reducers (`useIoTStore` + `applyEspConfig`), resilience primitives (`CircuitBreaker`, `retryWithBackoff`, `createTimeoutSignal`, RED metrics), and concurrency/consistency invariants (monotonic KV saves, live ESP32 SSOT priority, batch catch rollback).
- **Tooling:** Node built-in `node:test` + `node:assert/strict` with custom TypeScript path-alias loader (`tests/ts-loader.mjs`), paired with Biome (`bun run lint`), TypeScript (`bun run typecheck`), and Next.js static export (`bun run build`).
- **Verification policy:** lint, typecheck, deterministic tests, browser E2E, static export and deployment are reported separately. Tests remain diagnostic/regression coverage and are not a mandatory production-build gate.

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
- **Primary gate:** `bun run check` (`bun run lint && bun run typecheck && bun run test`)
- **Static export verification:** `bun run build` (`NODE_ENV=production next build`)


## Current verification status (Pre-Optimization Baseline)

The following is a recorded snapshot, not a claim that every check is currently green:

- The TypeScript 7 test-loader incompatibility was addressed by using `@typescript/typescript6` for the legacy `transpileModule` API while retaining TypeScript 7 for project type-checking.
- `bun run lint` (Biome over 393 files) and `bun run typecheck` (`tsc --noEmit`) pass with 0 errors.
- On the baseline before this cycle's runtime performance work, the deterministic suite (`bun run test`) reported **68 passing and 3 failing tests (71 total across 18 suites)**. The three pre-existing failures are:
  1. `tests/safety-net.test.mjs` (`parses binary 0x06 pin frames...`): expects `{ kind: "pin_update", source: "binary" }`, while `parseMqttStateMessage` currently ignores legacy `0x06` binary frames (`{ kind: "ignored" }`).
  2. `tests/legacy-seams.test.mjs` (`handles MQTT connect/message lifecycle...`): fails for the same legacy `0x06` binary frame expectation.
  3. `tests/legacy-seams.test.mjs` (`bounds pending pin update queue...`): expects `1` cancelled animation frame, whereas `createStateUpdateQueue` (updated in `4f2a017`) now cancels the pending rAF on every manual flush, yielding `3` cancellations across two manual flushes plus `clear()`.
- Keep these diagnostic expectations visible; do not delete tests or silently skip known failures until firmware/protocol and queue expectations are intentionally reconciled.
- The Workspace View Transition Playwright experiment is tracked in [PR #9](https://github.com/KavehAhangar051/Home-Control-Dashboard/pull/9) and was closed without merging.
- GitHub Actions workflows use `ubuntu-26.04`. Do not wait for the Pages deployment workflow to finish before continuing development.

## Verification reporting rules

Report lint, typecheck, deterministic tests, browser verification, static export, and Pages deployment as separate results. Never claim the whole suite is green while known failures remain; report new decoupled unit-test suites explicitly alongside pre-existing suite counts.

## Modernization & Analyzer Snapshot

- **Pre-optimization baseline:** **7,411** Turbopack graph records, **58** homepage (`/`) client JS outputs totaling **2,880,282 B raw / 1,164,449 B compressed** (`391,958 B raw / 181,162 B compressed` for Motion client JS parts on `/`; `488,272 B raw / 234,570 B compressed` across full-route Motion accounting).
- **Reverted `motion/react-m` experiment (18 Nov 2026):** Migrating 80 modules from `motion/react` to `motion/react-m` grew the homepage graph by **+23,137 raw / +10,134 compressed bytes** and five extra chunks; reverted in favor of keeping `motion/react` with async `LazyMotion` (`domMax`).
- **Post-optimization snapshot (Adaptive 60 FPS & Coalesced Gestures):** **7,415** graph records (+4), **58** homepage (`/`) client JS outputs (0 extra chunks), totaling **2,890,766 B raw (+10,484 B) / 1,168,296 B compressed (+3,847 B)** for `lib/performanceTier.ts`, `lib/hooks/use-performance-tier.ts`, and rAF-coalesced interaction/viewport modules.
- **Deterministic tests after edits:** `tests/performance-tier.test.mjs` (**5/5** tests across 2 suites passing) + `tests/domain-contracts.test.mjs` (**34/34** passing). Full `bun run test` suite runs **76 tests across 20 suites: 73 passing, 3 pre-existing failing** (only the two legacy `0x06` MQTT binary frame expectations and the `createStateUpdateQueue` rAF cancellation count mismatch documented above).
- **Live browser verification (`playwright-cli`, headless Chromium 1440x900 & 390x844):** Verified `perfTier="full"` after warmup with ~`16.6–16.8 ms` steady-state rAF cadence, `30 FPS` -> `data-perf-tier="lite"` and `60 FPS` -> `data-perf-tier="full"` live switching in Settings → پایداری, zero horizontal overflow on mobile `390x844`, `0` synchronous `localStorage` writes during Canvas and Workflow Studio mousewheel zoom bursts (1 debounced commit after release), and imperative `--drag-tilt` compositor rotation during node drags with persistence committed only on `pointerup`.
