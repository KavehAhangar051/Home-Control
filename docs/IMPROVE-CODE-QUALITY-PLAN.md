# Improve Code Quality Plan

## Context
- **Date started:** 2026-11-15
- **Date completed:** 2026-11-15
- **Project:** `Home-Control-Dashboard` — browser-based static-export Next.js 15 / React 19 / TypeScript dashboard communicating with ESP32 devices over MQTT (`wss://`), Capacitor Local WebSocket (`ws://<ip>:81`), and Cloudflare Workers/Durable Objects (`/config`, `/pins/:pin`, `/pins/batch`).
- **Intake Summary:**
  - **Starting scope:** Whole codebase (`features/iot`, `features/dashboard`, `features/settings`, `components/MasterHeader`, `lib/audio`, `lib/resilience`).
  - **Production status:** Active household IoT control deployment + GitHub Pages static export; must preserve exact ESP32 binary/JSON wire protocols, static-export constraints (`output: "export"`, no `app/api/*`), and clean Persian UI (no UI telemetry/status clutter).
  - **Target load:** 1–10 DAU, ~0.001–0.05 avg QPS, ~1–10 burst ops/sec (macro/workflow scenes), `localStorage` client footprint < 200 KB.
  - **Gate criteria:** `npm run check` (`biome lint`, `tsc --noEmit`, `node --test tests/*.test.mjs`) and `npm run build` (`NODE_ENV=production next build`).

## Phase Status
| Phase | Skill | Status | Artifact | Date |
|---|---|---|---|---|
| 1 — Build the safety net | working-with-legacy-code | done | TESTING.md + TECH-DEBT.md (GATE) | 2026-11-15 |
| 2 — Make the code readable | clean-code | done | TECH-DEBT.md | 2026-11-15 |
| 3 — Apply named refactorings | refactoring-patterns | done | TECH-DEBT.md | 2026-11-15 |
| 4 — Reduce complexity | software-design-philosophy | done | TECH-DEBT.md | 2026-11-15 |
| 5 — Draw the architecture boundary | clean-architecture | done | ARCHITECTURE.md | 2026-11-15 |
| 6 — Lock in the habits | pragmatic-programmer | done | TECH-DEBT.md | 2026-11-15 |
| 7 — Make it survive production | release-it | done | RELIABILITY.md | 2026-11-15 |
| 8 — Size for real load | system-design | done | ARCHITECTURE.md + RELIABILITY.md | 2026-11-15 |
| 9 — Get the data layer right | ddia-systems | done | ARCHITECTURE.md | 2026-11-15 |
| Optional — Domain language | domain-driven-design | skipped: domain vocabulary already aligned across ESP32 & Persian UI | ARCHITECTURE.md | 2026-11-15 |
Statuses: pending · in-progress · awaiting-evidence · done · deferred: <reason> · skipped: <reason>

## Key Decisions
| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-11-15 | 1 | Build minimal constructor/parameter injection seams (`LiveDeviceSyncAdapter`, `cloudflare/api`, `audio/playlist`) and pure frame builders/parsers (`pinPublishers`, `segmentPublishers`, `messageParser`) | Unlocks fast deterministic Node contract tests without changing runtime behavior (44 baseline+safety-net tests passing before refactors) |
| 2026-11-15 | 2–3 | Extract `rollbackSinglePinState` / `rollbackBatchPinState`, fix missing batch catch rollback, remove 3 empty `catch {}` blocks, fix `useAutomationActions` pin fallback, and decompose `useSegmentManagement` / `useVoiceCommand` / `useWorkflowRuntime` | Eliminates silent failure paths, duplication, and complex monolithic effects |
| 2026-11-15 | 4 | Delete shallow `pinSyncUtils.ts` wrapper & consolidate `LiveDeviceSyncAdapter` WS/MQTT/CF dispatch helpers | Reduces module shallowness and duplicated transport orchestration |
| 2026-11-15 | 5 | Add `storeBridge.ts` registered at composition root (`useIoTStore.ts`) and remove all direct `useIoTStore` imports from `features/iot/services/*` | Enforces Clean Architecture Dependency Rule across service/adapter boundaries |
| 2026-11-15 | 6 | Centralize `CANONICAL_CONFIG_VERSION` & `DEFAULT_DEVICE_INFO` in `config/defaults.ts` | Establishes Single Source of Truth across mappers and snapshot builders |
| 2026-11-15 | 7–8 | Add `lib/resilience.ts` (`createTimeoutSignal`, `CircuitBreaker`, `retryWithBackoff`, RED metrics), LocalWS jitter backoff, and bounded queues/logs (`MAX_PENDING_PIN_UPDATES = 256`, `MAX_DISPATCH_LOG_ENTRIES = 500`) | Prevents hanging WebView fetches, retry storms, and unbounded memory accumulation |
| 2026-11-15 | 9 | Serialize `persistStoreConfigToCloudflare` through a monotonic queue and preserve live `pinsState` in `applyEspConfig` | Eliminates out-of-order KV lost-update races and prevents stale KV snapshots from overwriting ESP32 RAM SSOT |

## Exit Checklist
- [x] Every applicable phase status recorded (`done` or `skipped` with rationale).
- [x] `docs/TESTING.md` Safety Net Map verified green via `npm run check`.
- [x] `docs/TECH-DEBT.md` Debt Ledger items resolved and Broken-Windows Policy recorded.
- [x] `docs/ARCHITECTURE.md` captures Layer Map, Decision Log, System Sizing, and DDIA Data Decisions.
- [x] `docs/RELIABILITY.md` records Timeouts, Circuit Breakers, Retries+Jitter, Bounded Queues, and RED Metrics.

## Next Actions
- [x] Verify `npm run format`, `npm run check`, and `npm run build` pass with zero errors (engineering, 2026-11-15)
