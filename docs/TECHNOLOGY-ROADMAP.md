# Technology Refresh and Engineering Direction

**Status:** Active engineering direction  
**Last reviewed:** 23 November 2026

## Product direction

Home Control Dashboard is a browser-based, responsive control surface for ESP32 home automation. The next stage is not a framework rewrite. It is a measured modernization of the existing stack, with a focus on a fast, reliable, accessible and maintainable control experience.

The dashboard should evolve in this order:

1. **Reliability first:** preserve device protocol compatibility, connection lifecycle correctness, bounded queues, clear pending/error states, and recovery behavior.
2. **Fast interaction:** reduce initial JavaScript and unnecessary work on the main thread; keep navigation, device controls and automation editing responsive.
3. **Consistent UI/UX:** use shared design tokens and existing UI primitives; improve keyboard, touch, narrow-screen and reduced-motion behavior.
4. **Modern platform capabilities:** adopt stable React, Next.js, CSS and browser APIs when they solve a demonstrated product need.
5. **Maintainability:** keep feature boundaries clear, remove obsolete configuration and dependencies when evidence supports removal, and document architectural decisions.

## Current stack snapshot

Versions below are read from the repository's committed `bun.lock` at the time of review. They are installed versions, not a guarantee that every package is the newest available release.

| Technology | Locked version | Current usage / note |
|---|---:|---|
| Next.js | 16.4.6 | App Router, static export, Turbopack |
| React / React DOM | 19.3.1 | React Compiler enabled; View Transition experiment in workspace navigation |
| TypeScript | 7.0.2 | Main type checker/compiler |
| TypeScript compatibility API | 6.0.2 | Test-loader-only compiler API compatibility |
| Tailwind CSS | 4.3.5 | CSS-first configuration and design tokens |
| Motion | 14.14.0 | LazyMotion and AnimateView integration |
| Base UI | 1.9.0 | Existing accessible primitives in selected controls |
| dnd-kit React / DOM | 0.5.3 | Current drag-and-drop API |
| Zustand | 5.1.0 | Client-side domain and workspace state |
| MQTT.js | 5.16.1 | Browser MQTT transport |
| Biome | 2.6.8 | Linting and formatting; schema URL aligned with this locked version |

Re-check the lockfile before every dependency update. Do not copy this table as a current version report after packages change.

## Lessons captured from recent work

### Dependency migrations

- The old dnd-kit packages were replaced with `@dnd-kit/react` and `@dnd-kit/dom`. Preserve the established group/segment/trash behavior and interaction thresholds when changing this area.
- Remove stale configuration references when a package migration is complete. The obsolete dnd-kit `optimizePackageImports` entries were removed and merged in PR #10.
- TypeScript 7 remains the application compiler. The test loader uses `@typescript/typescript6` because it needs the legacy JavaScript compiler API. Keep this compatibility dependency scoped to testing.

### React and animation

- React Compiler is already enabled. Manual `memo`, `useMemo` and `useCallback` additions should be justified by profiling or semantics, not habit.
- Workspace transitions use `useDeferredValue` over the Zustand-selected view and Motion's `AnimateView`, which is built on React's native `ViewTransition`. Do not assume wrapping an external-store update in `startTransition` makes it non-blocking.
- Respect both the app animation setting and `prefers-reduced-motion`.
- Browser E2E automation tools are not used in this workflow; the project owner performs hands-on UI verification.

### Testing and verification

- The deterministic Node suite is valuable for protocol, state, resilience and concurrency contracts, but the recorded post-loader-fix result was 69/71 because of two MQTT binary-frame expectations.
- Keep these tests. Diagnose the two MQTT failures instead of weakening assertions or deleting coverage.
- Report lint and typecheck separately. Existing tests remain diagnostic; new test authoring is not part of routine work unless explicitly requested. The project owner performs hands-on UI/device verification.
- Tests are diagnostic/regression tooling, not a required production build gate per the project owner's direction. Do not wait for GitHub Pages deployment to continue engineering work.

### Performance discipline

- Follow the repository performance skill: measure first, identify the bottleneck, make a targeted change, measure again, and retain the change only when evidence supports it.
- Use bundle analysis, browser performance traces and representative device-interaction flows before proposing broad code splitting, memoization or library replacement.
- Avoid replacing dependencies solely because a newer major version exists. Evaluate API compatibility, bundle impact, maintenance status and actual feature use.

## Roadmap

### Phase A — establish a trustworthy baseline

- [x] Run the Knip dependency audit and record unused dependency candidates (17 Nov 2026).
- [x] Include the custom Oxlint plugin entry points and `tools/` source in Knip's project graph to avoid false unused-dependency reports.
- [x] Re-run Knip after correcting its graph: 11 unused-file candidates, 139 exports, 99 exported types, 9 duplicate exports, no unused dependencies, and no unresolved imports.
- [ ] Investigate the two known MQTT binary-frame test failures and add/adjust tests only when the expected protocol behavior is confirmed.
- [x] Capture and document the first Turbopack client/server bundle baseline from the named `before` snapshot (17 Nov 2026); see [Bundle Analysis Baseline](performance/BUNDLE-BASELINE-2026-11-17.md). The report identifies the MQTT runtime as async and the sortable DnD hook as an unnecessary eager dependency of the dashboard state hook.
- [x] Inventory direct dependencies and locked resolutions; review the first Knip report.
- [ ] Review unused exports/files without bulk-deleting public or feature APIs.
- [x] Align the Biome JSON schema with the locked 2.6.8 release; the existing semver range already resolves to this version in `bun.lock`.

### Phase B — update dependencies deliberately

- [x] Compare every direct dependency with its latest stable release and compatibility requirements (18 Nov 2026); all committed lockfile resolutions are current, so no version-only update was justified. See [Direct Dependency Audit](DEPENDENCY-AUDIT-2026-11-18.md).
- [ ] Group upgrades into small, reviewable changes (patch/minor first; major versions separately).
- [ ] Regenerate and commit `bun.lock` with Bun; never hand-edit lockfile resolutions.
- [ ] Run lint, typecheck and relevant tests after each upgrade batch.
- [x] Remove three confirmed unused runtime dependencies and their unreferenced QueryProvider; regenerate `bun.lock` with Bun.
- [x] Resolve Oxlint plugin visibility and restore the missing Effect plugin rules/helpers; the PR Knip workflow now reports zero unresolved imports.

### Phase C — use platform capabilities where they help

- [x] Complete a targeted React 19.3 API audit: workspace transitions already use React `ViewTransition` through Motion's `AnimateView`; defer `Activity` until preserving hidden workspace/form state is a demonstrated UX requirement and its retained DOM/memory cost is profiled; do not replace canvas callback refs with `useEffectEvent` because those callbacks are invoked from React event handlers, while Effect Events may only be called from Effects or other Effect Events. See [Activity](https://react.dev/reference/react/Activity), [useEffectEvent](https://react.dev/reference/react/useEffectEvent), and [Motion AnimateView](https://motion.dev/docs/react-animate-view).
- [x] Remove stale `optimizePackageImports` entries for removed packages and for `lucide-react`, which Next.js optimizes by default; retain only installed custom entries (`@base-ui/react`, `motion`, `zustand`).
- [x] Provide a repeatable saved-output command for the Next.js 16/Turbopack analyzer (`bun run analyze` → `.next/diagnostics/analyze`).
- [x] Expose named analyzer snapshots and JSONL graph export through `bun run analyze --snapshot <name>` and `bun run analyze:export --snapshot <name>` (Next.js 16.4+).
- [x] Add a GitHub Actions workflow that captures and uploads the JSONL graph and static analyzer report, avoiding local CLI setup for the project owner.
- [x] Move the sortable DnD hook from the global dashboard state hook into the dynamically loaded Grid workspace; the after graph confirms the global state module no longer imports DnD.
- [ ] Verify in a browser Network panel that Trellis and Canvas do not request the DnD chunk; the static graph still includes the conditional Grid preload path.
- [ ] Review Base UI and Motion coverage before introducing overlapping component or animation libraries.
- [x] Evaluate `motion/react-m` against the existing `motion/react` imports in 80 app-facing modules. Reverted the trial after the homepage graph increased by 23,137 raw bytes / 10,134 compressed bytes and five client chunks; a post-revert capture exactly matched the original 61-chunk / 1,164,289-byte compressed baseline. Keep the current imports; revisit only after a relevant Motion/Turbopack change or a more targeted profile.
- [ ] Audit Tailwind v4 CSS output, token consistency and duplicated styling patterns.

### Phase D — improve runtime UX and performance

- [ ] Profile first load, workspace switching, device state bursts and automation editing.
- [x] Gate informational MQTT connection and per-message state logs to development builds; retain warnings and errors in production.
- [x] Reduce unnecessary client bundle and defer non-critical UI (`DeferredPlatformRuntime`, fine-pointer `CustomCursor`, `ScrollToTopButton`, permissions modal, and idle-warmed audio/toasts) until after First Paint (`requestAnimationFrame` + `scheduleIdleTask`).
- [ ] Verify touch, keyboard, responsive and reduced-motion behavior through owner-led manual checks.
- [ ] Add regression budgets only after stable baselines exist.

## Decision rules

- Prefer stable releases over prereleases unless a required capability justifies the risk.
- Prefer the existing stack over adding another library with overlapping responsibilities.
- Do not combine dependency upgrades with unrelated UI redesigns or refactors.
- Keep changes small and independently verifiable.
- Never infer a performance gain from a version number or a smaller source diff; measure it.
- Keep firmware and Cloudflare protocol compatibility as a hard constraint.
- Update this document when a decision is implemented, reversed or superseded.


## Engineering direction — next execution cycle (18 November 2026)

The recent modernization work has established the following baseline:

- The dashboard remains a static-export, browser-first application. Keep device communication in the browser and preserve compatibility with the ESP32 firmware and Cloudflare data contract.
- The old dnd-kit API has been replaced by `@dnd-kit/react` + `@dnd-kit/dom`; sortable behavior is owned by the dynamically loaded Grid workspace rather than global dashboard state.
- MQTT's heavy client is already asynchronously imported. Do not treat its source-module size as initial-load cost without checking the route's async loader graph and actual browser requests.
- Informational per-message MQTT logs are development-only; warnings and errors remain available in production.
- The app already uses React Compiler, Turbopack, `LazyMotion` with async `domMax`, and deferred workspace rendering. These are existing capabilities, not future migration tasks.
- A broad `motion/react-m` migration across 80 app-facing modules was measured and reverted because the homepage client graph became larger in the tested Turbopack output. Do not repeat that migration as a blanket rule. The official Motion guidance is a useful pattern, but actual Next.js output is the acceptance criterion.

### Next phases

#### Phase E — runtime responsiveness and device-state throughput
1. Profile realistic device-state bursts and record message-to-UI latency, update batch size, and main-thread long tasks.
2. Inspect Zustand subscriptions and selectors in device cards, workspace lists, and connection indicators. Reduce subscriptions only where profiling shows excess React work.
3. Review MQTT parsing, queue draining, and `requestAnimationFrame` batching for avoidable allocations or repeated full-state scans. Preserve queue bounds, ordering, reconnect behavior, and wire compatibility.
4. Keep the MQTT transport dynamically loaded and verify its actual network timing rather than optimizing its raw module size.

#### Phase F — workspace and interaction performance
1. Profile first dashboard paint and switching between Grid, Trellis, and Canvas.
2. Verify the DnD chunk is not requested when users stay in Trellis or Canvas; the static graph alone cannot prove runtime network behavior.
3. Evaluate React `Activity`, `useEffectEvent`, and transitions only against a specific lifecycle or responsiveness problem. Do not add them simply because they are new APIs.
4. Inspect expensive workflow-editor interactions, canvas dragging, and sortable-card updates for long tasks and layout thrashing.

#### Phase G — 60 FPS animation and rendering quality
1. Use `docs/performance/60-FPS-STRATEGY.md` as the motion-performance contract: target stable 60 FPS on 60 Hz reference devices and follow higher display refresh rates where available.
2. Audit high-frequency animation properties and prioritize compositor-friendly `transform` and `opacity`; profile blur/filter, shadows, large SVG effects, layout animation, and large View Transition snapshots on low-powered devices.
3. Profile Motion-heavy controls (ActionSwap, ColorPicker, RangeSlider, loaders, theme transition) and common workspace transitions. Keep Motion's async `domMax` because layout and drag features are used.
4. Keep frame callbacks small, avoid synchronous storage/DOM work during animation, and use MotionValues/refs or frame-coalesced updates for high-frequency values.
5. Design adaptive behavior only after measuring sustained frame drops. Preserve essential state feedback, rich transitions where affordable, the dashboard animation setting, and `prefers-reduced-motion`.
6. Do not blanket-migrate to `motion/react-m`; the previous same-environment Turbopack trial increased the homepage graph and was reverted.

#### Phase H — design-system and UI platform consistency
1. Audit Base UI usage and fill gaps with existing primitives before adding another component library.
2. Consolidate Tailwind v4 design tokens and remove duplicated CSS only when the visual result can be preserved.
3. Review SVG/icon rendering, font loading, focus behavior, touch targets, keyboard navigation, and reduced-motion behavior.
4. Keep component semantics and visual consistency while improving rendering efficiency.

#### Phase I — repeatable performance evidence
1. Keep named Turbopack snapshots and compare equivalent commits, routes, environment, and lockfile state.
2. Record browser frame traces, dropped-frame behavior, long tasks, LCP, INP, CLS, and actual chunk requests across an agreed device matrix.
3. Set performance budgets only after stable baselines exist; distinguish 60 Hz targets from 90/120/144 Hz devices.
4. Record both successful and unsuccessful optimization experiments so that reverted work is not repeated.

### Acceptance criteria for optimization work

- A change must solve a measured user-visible or maintainability problem.
- Compare equivalent routes and build environments; distinguish initial, async, server, and client output.
- A smaller source module or a newer package version is not proof of a faster dashboard.
- Preserve ESP32 protocol compatibility, persisted configuration formats, accessibility, reduced motion, and responsive layouts.
- Prefer small direct commits on `main`, with lint/typecheck evidence and an immediate documentation update (`ARCHITECTURE.md`, `DESIGN.md`, `docs/*`) after every code change. Existing tests remain diagnostic; do not write temporary or UI-detail unit tests, and do not add new tests unless the owner requests them.


### Phase E execution log — 18 November 2026

- Fixed an ordering edge case in MQTT state ingestion: incremental pin updates queued for the next animation frame are now flushed before a later full `state_sync` snapshot is applied. This prevents an older queued value from being applied after and overriding the authoritative snapshot.
- A manual queue flush now cancels its pending animation-frame callback before applying the batch, avoiding an unnecessary later empty callback and preventing duplicate frame scheduling after a synchronous flush.
- The queue remains bounded and double-buffered; per-pin updates are still coalesced and the existing callback behavior is preserved.
- This is a correctness/consistency improvement in a real-time path, not a claim of measurable throughput improvement. Verify with lint and typecheck CI; owner performs device-level validation. No new tests were authored.

- Audited Canvas/Trellis state subscriptions and removed broad pinsState subscriptions from CanvasWorkspace, CanvasGroupNode, and TrellisGroupView. Canvas wires now select their own pin state; group containers select only their derived active count. This narrows React update fan-out without changing the Zustand store shape or ESP32 protocol.
- This is a code-structure improvement, not a measured percentage speedup. The next verification is a browser session with multiple devices changing state: confirm unrelated Canvas nodes and Trellis groups do not commit/render, and check frame stability under a burst.

### Phase F execution log — 18 November 2026

- Skipped further Phase E work as requested and moved to workspace/interaction performance.
- Canvas node drag, node resize, and viewport pan now coalesce high-frequency pointer events through `requestAnimationFrame`, applying only the latest event once per frame instead of scheduling React state updates for every raw pointer event.
- Canvas pan uses a transient viewport setter during movement, avoiding synchronous localStorage writes on every animation frame; the final viewport is persisted at gesture end. Workflow Studio reuses the frame-coalesced gesture controller but retains its existing workflow-state persistence semantics.
- Pointer-up applies its final coordinates synchronously; pointer-cancel flushes only the last valid pointer-move event so a cancelled gesture cannot jump to the cancellation coordinates.
- Resize calculations now derive dimensions from the pointer-down rectangle rather than the previous intermediate render, preventing cumulative application of total pointer displacement across successive move events.
- This is a structural interaction improvement; no frame-time or INP gain is claimed without a browser performance trace. Owner-led verification is required for drag, resize, pan, touch, and persisted layout behavior.


### 60 FPS motion direction & audited optimization plan (Current Execution Cycle)

- **Motion architecture clarified (`motion/react` vs `motion/react-m`):** All 134 Motion call sites in `app/`, `components/`, `features/`, and `lib/` already render lightweight `m.*` elements under an async `LazyMotion` (`domMax`) root provider in `MotionProvider.tsx` — zero files import the monolithic `motion` proxy. The 18 Nov 2026 80-module migration trial to `motion/react-m` was measured against Next.js 16.4.6/Turbopack and **reverted** after increasing homepage (`/`) client output by **+23,137 raw / +10,134 compressed bytes** and five extra chunks (`optimizePackageImports: ["motion"]` already tree-shakes the `motion/react` entry efficiently in Turbopack). Pre-optimization Turbopack snapshot baseline stands at **2,880,282 B raw / 1,164,449 B compressed** across **58** homepage client JS outputs (Motion contribution: **488,272 B raw / 234,570 B compressed**).
- **Current direction — extract full capability from the existing stack for consistent 60 FPS across weak & strong devices while preserving rich animations:**
  1. **Zero-jank Canvas & Workflow gestures:** Coalesce 2-finger pinch-zoom and wheel zoom via `requestAnimationFrame` + transient state (`useSheetViewportGestures.ts`), isolate `useWorkflowStudio` pan/zoom viewport updates from per-frame `localStorage` serialization via debounced commit + gesture-end flush, rAF-coalesce Workflow drag/resize (`useWorkflowInteractions.ts`), and move high-frequency `dragTiltDeg` updates out of React parent re-renders into CSS `--drag-tilt` compositor transforms.
  2. **Adaptive 60 FPS tiering + live `animationsFps` wiring:** Wire the already-present Settings `animationsFps` (`30 | 60`) control and a pure sliding-window frame-drop + hardware heuristic controller (`lib/performanceTier.ts`) to `html[data-perf-tier="full" | "lite"]`. Under `"full"` tier, all rich animations (springs, View Transitions, ActionSwap blur/roll/cascade, wire particle signals, glass overlays) run unconstrained at native display refresh rate (`60/90/120/144 Hz`). Under `"lite"` tier (when `animationsFps=30`, low-core/memory/Save-Data, or sustained dropped frames `>28ms` are detected), GPU-fillrate bottlenecks (`backdrop-blur`, multi-element `filter: blur`, root VT blur, dual SVG SMIL `<animateMotion>` particles) degrade smoothly to transform/opacity equivalents while keeping **every spring, card motion, layout transition, and View Transition responsive at 60 FPS**.
  3. **Browser-native platform efficiency:** Eliminate `document.body.offsetHeight` forced synchronous reflow inside `ThemeToggle`, pause continuous CSS infinite animations in hidden/background tabs (`html[data-page-hidden="true"]` from `usePageVisibility`), and apply CSS `content-visibility: auto` on offscreen Grid workspace group containers (`WorkspaceGrid`).
  4. **Real verification without UI test bloat:** Compare Turbopack `analyze:export` JSONL deltas, verify static export (`bun run build`), and inspect real desktop/mobile behavior in Chromium (cleaning up temporary verification files afterward).

### Execution log — 18 November 2026 (SWR boot, subscription isolation & scoped icon splitting)

- **Instant Stale-While-Revalidate (SWR) boot:** Enabled `FEATURE_FLAGS.configLocalCache` (`lib/featureFlags.ts`), updated `executeCloudflareInitSync` (`cloudflareSyncCoordinator.ts`) to hydrate valid `cached_esp_config` synchronously before the remote Cloudflare fetch settles, skip duplicate store writes when remote matches cache, and preserve cached segments on background network failure (`cache_recovered`). Updated `persistStoreConfigToCloudflare` (`buildEspConfig.ts`) to keep `cached_esp_config` fresh on remote writes. Covered with 3 unit tests in `tests/swr-sync.test.mjs`.
- **Root push-watcher re-render & serialization removal:** Replaced 19 reactive Zustand selectors inside `useCloudflarePush.ts` with an effect-scoped `useIoTStore.subscribe(...)` guarded by shallow field-reference equality and `isFullyReady` gating, preventing root `DashboardProvider` re-renders and eager `JSON.stringify` builds during pin updates or unready boot.
- **Scoped HugeIcon chunk splitting:** Split `components/ui/hugeicons.tsx` into `components/ui/hugeicon-factory.tsx` + semantic groups (`components/ui/hugeicons-groups/{shell,media,welcome,controls}.tsx`) and migrated callers to import directly from their owning group while keeping `hugeicons.tsx` as an export-compatible barrel. Turbopack `analyze` confirms `hugeicons.tsx` is eliminated from homepage chunks and `welcome.tsx` / `media.tsx` / `controls.tsx` icons (`router.tsx`, `download-01.tsx`, `skip-back.tsx`, `skip-forward.tsx`, `volume-x.tsx`, `cloud-lightning.tsx`, `save.tsx`) stay isolated inside their owning dynamic feature chunks rather than loading in the shell icon chunks.
- **Keyboard & ARIA polish:** Added `Escape` dismissal and dialog ARIA semantics (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) to `AutomationsDrawer`, plus `Escape` dismissal with focus restoration and stable `ResizeObserver` observation (`isCompactRef`) to `useGroupHeaderLayout.ts`.
- **On-demand segment icon registry (`iconRegistry.ts` / `icons.ts`):** Replaced the 55-icon eager static barrel in `features/iot/utils/icons.ts` with static `Cpu`/`Layers` defaults plus cached dynamic `import()` wrappers (`useSyncExternalStore` + `memo` bound wrapper) and `IconPicker` hover/focus preloading. Turbopack `analyze` confirms the shared `icons.ts` chunk dropped from bundling all 55 Animate-UI icon modules to bundling only `circuit-board.tsx` (`1045 B`) + `icons.ts` (`1894 B`).
- **Tab-wake & network-online MQTT resume (`mqtt/init.ts` / `usePageVisibility.ts`):** Added `createMqttResumeController` with 3-second cooldown throttling to immediately publish `PRESENCE_ONLINE_FRAME` + `SYNC_REQUEST_FRAME` or reconnect disconnected sockets on `visibilitychange` wake and `window` `online` events; covered in `tests/mqtt-resilience.test.mjs`.

### Execution log — 19 November 2026 (React 19.3, Zustand 5, Motion 14, Trellis presets, Tailwind v4 & Vibration API)

- **React 19.3 capabilities adopted selectively:**
  - `useOptimisticPinState.ts` across Grid, Trellis, and Canvas segment tiles tracks per-card in-flight `isPending` state while relying on `executeSinglePinUpdate`'s synchronous `useIoTStore` optimistic update and rollback—deliberately avoiding `startTransition` around external-store pin writes so completing a Cloudflare pin save never triggers a full-workspace `<AnimateView>` (`<React.ViewTransition>`) snapshot or global `isLoadingIoT` grid re-render.
  - `useEffectEvent` in `useCloudflarePush.ts`, `ToastNotification.tsx`, `MacroSidebar/index.tsx`, `ExpandableTabs`, and `TrellisChromeBar.tsx` strictly inside `useEffect` lifecycles.
  - `<Activity>` in `WorkspaceSection.tsx` for `ModulesWorkspace` (`add` ↔ `list`) and `AutomationsWorkspace` (`create` ↔ `manage`) so in-progress forms survive tab switches while heavy `WorkflowsCanvasSection` stays unmounted when hidden.
- **Zustand 5 middleware & local preference separation:**
  - Enabled `subscribeWithSelector` + dev-only `devtools` on `useIoTStore.ts`; upgraded `useCloudflarePush.ts` to use `subscribe(selectWatchedConfigSlice, ..., { equalityFn: shallow })`.
  - Created `usePreferencesStore.ts` (`persist` + `subscribeWithSelector` + dev-only `devtools`) for strictly browser-local preferences (`hapticsEnabled`, `savedTrellisLayouts`) so ESP32/Cloudflare `EspConfig` remains untouched.
- **Motion 14 gestures & layout isolation:**
  - Added reduced-motion-aware `drag="y"` swipe-to-dismiss on `ToastNotification.tsx` (upward) and `ExpandableTabs` mobile dock panels (downward with drag grabber), and isolated per-group layout projections via `<LayoutGroup>` in `WorkspaceGrid.tsx`.
- **`@danfessler/trellis` wall-panel preset & saved snapshots:**
  - Added the `"wall-panel"` 62%/38% split preset (`buildWallPanelDocument`) and `sanitizeTrellisDocument` in `trellisLayout.ts`, plus save/apply/delete named layout management in `useTrellisWorkspaceController.ts` and `TrellisChromeBar.tsx`.
- **Tailwind CSS v4 `@container` & Web Vibration API:**
  - Expanded named container queries (`@container/group`, `@container/trellis-group`, `@container/workspace`, `@container/settings-card`, `@container/segment`).
  - Added `lib/haptics.ts` and `HapticsToggle.tsx` in Stability settings, wired into segment switches/push buttons, macros, mobile dock actions, voice push-to-talk, and toasts.
- **File System Access API & Web Share API (`lib/fileTransfer.ts`, `configBackupService.ts`, `BackupRestoreSection.tsx`):**
  - Added native `showSaveFilePicker` / `showOpenFilePicker` and `navigator.share` JSON transfer helpers with automatic `<a download>`, `<input type="file">`, and clipboard fallbacks.
  - Added full dashboard backup/restore/share in Stability settings (`home-control-backup-v1`: `EspConfig` + Trellis layouts/haptics + Workflow Studio state, plus backwards-compatible standalone `EspConfig` restore).
- **Workflow Studio Sub-flows, Undo/Redo, Clipboard & JSON I/O (`workflowSubflowHelpers.ts`, `useWorkflowHistoryAndClipboard.ts`):**
  - Added Sub-flow container grouping (`parentGroupId`, `Ctrl+G`, header/footer toggle button, and auto-nesting when dropping a node inside a `group` box, with synchronized child dragging when moving the parent group).
  - Added bounded Undo/Redo history (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`), Copy/Paste/Duplicate (`Ctrl+C`, `Ctrl+V`, `Ctrl+D`, including sub-flow children and internal edges), `Delete`/`Backspace` removal, and `.workflow.json` Export/Share/Import in `WorkflowHeaderBar.tsx` and `WorkflowEmptyState.tsx`.


