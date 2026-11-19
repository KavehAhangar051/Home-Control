# Architecture and Engineering Guide

This document is the primary technical guide for contributors and coding agents working on **Home-Control-Dashboard**. It describes the repository as it currently exists; when implementation and documentation disagree, inspect the source and update this guide rather than assuming an undocumented feature exists.

## 1. Project purpose

Home-Control-Dashboard is a browser-based control and configuration dashboard for ESP32-based home automation. Its UI is built with Next.js and React, while device communication is handled from the browser through MQTT and WebSocket connections. The repository includes dashboard, IoT, settings, audio, and shared UI modules.

The application is configured for static export in its normal production mode. It is therefore not a conventional Next.js server application: do not assume server routes, server-side persistence, or private server-side access to secrets are available.

## 2. Technology stack

- **Framework:** Next.js 16 App Router
- **UI:** React 19.3 and TypeScript 7 (the test loader uses the official TypeScript 6 compatibility package for the legacy JavaScript compiler API)
- **Styling:** Tailwind CSS v4, PostCSS, and CSS custom properties
- **Motion:** `motion`; the root `MotionProvider` uses async `LazyMotion` with `domMax`. Keep the existing `motion/react` imports unless a same-environment Turbopack comparison proves `motion/react-m` reduces the initial client graph; the 18 Nov 2026 trial was reverted after the homepage graph grew by 10,134 compressed bytes.
- **Client state:** Zustand
- **Drag and drop:** `@dnd-kit/react` with the DOM sensor adapters from `@dnd-kit/dom`; the sortable hook is imported only by the dynamically loaded Grid workspace; Trellis and Canvas do not statically import it
- **Device messaging:** `mqtt` (MQTT over WebSocket where supported)
- **Forms and validation dependencies:** React Hook Form resolver integration and Zod; use them where the relevant feature already follows this pattern
- **Linting and formatting:** Biome is the required lint/format baseline; Oxlint plus the repository's vendored Anti-Slop plugin is available as a separate diagnostic (`bun run lint:ox`) while its findings are triaged.
- **Language/tooling:** TypeScript 7
- **Package manager:** Bun (`bun.lock` is the committed dependency lockfile)
- **Bundler:** Turbopack is used for development and production builds. The `dev:webpack` script remains available for the AI Studio workflow that disables file watching through the custom Webpack configuration.
- **React optimization:** React Compiler is enabled in `next.config.ts`; avoid adding manual memoization without profiling or a specific correctness reason.
- **Package import optimization:** `next.config.ts` keeps only custom entries for installed packages (`@base-ui/react`, `motion`, `zustand`). Next.js already optimizes `lucide-react` by default; removed packages must not remain in this list.
- **Native transitions:** Workspace switching uses Motion's `AnimateView` integration with React View Transitions, fed by a deferred Zustand workspace selection. Reduced-motion and the dashboard animation setting disable the transition.

The authoritative dependency and command definitions are in `package.json`; do not document scripts or libraries as active unless they exist there.

## 3. Repository map

```text
app/
  layout.tsx             Root document/layout and global providers
  page.tsx               Root route entry
  loading.tsx            Route loading UI
  not-found.tsx          Not-found UI
  globals.css            Global styles and design tokens
components/
  MasterHeader.tsx       Desktop right-rail header/layout dispatcher
  MasterHeader/          Desktop header & shared theme/voice/clock subcomponents
  motion/                Shared Motion primitives (`dock.tsx`, `expandable-tabs.tsx`, `expandable-tabs-layout.ts`)
  AudioInitializer.tsx   Audio initialization integration
features/
  dashboard/
    components/          Dashboard/workspace UI (`layout/MobileDockNav.tsx`, `DashboardHeader.tsx`, `DashboardBreadcrumb.tsx`, `DashboardMain.tsx`)
    context/             Dashboard-scoped context
    hooks/               Dashboard hooks
    index.ts             Feature entry point
  iot/
    components/          Device controls, status and IoT workspace UI
    hooks/               IoT state and behavior hooks
    services/            Communication and device integration
    utils/               IoT-specific utilities
  settings/
    components/          Settings sections and controls
lib/
  audio/                 Audio managers and UI sound effects
  presets.ts             Shared presets/configuration values
public/                  Static assets served by the frontend
docs/                    Protocol, configuration, and project reference docs
.github/workflows/       GitHub Actions automation
.env.example             Environment-variable template; contains placeholders only
next.config.ts           Next.js export and deployment configuration
biome.json               Lint/format rules
package.json             Scripts and dependency manifest
bun.lock                 Reproducible Bun dependency lockfile
tsconfig.json            TypeScript compiler configuration
```

This is a high-level map, not an exhaustive listing. Inspect the relevant directory before adding files; preserve the existing feature boundaries and naming conventions.

## 4. Application entry and shared UI

- `app/layout.tsx` is the root layout. Global CSS belongs in `app/globals.css`; route-level composition belongs in the App Router files.
- `app/page.tsx` is the root route and should stay focused on composing the application rather than accumulating feature implementation.
- `components/` contains UI or providers shared by multiple features. Keep feature-specific behavior inside the owning `features/<feature>/` directory.
- `components/MasterHeader.tsx` and `components/MasterHeader/` implement the desktop right-rail header system (`md:` and above).
- `components/motion/{dock.tsx,expandable-tabs.tsx,expandable-tabs-layout.ts}` and `features/dashboard/components/layout/MobileDockNav.tsx` implement the mobile-only (`< md`) floating bottom Dock with upward-expanding panels and integrated press-and-hold voice control. Before changing navigation or header positioning, inspect both desktop and mobile layout owners.
- `components/AudioInitializer.tsx` integrates audio initialization with the UI lifecycle.

Avoid introducing duplicate global providers or parallel implementations of existing shared components.

## 5. Feature boundaries

### Dashboard — `features/dashboard/`

Owns the dashboard-level composition and workspace behavior. Its `components/`, `context/`, and `hooks/` directories separate rendering, scoped state/context, and reusable behavior. Keep the feature entry point (`index.ts`) aligned with its public exports.

### IoT — `features/iot/`

Owns ESP32-facing UI and client communication logic.

- `components/` renders device controls, workspace areas, connection/status feedback, and related interactions.
- `hooks/` encapsulates reusable IoT state and operations.
- `services/` contains communication integrations and related service logic.
- `utils/` contains IoT-specific helper functions.

Keep transport concerns out of presentational components where practical. Components should call a clear service or hook API rather than independently creating duplicate MQTT clients or subscriptions. Manage connection lifecycle and cleanup carefully; reconnecting, mounting, or changing a screen must not accidentally multiply listeners or publish duplicate commands.

Informational MQTT connection and state-message logs are development-only to avoid per-message console overhead in production; warnings and errors remain visible.
- Incoming pin updates are coalesced and applied once per animation frame. Before applying an authoritative full `state_sync`, flush earlier queued pin updates so a delayed frame cannot overwrite the newer snapshot with stale values. A manual flush cancels its pending animation-frame callback before applying the batch.

### Settings — `features/settings/`

Owns settings UI and configuration controls. The current repository groups these under `features/settings/components/`; follow the existing subdivisions found there. Keep editing/validation logic separated from display code when that improves clarity, but avoid creating abstractions for one-off code without a real reuse or testing benefit.

### Shared utilities and audio — `lib/`

- `lib/presets.ts` stores shared preset/configuration values. Keep reusable constants out of individual components when multiple modules depend on them.
- `lib/audio/` contains audio-related implementation. Audio APIs are browser capabilities: guard initialization for browser availability and user-gesture restrictions, avoid creating redundant audio contexts, and clean up resources when appropriate.

## 6. Device communication and security boundaries

The frontend can communicate with ESP32 devices and brokers using browser-accessible transports. The repository also documents protocol details in `docs/`, including `docs/websocket-protocol-esp32.md`, `docs/websocket-protocol-keys-events.md`, and `docs/dashboard-configurations-protocol.md`.

Before changing message names, payload formats, pin identifiers, configuration keys, or connection fallback behavior:

1. Read the relevant protocol document.
2. Trace the existing publisher/subscriber or socket service implementation.
3. Keep payload shape and event names compatible with firmware and any existing dashboard configuration.
4. Handle unavailable brokers/devices and malformed or missing data without leaving the UI in a misleading state.
5. Ensure subscriptions and event handlers are removed when no longer needed.

A browser-delivered static app cannot keep secrets confidential. Never put private broker credentials, API keys, tokens, or personal network credentials into committed frontend code or public environment variables. `.env.example` must contain placeholders, not real secrets. Browser MQTT/WebSocket endpoints and any values shipped to the client should be treated as public. Do not use a private server-only environment variable in client code expecting it to be hidden.

## 7. State, data flow, and UI behavior

- Use the existing state owner for each domain. Do not introduce a second source of truth for a setting or device state already managed by a feature hook/store.
- Separate user intent from confirmed device state where the transport can fail or report updates asynchronously. Provide visible pending, connected/disconnected, and error states when relevant.
- Avoid assuming that publishing a command means the physical device has applied it.
- The dashboard currently has no TanStack Query dependency or global query provider. Keep server-state/cache libraries out unless a concrete remote-cache workflow is introduced.
- Keep components accessible: use semantic elements, labels for controls, keyboard-operable interactions, clear focus states, and status text that does not rely on color alone.
- Preserve responsive behavior and test narrow and wide viewports when modifying layouts.
- Respect reduced-motion preferences for nonessential animation where practical. Audio feedback must not be required to understand or complete an action.

## 8. Styling and design-system conventions

- The project uses Tailwind CSS v4 with PostCSS. Do not introduce a legacy Tailwind configuration file unless a concrete compatibility need is demonstrated.
- Prefer existing CSS custom properties, theme tokens, and established utility patterns over hard-coded duplicate colors.
- Keep global styles and global tokens in `app/globals.css`; component-specific styling should stay near the owning component unless it is genuinely shared.
- Reuse existing motion and icon dependencies rather than introducing overlapping libraries.
- Preserve the project's Persian-inspired visual identity where already implemented, but prioritize legibility, contrast, predictable controls, and consistent spacing over decorative effects.
- Do not impose a rigid 100-line file limit. Split modules when responsibility, complexity, reuse, or testability warrants it—not just to satisfy a line count.

## 9. Static export and deployment

`next.config.ts` sets `output: "export"` unless `DISABLE_HMR=true` is set. When `GITHUB_PAGES=true`, it configures the repository path as `basePath` and `assetPrefix`, and enables trailing slashes for GitHub Pages deployment.

Implications:

- Do not add `app/api/*` routes or rely on a persistent Next.js server in the static production build.
- All client-side endpoints must be reachable from the user's browser and comply with browser mixed-content/CORS/WebSocket restrictions.
- Validate internal links, static assets, and route behavior under the GitHub Pages base path, not only at the domain root.
- The Pages workflow is in `.github/workflows/deploy-pages.yml`. Keep its build output, artifact upload, and deployment configuration aligned with Next.js static export.
- Do not claim deployment is configured successfully merely because a workflow file exists; verify repository Pages settings and the workflow run itself.

The `start` script runs `next start`, which is not the normal way to serve a static export. For a production-export preview, serve the generated `out/` directory with a static file server.

## 10. Environment and generated files

- `.env.example` is the committed template. Copy it to `.env.local` for local development and populate values only when the relevant feature requires them.
- Real `.env*` files, dependency directories, build outputs, logs, and TypeScript build metadata should remain untracked.
- `next-env.d.ts` is a standard Next.js-generated type declaration and may be tracked; do not remove it merely because it is generated.
- `bun.lock` is the authoritative lockfile and must be committed with dependency changes. Keep it synchronized with `package.json` using Bun.
- Do not commit console dumps, local machine state, generated build artifacts, private keys, credentials, or one-off output files.

## 11. Developer workflow

Use Node.js 20.9.0 or newer with Bun, as required by Next.js 16.

```bash
bun install --frozen-lockfile
bun run dev
bun run lint
bun run build
```

Available scripts in `package.json`:

- `bun run dev` — start Next.js development with Turbopack.
- `bun run dev:webpack` — start the legacy Webpack development workflow, including the AI Studio file-watching workaround.
- `bun run build` — create the static production export with Turbopack.
- `bun run analyze` — save a Turbopack bundle-analysis snapshot in `.next/diagnostics/analyze` using Next.js's built-in analyzer (`--output`); pass `--snapshot <name>` to keep named before/after captures.
- `bun run analyze:export` — stream the latest or selected saved analyzer graph as JSON Lines; pass `--snapshot <name>` and redirect stdout when a machine-readable report is needed.
- The `Bundle analysis` GitHub Actions workflow captures named snapshots and uploads the matching JSONL graph plus static analyzer report; it runs on relevant pushes to `main` and supports manual `before`/`after` dispatch; hidden `.next/diagnostics/analyze` files are included in the artifact.
- `bun run start` — run the Next.js server (not a static-export preview).
- `bun run lint` — run the required Biome linting over `app`, `components`, `features`, and `lib`.
- `bun run lint:ox` — run Oxlint and the repository's custom Anti-Slop rules as a diagnostic report; current legacy findings are not yet a blocking gate.
- `bun run format` — format those source directories in place; review the resulting diff before committing.
- `bun run typecheck` — run TypeScript compiler check (`tsc --noEmit`).
- `bun run test` — run core domain, hardware/MQTT protocol, and Cloudflare/workflow sync tests (`tests/*.test.mjs`). UI, CSS, layout, and throwaway tests are intentionally excluded.
- `bun run lint && bun run typecheck && bun run test` — run lint, TypeScript typecheck, and existing core domain tests together.
- `bun run clean` — remove local Next.js/export/build-metadata outputs.

Before submitting a change, run `bun run lint` and `bun run typecheck`; report existing core tests and build results separately when they are run. **Do not write temporary, throwaway, or UI-detail unit tests** (e.g., Tailwind classes, pixel geometry, animation timings, icon loaders, or visual layout assertions). New tests should only be authored when explicitly requested by the project owner for critical domain or hardware protocol logic. Always clean up temporary artifacts (such as `.playwright-cli/` captures) before finishing. **Always update relevant documentation (`ARCHITECTURE.md`, `DESIGN.md`, `README.md`, `docs/*`) immediately after code changes** so repository docs remain accurate and trustworthy for future sessions. Run `bun run build` when requested or when a change needs export validation. The repository owner has asked that tests remain available as a report/diagnostic suite rather than becoming a mandatory production-build gate. Do not wait for GitHub Pages deployment to finish development verification. CI workflows should use the latest Ubuntu runner available to the project (`ubuntu-26.04` at the time of this update). Avoid formatting unrelated files or committing generated output.

## 12. Safe change procedure for coding agents (AI-First Engineering)

1. Read this guide and the relevant protocol/design documentation before editing.
2. Inspect the actual source, package scripts, and current GitHub Actions workflow; do not rely on outdated assumptions.
3. Make the smallest cohesive change within the owning feature, keeping module boundaries explicit and contracts strongly typed (no `any` across domain, service, hook, or component boundaries).
4. Preserve TypeScript types, existing public exports, persisted configuration formats, and ESP32 message compatibility.
5. Do **not** author temporary, pointless, or UI-detail tests. Only touch `tests/*.test.mjs` when updating existing core domain/protocol logic or when explicitly requested by the project owner.
6. Check responsive layouts (desktop `md:`+ and mobile `< md`), loading/error states, keyboard access, and transport failure behavior for UI changes.
7. Run `bun run lint`, `bun run typecheck`, and production build checks where available (and clean up any temporary verification directories like `.playwright-cli/`).
8. Review the diff for unrelated formatting, secrets, logs, generated files, or temporary scripts.
9. **Mandatory documentation sync:** Immediately update `ARCHITECTURE.md`, `DESIGN.md`, `README.md`, `docs/TESTING.md`, or protocol docs whenever code changes alter architecture, navigation, scripts, test inventory, or behavior so documentation stays trustworthy.

When uncertain, prefer inspecting existing patterns and protocol documents over inventing new conventions.


## 13. Current engineering decisions and lessons (November 2026)

- The legacy `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` stack was replaced by `@dnd-kit/react` and `@dnd-kit/dom` (both locked at 0.5.3). Preserve the existing interaction contract: groups reorder independently, segments stay within their owning group, trash targets remove supported items, and pointer activation retains its 5px threshold.
- TypeScript 7 is the project compiler, but the Node test loader needs the JavaScript compiler API. TypeScript 7 does not expose that API; `tests/ts-loader.mjs` therefore imports `@typescript/typescript6` as a compatibility-only test dependency. Do not downgrade the application compiler to solve a test-loader concern.
- React View Transitions are enabled only for workspace-content changes. Zustand remains the source of truth; `useDeferredValue` supplies the deferred render value because external-store mutations cannot reliably be made non-blocking by wrapping the Zustand setter in `startTransition`.
- The View Transition implementation respects both the dashboard animation preference and the user's reduced-motion preference. Keep these controls in sync when changing transition behavior.
- The experimental Playwright PR #9 was closed without merging. The project owner performs hands-on browser verification; do not treat the unmerged experiment as coverage or evidence.
- Performance changes follow a measure → identify → change → re-measure workflow. New libraries, memoization, or architectural abstractions are not improvements without evidence.


## 14. Modernization findings and current direction (18 November 2026)

- The broad \`motion/react-m\` import migration was evaluated against the actual Next.js 16.4.6/Turbopack output and reverted. The trial added five homepage client chunks and 10,134 compressed bytes to the homepage client graph. Keep the existing \`motion/react\` imports and async \`LazyMotion\` + \`domMax\` provider unless a new focused experiment demonstrates a real improvement.
- The post-revert analyzer graph reports unchanged Motion package contributions versus the original baseline. This is stronger evidence than assuming that the library's documented generic bundle-size example maps directly to this application's build.
- The DnD hook is owned by the dynamically loaded Grid workspace. The static graph's DnD contribution decreased slightly, but the key intended benefit is avoiding an unnecessary runtime dependency for Trellis/Canvas. Confirm actual chunk requests in a browser before calling that behavior verified.
- Keep MQTT.js behind its existing asynchronous import. Its large source-module contribution is not equivalent to initial JavaScript cost.
- The next optimization cycle targets runtime responsiveness: MQTT message-to-UI latency, Zustand selector/subscription fan-out, workspace switching, workflow/canvas long tasks, and actual browser chunk requests.
- React \`Activity\`, \`useEffectEvent\`, additional memoization, and more code splitting are candidates to evaluate—not mandatory migrations. Adopt them only when a concrete lifecycle or profiling result justifies the change.
- Continue to treat the project as a static-export, browser-first dashboard. Preserve ESP32 protocol compatibility, Cloudflare data formats, persisted settings, accessibility, touch behavior, and reduced-motion preferences.

- Canvas, Trellis, and Grid subscribe to device state at the smallest useful level. Canvas wire activity is selected per pin, while group active counts are selected as derived scalar values; do not reintroduce whole-pinsState subscriptions in workspace parents or group containers, because a single pin update would invalidate unrelated UI.

- High-frequency sheet gestures (pinch zoom, wheel zoom, pan, Canvas node drag/resize, and Workflow Studio node drag/resize) coalesce pointer and gesture deltas through `requestAnimationFrame`, avoid synchronous `localStorage` serialization during active frames via transient state + debounced/gesture-end persistence, and drive transient drag tilt without triggering parent React re-renders.

## 15. 60 FPS rendering, adaptive tiering, and animation quality

- The dashboard targets stable 60 FPS on 60 Hz devices and scales cleanly to higher refresh rates (`90/120/144 Hz`) without an artificial FPS cap.
- `lib/performanceTier.ts` (`usePerformanceTier`) connects hardware hints, the user-configurable `animationsFps` (`30 | 60`) setting, and a sliding-window rAF dropped-frame monitor to `html[data-perf-tier="full" | "lite"]`, stepping down GPU-heavy blur/backdrop-blur and dual SVG SMIL `<animateMotion>` effects under pressure while retaining all Motion springs, transforms, opacity transitions, and View Transitions.
- Hidden tabs (`html[data-page-hidden="true"]` from `usePageVisibility`) pause infinite CSS keyframes, `ThemeToggle` avoids forced `document.body.offsetHeight` synchronous reflows, and offscreen Grid group containers use `content-visibility: auto`.
- Preserve the current async `LazyMotion` + `domMax` setup because all 134 Motion calls already import lightweight `m.*` rather than monolithic `motion`, and the broad `motion/react-m` migration increased homepage bundle size in Next.js 16.4.6/Turbopack.
- Follow `docs/performance/60-FPS-STRATEGY.md` for profiling scenarios and acceptance criteria. Record real browser measurements alongside Turbopack snapshots whenever runtime claims are updated.

## 16. Instant boot, subscription isolation, and icon splitting (18 November 2026)

- **Stale-While-Revalidate (SWR) Cloudflare boot:** `FEATURE_FLAGS.configLocalCache` (`lib/featureFlags.ts`) enables instant local hydration from `localStorage.getItem("cached_esp_config")` inside `cloudflareSyncCoordinator.ts` (`executeCloudflareInitSync`). Returning sessions hydrate segments, groups, and dashboard customization immediately without waiting on remote Cloudflare latency, skip redundant store re-application when the remote signature matches, and preserve cached state (`cache_recovered`) if the background fetch fails or the browser is offline. `persistStoreConfigToCloudflare` (`buildEspConfig.ts`) keeps `cached_esp_config` synchronized after remote saves.
- **Root push-watcher isolation:** `useCloudflarePush.ts` observes configuration changes via an effect-scoped `useIoTStore.subscribe(...)` guarded by shallow reference comparison instead of 19 reactive React hook selectors inside root `DashboardProvider`, eliminating root provider re-renders and eager `JSON.stringify` serialization during pin updates, toasts, and unready boot states.
- **Scoped HugeIcon chunk splitting & lazy segment icon loading:** `components/ui/hugeicon-factory.tsx` isolates the shared delegated pointer hover factory while `components/ui/hugeicons-groups/{shell,media,welcome,controls}.tsx` separate eager shell/workspace icons from dynamic-view icons (`WelcomePortal`, `AudioSection`, `StabilitySection`, `MqttSection`, `WifiSection`, `AutomationsDrawer`). In addition, `features/iot/utils/icons.ts` and `iconRegistry.ts` keep only `Cpu` (`CircuitBoard`) and `Layers` (`Layers01`) static while loading the remaining 53 segment icons on demand and preloading the full catalog when opening `IconPicker`.
- **Tab-wake & network-online MQTT resume:** `features/iot/services/mqtt/init.ts` (`createMqttResumeController`) and `usePageVisibility.ts` trigger immediate reconnect when disconnected or throttled `PRESENCE_ONLINE_FRAME` + `SYNC_REQUEST_FRAME` synchronization (3s cooldown) on tab wake (`visibilitychange`) and `online` recovery.
- **Dialog/menu keyboard polish:** `AutomationsDrawer` (`role="dialog"`, `aria-modal="true"`) and `GroupSettingsMenu` (`useGroupHeaderLayout.ts`) support `Escape` dismissal with focus restoration.

## 17. Mobile floating Dock navigation, header macro selector & UI polish (19 November 2026)

- **Mobile-only floating Dock (`< md`):** Desktop (`md:`+) preserves the right-side vertical rail (`DashboardHeader` / `MasterHeader`) and bottom footer unchanged. On mobile (`< md`), the right rail, desktop footer, `#dashboard-footer-center` portal target, header `WorkspaceViewModeSelector`, and standalone floating voice button are replaced by `features/dashboard/components/layout/MobileDockNav.tsx` built on `components/motion/{dock.tsx,expandable-tabs.tsx,expandable-tabs-layout.ts}` (RTL, `LazyMotion` `m.*`, lite-tier aware).
- **Header-integrated Macro selector (`MacroSidebar`):** Custom buttons / macros no longer render as a floating strip above the workspace. `features/dashboard/components/widgets/MacroSidebar/index.tsx` now mounts inside `DashboardBreadcrumb` (next to `WorkspaceViewModeSelector` on desktop and next to `ThemeToggle` on mobile) so Grid, Trellis, and Canvas all keep full unobstructed vertical space while offering 1-click execution (single macro) or an anchored popover selector (multiple macros).
- **Compact non-blocking toasts (`ToastNotification`):** `features/iot/components/notifications/ToastNotification.tsx` renders as a compact single-line pill anchored in the top header band (`top-1.5` / `md:top-2`) inside a `pointer-events-none` container with click-to-dismiss and quick auto-dismiss, preventing toasts from covering segment cards or blocking buttons on mobile and desktop.
- **Unified active (`1`) input segment styling & submenu icons:** Active input segments now share the same `accent3` active surface tint (`bg-accent3-transparent`), border (`border-accent3`), icon badge (`bg-accent3 text-accent3-foreground`), and Canvas wire/port styling as output segments while displaying a read-only `ورودی` badge. All submenu entries in `features/dashboard/navigation.ts` (`MODULES_TABS`, `AUTOMATIONS_TABS`, `SETTINGS_TABS`) define Lucide icons rendered across desktop sidebar submenus, mobile Dock panels, mobile subsection tabs, and header breadcrumbs.
- **Test & documentation hygiene:** Removed UI-focused and temporary tests (`mobile-dock.test.mjs`, `lazy-icons.test.mjs`, `performance-tier.test.mjs`, `dynamic-retry.test.mjs`, plus UI/CSS/layout/motion/DnD blocks inside `domain-contracts.test.mjs` and `legacy-seams.test.mjs`) and `.playwright-cli/` artifacts. Repository policy strictly prohibits UI/throwaway tests and requires updating docs immediately after code changes.

## 18. Platform capability upgrades (19 November 2026)

- **React 19.3 (`useOptimistic`, `useEffectEvent`, `<Activity>`):**
  - `features/iot/components/sortable-segment-card/hooks/useOptimisticPinState.ts` wraps `onTogglePin` and `onSetPinState` inside React 19 `useOptimistic` + `useTransition`, providing instant optimistic tile feedback (`ActiveCard`, `TrellisSegmentTile`, `TrellisSegmentView`, `CanvasSegmentNode`) with subtle pending indicator (`CardFooter`) and automatic rollback on command failure.
  - `useEffectEvent` decouples non-reactive callbacks from `useEffect` subscriptions in `useCloudflarePush.ts`, `ToastNotification.tsx`, `MacroSidebar/index.tsx`, `ExpandableTabs`, and `TrellisChromeBar.tsx` (strictly invoked inside `useEffect`, never inside event handlers).
  - `<Activity mode="visible" | "hidden">` in `WorkspaceSection.tsx` preserves in-progress form state when switching between `AddSegmentForm` ↔ `SegmentList` and `AutomationForm` ↔ `AutomationList`, while keeping `WorkflowsCanvasSection` conditionally unmounted when hidden.
- **Zustand 5 (`subscribeWithSelector`, dev-only `devtools`, `persist`):**
  - `features/iot/hooks/useIoTStore.ts` enables `subscribeWithSelector` and dev-only `devtools` (`HomeControlIoTStore`).
  - `useCloudflarePush.ts` subscribes directly via `useIoTStore.subscribe(selectWatchedConfigSlice, ..., { equalityFn: shallow })` instead of manual full-store diffing.
  - `features/iot/hooks/usePreferencesStore.ts` uses Zustand 5 `persist` (`home-control-preferences-v1`), `subscribeWithSelector`, and dev-only `devtools` for strictly browser-local preferences (`hapticsEnabled`, `savedTrellisLayouts`), keeping `EspConfig` / Cloudflare KV payloads 100% unchanged.
- **Motion 14 (`drag` swipe gestures & `LayoutGroup`):**
  - `ToastNotification.tsx` supports upward swipe-to-dismiss (`drag="y"` with elastic constraints and reduced-motion guard).
  - `components/motion/expandable-tabs.tsx` adds a drag grabber and downward swipe-to-dismiss (`drag="y"`) on open Mobile Dock panels.
  - `WorkspaceGrid.tsx` wraps each `ConnectedGroup` inside `<LayoutGroup id="group-layout-...">` to isolate layout projections per group.
- **`@danfessler/trellis` presets & saved layout snapshots:**
  - `features/iot/components/trellis/trellisLayout.ts` adds the `"wall-panel"` preset (`buildWallPanelDocument`: 62%/38% split highlighting the primary room group for wall tablets) and `sanitizeTrellisDocument` (backed by `@danfessler/trellis`'s `sanitize`).
  - `useTrellisWorkspaceController.ts` and `TrellisChromeBar.tsx` allow saving (`ws.getDocument()`), applying (`ws.setDocument(..., { animate: true })`), and deleting named custom workspace layouts persisted in `usePreferencesStore`.
- **Tailwind CSS v4 (`@container` queries):**
  - Named container queries (`@container/group`, `@container/trellis-group`, `@container/workspace`, `@container/settings-card`, `@container/segment`) adapt Grid group columns/headers, Trellis panel tile grids, and Settings/Workspace cards directly to container width rather than viewport width alone.
- **Web Vibration API (`lib/haptics.ts`):**
  - `lib/haptics.ts` provides safe semantic haptic patterns (`tap`, `toggleOn`, `toggleOff`, `push`, `macro`, `voice`, `success`, `error`) gated on browser support, `prefers-reduced-motion`, and the persisted `hapticsEnabled` preference exposed via `features/settings/components/stability-section/HapticsToggle.tsx`.
- **File System Access API & Web Share API (`lib/fileTransfer.ts`, `configBackupService.ts`, `BackupRestoreSection.tsx`):**
  - `lib/fileTransfer.ts` provides native `showSaveFilePicker` / `showOpenFilePicker` JSON file I/O (with automatic fallback to `<a download>` and `<input type="file">` inside restricted contexts) and `navigator.canShare` / `navigator.share` (`Web Share API` with File attachment or text/clipboard fallback).
  - `features/iot/services/configBackupService.ts` and `features/settings/components/stability-section/BackupRestoreSection.tsx` allow exporting, sharing, and restoring full dashboard backup bundles (`home-control-backup-v1`: `EspConfig` + `usePreferencesStore` Trellis layouts/haptics + `WorkflowStudioState`) as well as standalone `EspConfig` JSON files.
- **Workflow Studio Sub-flows/Grouping, Undo/Redo, Clipboard & JSON I/O (`features/iot/components/workflows/`):**
  - **Sub-flows / Node Grouping (`parentGroupId`, `workflowSubflowHelpers.ts`):** Nodes can be grouped into a `kind === "group"` sub-flow container box via `Ctrl+G`, the header/footer `Boxes`/`Unlink` button, or by dragging and dropping a node inside a group container. Dragging a parent group moves all nested child nodes in lockstep.
  - **Undo / Redo & Copy / Paste / Duplicate (`useWorkflowHistoryAndClipboard.ts`):** Per-workflow bounded undo/redo stack (40 snapshots) covering node/edge creation, deletion, property edits, drag moves, and resizes (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`), plus node/sub-flow clipboard Copy (`Ctrl+C`), Paste (`Ctrl+V`), Duplicate (`Ctrl+D`), and `Delete`/`Backspace` shortcuts alongside footer toolbar controls.
  - **Workflow JSON Export / Share / Import:** `WorkflowHeaderBar.tsx` and `WorkflowEmptyState.tsx` support exporting individual workflows to `.workflow.json`, sharing via `Web Share API`, and importing workflow JSON files with automatic ID deduplication.


