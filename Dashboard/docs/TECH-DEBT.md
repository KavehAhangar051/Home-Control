# Technical Debt

## Debt Ledger
| Item | Location | Type | Risk | Effort | Priority | Status |
|---|---|---|---|---|---|---|
| Verbose MQTT state-message logs ran on every received pin update in production | `features/iot/services/mqtt/{init,client}.ts` | Hot-path diagnostic overhead | Low | XS | P2 | Resolved in `perf/gate-mqtt-verbose-logs`: informational logs are development-only; warnings and errors remain enabled |
| Bundle composition had no recorded baseline | `docs/performance/BUNDLE-BASELINE-2026-11-17.md` | Performance observability gap | Medium | S | P1 | Resolved: first Turbopack snapshot captured and documented; future relevant main pushes upload named snapshots automatically |
| Sortable DnD runtime was imported by the global dashboard state hook even for Trellis/Canvas workspaces | `features/iot/hooks/useAchaemenidState.ts`, `features/iot/components/workspace/components/DndGridWorkspace.tsx` | Unnecessary client dependency reachability | Medium | S | P1 | Implemented: the after graph confirms the global state hook no longer imports DnD; the static graph still includes the conditional Grid preload path, so verify no DnD request for Trellis/Canvas in a browser |
| `motion/react-m` did not reduce the initial client graph under the current Turbopack build | `components/animate-ui/icons/hugeicons/`, `components/motion/`, `features/`, `components/ui/` | Measured optimization trial | Low | S | P3 | Resolved by measurement: the 80-module migration trial was reverted; homepage graph grew by 23,137 raw / 10,134 compressed bytes and five chunks. Retain existing `motion/react` imports unless a future toolchain comparison demonstrates a win |
| Oxlint Anti-Slop findings in existing application code | `app/`, `components/`, `features/`, `lib/` | Static-analysis cleanup backlog | Medium | M | P2 | 157 findings reported on 390 files with 115 rules (17 Nov 2026); Biome and typecheck pass. Oxlint remains diagnostic-only until findings are triaged; do not bulk autofix. |
| Stale `optimizePackageImports` entries referenced removed packages and a package already optimized by Next.js | `next.config.ts` | Obsolete configuration | Low | XS | P2 | Resolved in `chore/remove-stale-package-optimizations`; remaining entries are installed custom packages only |
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
- Biome formatting (`indentWidth: 2`, `lineWidth: 100`, organized imports), strict TypeScript, Dependency Inversion via `ports.ts` & `storeBridge.ts`, single canonical config defaults in `features/iot/services/config/defaults.ts`, and verification via Bun (`bun run lint`, `bun run typecheck`); existing tests and build are reported separately and are not mandatory build gates.


## Current modernization follow-ups (November 2026)

| Item | Location | Type | Risk | Effort | Priority | Status |
|---|---|---|---|---|---|---|
| Two deterministic MQTT binary-frame expectations fail after the TypeScript 7 test-loader compatibility fix | `features/iot/services/mqtt/messageParser.ts`, existing MQTT tests | Protocol regression / test mismatch | High | M | P0 | Open; owner-led device/protocol verification; no new tests being authored |
| Three unused runtime dependencies and an unreferenced QueryProvider | `package.json`, `components/QueryProvider.tsx` | Dependency / dead code | Low | S | P2 | Resolved and merged in PR #12; Bun lockfile regenerated |
| Knip reports unused files, exports and exported types | Application modules | Dead-code candidates / possible public API | Medium | M | P2 | 17 Nov 2026 PR audit: 11 unused-file candidates, 139 exports, 99 exported types, 9 duplicate exports; zero unused dependencies and zero unresolved imports after tool entry points were added. Review before deleting. |
| Knip previously omitted the vendored Oxlint plugin source from its project graph | `knip.json`, `tools/oxlint/anti-slop/` | Audit configuration gap | Low | XS | P2 | Resolved in `chore/align-tooling-audit-config`: both plugin entry points and the tools source tree are now included; PR audit will confirm the refreshed report |
| Stale optimization entries for removed legacy dnd-kit packages | `next.config.ts` | Obsolete configuration | Low | XS | P2 | Resolved and merged in PR #10 |


## Performance and platform follow-ups — 18 November 2026

| Item | Location | Type | Risk | Effort | Priority | Status |
|---|---|---|---|---|---|---|
| Confirm Grid DnD chunk is not requested in Trellis/Canvas sessions | `DndGridWorkspace`, dashboard workspace loading | Runtime code-splitting verification | Medium | S | P1 | Static graph shows the DnD hook is scoped to Grid, but conditional Grid preloading remains represented in the graph. Needs owner-led browser Network verification. |
| Measure device-state burst responsiveness and Zustand subscription cost | `features/iot/hooks/useIoTStore.ts`, device cards and MQTT state queue | Runtime responsiveness | Medium | M | P1 | Not yet profiled. Establish message-to-UI latency and React commit baseline before changing selectors or batching. |
| Measure workspace switching and workflow/canvas interaction long tasks | Dashboard workspaces, Workflow Studio, Canvas | Main-thread responsiveness | Medium | M | P1 | Not yet profiled. Do not introduce `Activity` or more deferred rendering without a concrete measured use case. |
| Broad `motion/react-m` migration did not improve the tested Turbopack graph | Motion imports and `MotionProvider` | Bundle optimization experiment | Low | S | P2 | Reverted. Homepage client graph increased by 10,134 compressed bytes and five chunks in the trial. Keep existing imports unless a new focused experiment demonstrates a benefit. |
| Tailwind v4 token and CSS duplication audit | `app/globals.css`, component styles | CSS maintainability / bundle | Low | M | P2 | Not yet audited. Existing baseline does not justify a broad CSS rewrite. |
| Base UI primitive coverage and interaction consistency | `components/ui/`, feature dialogs/menus | UI consistency / accessibility | Low | M | P2 | Inventory required before replacing any existing component implementation. |
| Real-user performance evidence is absent | Static dashboard runtime | Observability gap | Medium | M | P2 | Bundle snapshots exist, but they do not measure LCP, INP, CLS, long tasks, or device CPU/network conditions. Establish an appropriate browser/RUM measurement approach before budgets. |


| MQTT queued updates racing full state sync | `features/iot/services/mqtt/init.ts` | State consistency / ordering | Medium | XS | P1 | Resolved on `main` in commit `4f2a017`: flush earlier queued pin updates before applying a full snapshot; manual flush cancels the scheduled animation frame to prevent redundant callbacks (`tests/legacy-seams.test.mjs:191` still asserts the pre-fix cancel count of `1`, bringing deterministic baseline failures to 3/71). |
| Whole-device-state subscriptions causing workspace-wide rerenders | `features/iot/components/canvas/`, `features/iot/components/trellis/` | React render fan-out | Medium | S | P1 | Resolved on `main`: Canvas wires subscribe per pin, Canvas group active counts use a shallow-compared derived selector, Trellis group badges subscribe to the derived active count, and `CanvasWorkspace` no longer subscribes to the entire `pinsState`. |
| Canvas drag and button pan coalesced, but pinch-zoom, wheel zoom, Workflow pan/drag/resize, and `dragTiltDeg` still hit React/storage synchronously | `useSheetViewportGestures.ts`, `useWorkflowStudio.ts`, `useWorkflowInteractions.ts`, `useCanvasNodeInteractions.ts` | Main-thread jank / storage I/O | High | M | P0 | Resolved: coalesced pinch/wheel zoom and Workflow drag/resize to `requestAnimationFrame`, added transient viewport state + debounced storage save (`scheduleIdleStorageWrite`), and updated node drag tilt via CSS variable `--node-drag-tilt-deg` without React re-renders. |
| `animationsFps` (`30 \| 60`) UI setting persisted to Zustand/ESP32 but unwired in frontend rendering; no adaptive frame-drop tiering | `createAestheticSlice.ts`, `AnimationsToggle.tsx`, `CanvasWiresLayer.tsx`, `WorkflowEdgeItem.tsx`, `action-swap-variants.ts`, `backdrop-blur` overlays | GPU fillrate / unwired capability | High | M | P1 | Resolved: wired `animationsFps` and `animationsEnabled` directly to `html[data-perf-tier="full" \| "lite"]` in `usePerformanceTierObserver` (zero idle polling), stepping down blur filters on weak settings while preserving springs/transforms at 60 FPS. |
| `ThemeToggle` calls `document.body.offsetHeight` (forced synchronous layout reflow), and background tabs keep infinite CSS marquee/spark/dash loops running | `components/motion/theme-toggle.tsx`, `features/iot/hooks/usePageVisibility.ts`, `app/globals.css` | Layout thrashing & idle CPU/GPU | Medium | XS | P1 | Resolved: removed forced `offsetHeight` reflow flush from `ThemeToggle` and paused infinite CSS animations via `html[data-page-hidden="true"]` in `usePageVisibility`. |
| Establish frame-time and dropped-frame baseline across Chromium desktop and throttled mobile viewports | `docs/performance/60-FPS-STRATEGY.md`, live browser verification | Animation smoothness & RUM gap | Medium | M | P1 | Open — live Chromium verification scheduled in current cycle after runtime optimizations land. |
| Capacitor Android asset build collision with web pre-compression `.gz`/`.br` sidecars | `package.json`, `scripts/compress-export.mjs` | Native Android build failure | High | XS | P1 | Resolved: `android:apk` sets `CAPACITOR_BUILD=true` to automatically prune `.gz`/`.br` files from `out/` via `removeCompressedSidecars()` before asset sync. |
| Agent tooling missing local LLM offline support & health checking | `tools/ov.sh`, `tools/agent-bridge.py` | Agent toolchain resilience | Low | S | P2 | Resolved: integrated local `Ollama` into OpenViking (`ov.sh ollama`), added automatic background service recovery in `start_session`, and verified in `tools:check`. |
