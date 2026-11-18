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
  MasterHeader.tsx       Header/layout dispatcher
  MasterHeader/          Header subcomponents
  AudioInitializer.tsx   Audio initialization integration
features/
  dashboard/
    components/          Dashboard/workspace UI
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
- `components/MasterHeader.tsx` and `components/MasterHeader/` implement the shared header system. Before changing navigation or header positioning, inspect both the dispatcher and its subcomponents.
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
- `bun run test` — run deterministic domain, edge-case, and boundary integration tests (`tests/*.test.mjs`).
- `bun run lint && bun run typecheck && bun run test` — run lint, TypeScript typecheck, and deterministic contract tests together.
- `bun run clean` — remove local Next.js/export/build-metadata outputs.

Before submitting a change, run `bun run lint` and `bun run typecheck`; report existing deterministic tests and build results separately when they are run. New test authoring is not part of routine work unless the project owner requests it. Run `bun run build` when requested or when a change needs export validation. The repository owner has asked that tests remain available as a report/diagnostic suite rather than becoming a mandatory production-build gate. Do not wait for GitHub Pages deployment to finish development verification. CI workflows should use the latest Ubuntu runner available to the project (`ubuntu-26.04` at the time of this update). Avoid formatting unrelated files or committing generated output.

## 12. Safe change procedure for coding agents (AI-First Engineering)

1. Read this guide and the relevant protocol/design documentation before editing.
2. Inspect the actual source, package scripts, and current GitHub Actions workflow; do not rely on outdated assumptions.
3. Make the smallest cohesive change within the owning feature, keeping module boundaries explicit and contracts strongly typed (no `any` across domain, service, hook, or component boundaries).
4. Preserve TypeScript types, existing public exports, persisted configuration formats, and ESP32 message compatibility.
5. Add or update deterministic tests (`tests/*.test.mjs`) for touched domain logic, edge cases, and port/adapter boundary contracts.
6. Check responsive layouts, loading/error states, keyboard access, and transport failure behavior for UI changes.
7. Run `bun run check` (`lint` + `typecheck` + `test`) and production build checks where available.
8. Review the diff for unrelated formatting, secrets, logs, generated files, or temporary scripts.
9. Update this document when architecture, scripts, deployment behavior, or protocol ownership changes.

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
