# Technical Debt

## Debt Ledger
| Item | Location | Type | Risk | Effort | Priority | Status |
|---|---|---|---|---|---|---|
| Oxlint Anti-Slop findings in existing application code | `app/`, `components/`, `features/`, `lib/` | Static-analysis cleanup backlog | Medium | M | P2 | 157 findings reported on 390 files with 115 rules (17 Nov 2026); Biome and typecheck pass. Oxlint remains diagnostic-only until findings are triaged; do not bulk autofix. |
| Duplicated single-pin rollback closure + missing rollback in `executeBatchPinUpdate` catch block | `features/iot/hooks/achaemenidState/usePinOperations.ts` | Bug / Duplication | High | S | P0 | Resolved (Phase 2–3) |
| Shallow pass-through wrapper (`pinSyncUtils.ts`) over `defaultDeviceSyncGateway` | `features/iot/hooks/achaemenidState/core/pinSyncUtils.ts` | Shallow module | Medium | S | P1 | Resolved & deleted (Phase 4) |
| 3 empty `catch {}` blocks swallowing speech/clipboard errors silently | `VoiceCommandButton/useVoiceCommandHandler.ts`, `hooks/useVoiceCommand.ts` | Broken window | Low | XS | P1 | Resolved (Phase 2) |
| `LiveDeviceSyncAdapter` duplicated WS/MQTT/CF/Toast flow and imported `useIoTStore` directly | `features/iot/services/deviceGatewayAdapter.ts` | Duplication / Boundary | High | M | P1 | Resolved (Phases 4–5) |
| `mqtt/client.ts`, `mqtt/init.ts`, `deviceGatewayAdapter.ts` depended directly on React Zustand hook `useIoTStore` | `features/iot/services/*` | Dependency inversion | Medium | M | P2 | Resolved via `storeBridge.ts` (Phase 5) |
| Duplicated `DEFAULT_DEVICE_INFO` & `"1.2.0"` schema version across mappers and `buildEspConfig` | `cloudflare/mappers.ts`, `core/buildEspConfig.ts` | Duplicated knowledge | Medium | S | P1 | Resolved via `config/defaults.ts` (Phase 6) |
| Unbounded `fetch()` calls (Archive.org) & `AbortSignal.timeout` without WebView fallback + no Circuit Breaker / Retry+Jitter on Cloudflare | `lib/audio/{playlist,AmbientManager}.ts`, `cloudflare/api.ts` | Reliability | High | M | P0 | Resolved via `lib/resilience.ts` (Phase 7) |
| Fixed 5000ms WS reconnect loop & unbounded `pendingStateUpdates` / `dispatchLog` | `useConnectionStrategy.ts`, `mqtt/init.ts`, `deviceGatewayAdapter.ts` | Reliability / Sizing | Medium | S | P1 | Resolved (Phases 7–8) |
| Overlapping `persistStoreConfigToCloudflare` saves could overwrite KV out-of-order; `applyEspConfig` overwrote live ESP32 `pinsState` with KV snapshot | `core/buildEspConfig.ts`, `createConfigSlice.ts` | Concurrency / Consistency | High | M | P0 | Resolved (Phase 9) |
| Long functions/hooks & `useAutomationActions` blind `segments[0]` selection | `useSegmentManagement.ts`, `useWorkflowRuntime.ts`, `useVoiceCommand.ts`, `useAutomationActions.ts` | Complexity / Bug | Medium | M | P2 | Resolved (Phases 2–3) |

## Smell Inventory
| Smell | Location | Refactoring | Status |
|---|---|---|---|
| Inline MQTT frame byte packing & payload parsing coupled to socket/store | `mqtt/{pinPublishers,segmentPublishers,messageParser}.ts` | Extract pure `build*Frame` & `parseMqtt*Message` (Phase 1) | Done |
| Duplicated optimistic pin rollback + silent catch failure | `usePinOperations.ts` | Extract `rollbackSinglePinState` & `rollbackBatchPinState` | Done |
| Duplicated random segment ID generation & monolithic `handleAddSegment` | `useSegmentManagement.ts` | Extract `createSegmentId` & `ensureGroupRegistered` | Done |
| Inline SpeechRecognition setup & empty catch blocks | `useVoiceCommand.ts`, `useVoiceCommandHandler.ts` | Extract helpers + log diagnostics via `debugLog` | Done |
| Long reactive effect + duplicated pulse-clear timeout | `useWorkflowRuntime.ts` | Extract `pruneStaleTimerLatches`, `buildWorkflowNodeMap`, `schedulePulseClear` | Done |
| Shallow wrapper `pinSyncUtils.ts` | `achaemenidState/core/pinSyncUtils.ts` | Deleted; depend on `IDeviceSyncPort` directly | Done |
| Duplicated WS/MQTT/CF toast orchestration | `deviceGatewayAdapter.ts` | Extract `dispatchHardwareCommand`, `persistToCloudflareWithToast`, `notifyIfOffline` | Done |

## Sprout / Wrap Register
- `lib/resilience.ts`: Fresh production-hardening module wrapping outbound fetch calls (`cloudflare/api.ts`, `lib/audio/{playlist,AmbientManager}.ts`) and WS reconnect backoff (`useConnectionStrategy.ts`).
- `features/iot/services/storeBridge.ts`: Dependency inversion bridge decoupling `features/iot/services/*` from React/Zustand hooks.
- `features/iot/services/mqtt/messageParser.ts`: Extracted pure wire protocol decoder invoked by `mqtt/init.ts`.
- `features/iot/hooks/achaemenidState/core/{segmentOperations.ts,cloudflareSyncCoordinator.ts}`: Pure segment/group planning and dependency-injected Cloudflare init/push state coordinators extracted from React hooks.
- `features/iot/components/workflows/workflowRuntimeHelpers.ts` & `features/iot/hooks/voiceRecognitionHelpers.ts`: Headless workflow action/timer edge dispatchers and SpeechRecognition session guards decoupled from React effect hooks.
- `MqttSettingsDeps`, `PublishMqttCommandDeps`, `StateUpdateQueueDeps`, `LocalWebSocketControllerDeps`, `CanvasStorageLike`, `AmbientManagerDeps`, `SoundManagerDeps`: Minimal parameter/constructor seams breaking global browser, broker, socket, and audio dependencies for deterministic Node testing.

## Debt Budget & Broken-Windows Policy
- **Iteration Budget:** Allocate 15–20% of every feature cycle to keeping tests green, removing shallow wrappers, and closing ledger items before shipping new UI or firmware protocol extensions.
- **Zero Broken-Windows Rule:**
  1. No empty `catch {}` blocks anywhere in `app/`, `components/`, `features/`, or `lib/` — handle or log via `debugLog`.
  2. No new `: any` / `as any` type escapes; maintain Biome & `tsc --noEmit` at 0 warnings/errors.
  3. Every external network call (`fetch`, WebSocket reconnect) must declare an explicit timeout and bounded failure behavior.
  4. Never re-introduce direct `useIoTStore` hook imports inside `features/iot/services/*`.

## Adopted Conventions
- Biome formatting (`indentWidth: 2`, `lineWidth: 100`, organized imports), strict TypeScript, Dependency Inversion via `ports.ts` & `storeBridge.ts`, single canonical config defaults in `features/iot/services/config/defaults.ts`, and mandatory verification via `npm run check` (`lint` + `typecheck` + `test`) and `npm run build`.


## Current modernization follow-ups (November 2026)

| Item | Location | Type | Risk | Effort | Priority | Status |
|---|---|---|---|---|---|---|
| Two deterministic MQTT binary-frame expectations fail after the TypeScript 7 test-loader compatibility fix | `features/iot/services/mqtt/messageParser.ts`, existing MQTT tests | Protocol regression / test mismatch | High | M | P0 | Open; owner-led device/protocol verification; no new tests being authored |
| Three unused runtime dependencies and an unreferenced QueryProvider | `package.json`, `components/QueryProvider.tsx` | Dependency / dead code | Low | S | P2 | Removed on `chore/dependency-audit-cleanup`; lockfile regenerated with Bun |
| Knip reports unused exports, types and files | Application modules | Dead-code candidates / possible public API | Medium | M | P2 | Open; inspect ownership and dynamic imports before removing anything |
| Oxlint CLI/configuration is not wired into scripts or workflows; config points to a missing plugin entrypoint | `.oxlintrc.json`, `package.json`, `tools/oxlint/anti-slop/` | Stale tooling configuration | Low | S | P2 | Open; decide whether to repair and activate Oxlint or remove the orphaned setup |
| Experimental workspace-transition E2E work | PR #9 / `tests/e2e/workspace-transitions.spec.mjs` | Deferred verification | Low | S | P3 | PR #9 closed without merge; new E2E authoring is out of scope; owner performs manual UI verification |
| Stale optimization entries for removed legacy dnd-kit packages | `next.config.ts` | Obsolete configuration | Low | XS | P2 | Resolved and merged in PR #10 |
