# Testing

## Policy: High-Signal Domain/Protocol Tests Only (No UI or Throwaway Tests)

- **What belongs in `tests/`:** Only deterministic, high-signal tests covering hardware/wire protocols (ESP32 GPIO validation, MQTT binary/JSON frames, Local WS controller), Cloudflare sync & mappers, Zustand state/rollback invariants, workflow graph evaluation, automation scheduling/validation, and voice command matching.
- **What is strictly prohibited:** Do **not** write or keep temporary, throwaway, or UI-detail unit tests (such as Tailwind/CSS class merging, pixel-grid geometry, animation easing/FPS tiers, icon chunk loaders, DnD layout indices, or component visual layout assertions).
- **When to author new tests:** Do not add new tests as routine work unless the project owner explicitly requests them for critical domain or protocol logic.
- **Mandatory doc sync:** Whenever code or tests change, update `docs/TESTING.md` (along with `ARCHITECTURE.md` / `DESIGN.md`) immediately so documentation stays accurate and trustworthy.
- **Temp cleanup:** Delete temporary verification outputs (such as temporary screenshots and logs) before completing a task.

## Tooling & Verification Policy

- **Runner:** Node built-in `node:test` + `node:assert/strict` with custom TypeScript path-alias loader (`tests/ts-loader.mjs`, using `@typescript/typescript6` for legacy `transpileModule` compatibility while the app compiles with TypeScript 7).
- **Command:** `bun run test` (`node --import ./tests/ts-loader.mjs --test tests/*.test.mjs`).
- **Verification reporting:** Report `bun run lint`, `bun run typecheck`, `bun run test`, browser verification, and `bun run build` separately. Tests remain a diagnostic/regression suite rather than a mandatory production-build gate.

## Current Test Inventory (`tests/*.test.mjs`)

| Test file | Covered core logic |
|---|---|
| `tests/domain-contracts.test.mjs` | ESP32 GPIO pin validation (`pinValidation.ts`), Persian voice command matching & macro unfolding (`VoiceCommandButton/utils.ts`), Cloudflare/ESP32 config serialization (`buildEspConfig.ts`, `mappers.ts`), `InMemoryDeviceSyncAdapter`, workflow graph & schedule evaluation (`workflowEngine.ts`), automation draft validation (`useAutomationForm.ts`). |
| `tests/safety-net.test.mjs` | MQTT binary encoders & incoming state/status parsers (`pinPublishers.ts`, `segmentPublishers.ts`, `messageParser.ts`), Cloudflare Worker URL/API client (`config.ts`, `api.ts`), `LiveDeviceSyncAdapter` routing, `useIoTStore` + `applyEspConfig` SSOT hydration, optimistic pin rollback (`usePinOperations.ts`), `CircuitBreaker` / `retryWithBackoff` / timeout signals (`lib/resilience.ts`), local WS client, Archive playlist resolver. |
| `tests/legacy-seams.test.mjs` | MQTT client settings/publish/connect/state queue (`mqtt/client.ts`, `mqtt/init.ts`), Local WS reconnect controller (`useConnectionStrategy.ts`), segment/group operations & Cloudflare init/push coordinator (`segmentOperations.ts`, `cloudflareSyncCoordinator.ts`), automation form/actions, workflow runtime timer latch & action dedup (`workflowRuntimeHelpers.ts`), `SpeechRecognition` session lifecycle (`voiceRecognitionHelpers.ts`). |
| `tests/mqtt-resilience.test.mjs` | Tab-wake & network-online MQTT resume/reconnect controller with cooldown (`createMqttResumeController`). |
| `tests/mqtt-rule-frame.test.mjs` | Input GPIO binary rule frame encoding & range validation (`buildUpdateRuleFrame`). |
| `tests/mqtt-state-sync.test.mjs` | `state_sync` snapshot and output remaining-timer normalization (`parseMqttStateMessage`). |
| `tests/swr-sync.test.mjs` | Cloudflare Stale-While-Revalidate (SWR) local cache boot, signature dedup, and offline cache recovery (`executeCloudflareInitSync`). |

## Removed UI / Temporary Tests (19 November 2026)

The following UI-focused and temporary tests were removed to keep the suite lean and meaningful:

- Deleted files: `tests/mobile-dock.test.mjs`, `tests/lazy-icons.test.mjs`, `tests/performance-tier.test.mjs`, `tests/dynamic-retry.test.mjs`, and temporary capture artifacts.
- Removed UI-only test blocks from `tests/domain-contracts.test.mjs` and `tests/legacy-seams.test.mjs` (Motion easing, Canvas 16px pixel geometry/storage, drag-tilt/magnetic snapping, ANSI icon mapping, Tailwind `cn()`, CSS `clamp()` typography, tile density, DnD drag-over indices, Trellis layout/menus, Persian date/font strings, and Audio UI mocks).

## Current Diagnostic Status (19 November 2026)

- `bun run lint` (Biome) and `bun run typecheck` (`tsc --noEmit`) pass with **0 errors**.
- `bun run test` currently runs **64 tests across 19 suites: 59 passing, 5 pre-existing diagnostic failures**:
  1. `tests/safety-net.test.mjs` (`encodes add_segment, delete_segment, and update_rule binary frames`): passes legacy string ID `"in_1"` into `buildUpdateRuleFrame`, which now requires a numeric input GPIO.
  2. `tests/safety-net.test.mjs` (`parses binary 0x06 pin frames...`): expects `{ kind: "pin_update", source: "binary" }`, while `parseMqttStateMessage` currently returns `{ kind: "ignored" }` for legacy `0x06` binary frames.
  3. `tests/legacy-seams.test.mjs` (`handles MQTT connect/message lifecycle...`): fails on the same legacy `0x06` binary frame expectation.
  4. `tests/legacy-seams.test.mjs` (`bounds pending pin update queue...`): expects `1` cancelled animation frame, whereas `createStateUpdateQueue` now cancels pending rAF on every manual flush as well as `clear()`.
  5. `tests/mqtt-rule-frame.test.mjs` (`encodes HIGH and LOW actions after the input GPIO`): byte layout mismatch against current `buildUpdateRuleFrame` output.

Never claim the entire `bun run test` suite is green while these known hardware/protocol mismatches remain unresolved.
