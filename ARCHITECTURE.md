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
- **React optimization:** React Compiler is enabled in `next.config.ts` for production builds (`!isDevServer`, skipped in `next dev` so Turbopack stays on native SWC and avoids multi-worker Babel cold-start timeouts); avoid adding manual memoization without profiling or a specific correctness reason.
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
docs/                    Protocol, configuration, dimensional drawings (`docs/dimensional-drawings/`), and reference docs
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
- `bun run cbm <tool> [flags]` (`./tools/cbm.sh`) — execute any of the 17 `codebase-memory-mcp` knowledge-graph tools (`get_architecture`, `search_graph`, `query_graph`, `trace_path`, `get_file_outline`, `get_code_snippet`, `detect_changes`, `check_index_coverage`, `manage_adr`, etc.) against the indexed project (`app-applet`).
- `bun run cbm:index` — re-index the repository (respecting `.cbmignore`) and persist the compressed knowledge graph artifact at `.codebase-memory/graph.db.zst`.
- `bun run lint && bun run typecheck && bun run test` — run lint, TypeScript typecheck, and existing core domain tests together.
- `bun run clean` — remove local Next.js/export/build-metadata outputs.

Before submitting a change, run `bun run lint` and `bun run typecheck`; report existing core tests and build results separately when they are run. **Do not write temporary, throwaway, or UI-detail unit tests** (e.g., Tailwind classes, pixel geometry, animation timings, icon loaders, or visual layout assertions). New tests should only be authored when explicitly requested by the project owner for critical domain or hardware protocol logic. Always clean up temporary artifacts and logs before finishing. **Always update relevant documentation (`ARCHITECTURE.md`, `DESIGN.md`, `README.md`, `docs/*`) immediately after code changes** so repository docs remain accurate and trustworthy for future sessions. Run `bun run build` when requested or when a change needs export validation. The repository owner has asked that tests remain available as a report/diagnostic suite rather than becoming a mandatory production-build gate. Do not wait for GitHub Pages deployment to finish development verification. CI workflows should use the latest Ubuntu runner available to the project (`ubuntu-26.04` at the time of this update). Avoid formatting unrelated files or committing generated output.

## 12. Safe change procedure for coding agents (AI-First Engineering)

1. Read this guide and the relevant protocol/design documentation before editing.
2. Inspect the actual source, package scripts, and current GitHub Actions workflow; do not rely on outdated assumptions.
3. Make the smallest cohesive change within the owning feature, keeping module boundaries explicit and contracts strongly typed (no `any` across domain, service, hook, or component boundaries).
4. Preserve TypeScript types, existing public exports, persisted configuration formats, and ESP32 message compatibility.
5. Do **not** author temporary, pointless, or UI-detail tests. Only touch `tests/*.test.mjs` when updating existing core domain/protocol logic or when explicitly requested by the project owner.
6. Check responsive layouts (desktop `md:`+ and mobile `< md`), loading/error states, keyboard access, and transport failure behavior for UI changes.
7. Run `bun run lint`, `bun run typecheck`, and production build checks where available (and clean up any temporary verification files or logs).
8. Review the diff for unrelated formatting, secrets, logs, generated files, or temporary scripts.
9. **Mandatory documentation sync:** Immediately update `ARCHITECTURE.md`, `DESIGN.md`, `README.md`, `docs/TESTING.md`, or protocol docs whenever code changes alter architecture, navigation, scripts, test inventory, or behavior so documentation stays trustworthy.

When uncertain, prefer inspecting existing patterns and protocol documents over inventing new conventions.


## 13. Current engineering decisions and lessons (November 2026)

- The legacy `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` stack was replaced by `@dnd-kit/react` and `@dnd-kit/dom` (both locked at 0.5.3). Preserve the existing interaction contract: groups reorder independently, segments stay within their owning group, trash targets remove supported items, and pointer activation retains its 5px threshold.
- TypeScript 7 is the project compiler, but the Node test loader needs the JavaScript compiler API. TypeScript 7 does not expose that API; `tests/ts-loader.mjs` therefore imports `@typescript/typescript6` as a compatibility-only test dependency. Do not downgrade the application compiler to solve a test-loader concern.
- React View Transitions are enabled only for workspace-content changes. Zustand remains the source of truth; `useDeferredValue` supplies the deferred render value because external-store mutations cannot reliably be made non-blocking by wrapping the Zustand setter in `startTransition`.
- The View Transition implementation respects both the dashboard animation preference and the user's reduced-motion preference. Keep these controls in sync when changing transition behavior.
- Automated browser E2E testing frameworks are excluded from this repository by project policy; the project owner performs hands-on browser verification directly.
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
- `lib/performanceTier.ts` (`usePerformanceTierObserver`) maps explicit user Settings (`animationsEnabled === false` or `animationsFps <= 30`) directly to `html[data-perf-tier="full" | "lite"]` with **zero continuous background rAF polling** and **no silent hardware-based quality downgrade**. All animations, blur/backdrop-blur effects, springs, transforms, and View Transitions remain 100% active on every device unless the user explicitly opts into reduced animations or `30 FPS` in Settings → پایداری.
- Hidden tabs (`html[data-page-hidden="true"]` from `usePageVisibility`) pause infinite CSS keyframes and active `CompositedBezierParticle` Web Animations through one shared visibility listener. Canvas and Workflow wire particles pre-sample cubic Bezier geometry on changes and animate equal-distance `translate3d`/opacity keyframes; these are compositor candidates, not a guarantee of GPU execution. `ThemeToggle` avoids forced `document.body.offsetHeight` synchronous reflows, and offscreen Grid group containers use `content-visibility: auto`.
- Preserve the current async `LazyMotion` + `domMax` setup because all 134 Motion calls already import lightweight `m.*` rather than monolithic `motion`, and the broad `motion/react-m` migration increased homepage bundle size in Next.js 16.4.6/Turbopack.
- Follow `docs/performance/60-FPS-STRATEGY.md` for profiling scenarios and acceptance criteria. Record real browser measurements alongside Turbopack snapshots whenever runtime claims are updated.

## 16. Instant boot, subscription isolation, and icon splitting (18 November 2026)

- **Stale-While-Revalidate (SWR) Cloudflare boot:** `FEATURE_FLAGS.configLocalCache` (`lib/featureFlags.ts`) enables instant local hydration from `localStorage.getItem("cached_esp_config")` inside `cloudflareSyncCoordinator.ts` (`executeCloudflareInitSync`). Returning sessions hydrate segments, groups, and dashboard customization immediately without waiting on remote Cloudflare latency, skip redundant store re-application when the remote signature matches, and preserve cached state (`cache_recovered`) if the background fetch fails or the browser is offline. `persistStoreConfigToCloudflare` (`buildEspConfig.ts`) keeps `cached_esp_config` synchronized after remote saves.
- **Root push-watcher isolation:** `useCloudflarePush.ts` observes configuration changes via an effect-scoped `useIoTStore.subscribe(...)` guarded by shallow reference comparison instead of 19 reactive React hook selectors inside root `DashboardProvider`, eliminating root provider re-renders and eager `JSON.stringify` serialization during pin updates, toasts, and unready boot states.
- **Scoped HugeIcon chunk splitting & lazy segment icon loading:** `components/ui/hugeicon-factory.tsx` isolates the shared delegated pointer hover factory while `components/ui/hugeicons-groups/{shell,media,welcome,controls}.tsx` separate eager shell/workspace icons from dynamic-view icons (`WelcomePortal`, `AudioSection`, `StabilitySection`, `MqttSection`, `WifiSection`, `AutomationsDrawer`). In addition, `features/iot/utils/icons.ts` and `iconRegistry.ts` keep only `Cpu` (`CircuitBoard`) and `Layers` (`Layers01`) static while loading the remaining 53 segment icons on demand and preloading the full catalog when opening `IconPicker`.
- **Tab-wake & network-online MQTT resume:** `features/iot/services/mqtt/init.ts` (`createMqttResumeController`) and `usePageVisibility.ts` trigger immediate reconnect when disconnected or throttled `PRESENCE_ONLINE_FRAME` + `SYNC_REQUEST_FRAME` synchronization (3s cooldown) on tab wake (`visibilitychange`) and `online` recovery.
- **Dialog/menu keyboard polish:** `AutomationsDrawer` (`role="dialog"`, `aria-modal="true"`) and `GroupSettingsMenu` (`useGroupHeaderLayout.ts`) support `Escape` dismissal with focus restoration.

## 17. Mobile floating Dock navigation, header macro selector & UI polish (19 November 2026)

- **Mobile-only floating Dock (`< md`) with Custom Buttons (`macros`) & width clamping:** Desktop (`md:`+) preserves the right-side vertical rail (`DashboardHeader` / `MasterHeader`), desktop header `MacroSidebar`, and bottom footer (`ThemeToggle`) unchanged. On mobile (`< md`), the right rail, desktop footer, `#dashboard-footer-center` portal target, header `WorkspaceViewModeSelector`, header `MacroSidebar`, header `ThemeToggle`, and standalone floating voice button are replaced by `features/dashboard/components/layout/MobileDockNav.tsx` built on `components/motion/{dock.tsx,expandable-tabs.tsx,expandable-tabs-layout.ts}` (RTL, `LazyMotion` `m.*`, lite-tier aware, `computeMaxActiveTabWidth` clamping for narrow screens). All user custom buttons (`visibleMacros`) mount inside `MobileDockNav` as an upward-expanding `"macros"` Dock tab, while mobile theme switching (`حالت روز` / `حالت شب` with Circle Blur View Transition) lives inside `Settings → شخصی‌سازی داشبورد` (`ColorsSection.tsx`, `md:hidden`).
- **Mobile-first `WorkspaceSection` & Stability card responsiveness:** `DashboardMain` (`p-2.5 pb-24 sm:p-fluid-sm`), `WorkspaceSection` (`px-0 py-1.5 sm:px-4 sm:py-6`, compact `MobileSubsectionTabs` snap-pill bar, and `min-w-0 sm:bezel-shell` around `SettingsWorkspace`, `AddSegmentForm`, `SegmentList`, and `AutomationForm`), and `InlineStabilitySection` (removing its redundant inner bordered/padded box inside `CardContent`) eliminate stacked mobile margins/frames. `AnimationsToggle`, `LowDataToggle`, `HapticsToggle`, `BackupRestoreSection`, and `CloudflareIntegration` use full-width `flex-1 min-w-0` text containers and proper RTL `justify-start` alignment so controls fill narrow viewports cleanly.
- **Desktop header-integrated Macro selector (`MacroSidebar`):** Custom buttons / macros no longer render as a floating strip above the workspace. On desktop (`md:`+), `features/dashboard/components/widgets/MacroSidebar/index.tsx` mounts inside `DashboardBreadcrumb` next to `WorkspaceViewModeSelector` (offering 1-click execution for a single macro or an anchored popover selector for multiple macros) and exports shared `filterVisibleMacros` / `MacroGlyph` helpers reused by `MobileDockNav`.
- **Compact non-blocking toasts (`ToastNotification`):** `features/iot/components/notifications/ToastNotification.tsx` renders as a compact single-line pill anchored in the top header band (`top-1.5` / `md:top-2`) inside a `pointer-events-none` container with click-to-dismiss and quick auto-dismiss, preventing toasts from covering segment cards or blocking buttons on mobile and desktop.
- **Unified active (`1`) input segment styling & submenu icons:** Active input segments now share the same `accent3` active surface tint (`bg-accent3-transparent`), border (`border-accent3`), icon badge (`bg-accent3 text-accent3-foreground`), and Canvas wire/port styling as output segments while displaying a read-only `ورودی` badge. All submenu entries in `features/dashboard/navigation.ts` (`MODULES_TABS`, `AUTOMATIONS_TABS`, `SETTINGS_TABS`) define Lucide icons rendered across desktop sidebar submenus, mobile Dock panels, mobile subsection tabs, and header breadcrumbs.
- **Breadcrumb active leaf hierarchy (`DashboardBreadcrumb.tsx`) & symmetric exit animations:** When a subsection is active, `DashboardBreadcrumb` renders the terminal subsection crumb as the bold active `<BreadcrumbPage>` (`aria-current="page"`, `font-semibold text-sidebar-text`) and keeps the parent section crumb muted (`font-medium text-sidebar-muted`) instead of bolding the parent. Across all expandable accordions, menus, popovers, and drawers (`VerticalControls.tsx`, `GroupActions.tsx`/`GroupSettingsMenu.tsx`, `SegmentActions.tsx`/`SegmentSettingsMenu.tsx`/`useCardHeaderLayout.ts`, `DashboardDrawers.tsx`/`AutomationsDrawer.tsx`, `TrellisChromeBar.tsx`, `IconPicker.tsx`, `AddSegmentForm.tsx`, `StabilitySection.tsx`, `MacrosSection.tsx`, `LowDataModeBanner.tsx`, `SegmentControls.tsx`, `WorkflowHeaderBar.tsx`), conditional mounting happens inside `<AnimatePresence>` (for `createPortal(..., document.body)` popovers like `SegmentSettingsMenu`, `<AnimatePresence>` mounts inside the portal while `useCardHeaderLayout` preserves `menuPosition` until exit completes so the menu fades out in-place rather than jumping to `-9999px`), `VerticalControls` uses `EASE_IN_OUT` height collapse + `EASE_IN` tail fade with reverse item stagger (avoiding compounded `EASE_OUT` opacity fades that turn exiting menus invisible in the first frames), accordions avoid `mode="popLayout"`, and reduced-motion/animation toggles are consistently honored.
- **Test & documentation hygiene:** Removed UI-focused and temporary tests (`mobile-dock.test.mjs`, `lazy-icons.test.mjs`, `performance-tier.test.mjs`, `dynamic-retry.test.mjs`, plus UI/CSS/layout/motion/DnD blocks inside `domain-contracts.test.mjs` and `legacy-seams.test.mjs`) and temporary verification artifacts. Repository policy strictly prohibits UI/throwaway tests and browser E2E automation tooling, and requires updating docs immediately after code changes.

## 18. Platform capability upgrades (19 November 2026)

- **React 19.3 (`useEffectEvent`, `<Activity>`, and `ViewTransition` / external-store discipline):**
  - `features/iot/components/sortable-segment-card/hooks/useOptimisticPinState.ts` tracks per-card in-flight command state (`isPending`) with local state while delegating zero-lag optimistic pin updates and automatic failure rollback directly to `executeSinglePinUpdate` on `useIoTStore`. **Invariant:** Never wrap external Zustand store pin mutations (`onTogglePin` / `onSetPinState`) in React's `startTransition`; `DashboardWorkspace` is wrapped in Motion's `<AnimateView>` (React 19.3 `<ViewTransition>`), which triggers a full-workspace `document.startViewTransition()` snapshot whenever a `TransitionLane` commits inside its subtree (such as when a Cloudflare pin-save request completes and displays its toast). Similarly, `WorkspaceGrid` and `SortableSegmentCard` do not re-render on global `isLoadingIoT` transitions.
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
- **Web Vibration API (`lib/haptics.ts`) & Mobile Web Audio (`lib/audio/{context,effects,index}.ts`):**
  - `lib/haptics.ts` provides safe semantic haptic patterns (`tap`, `toggleOn`, `toggleOff`, `push`, `macro`, `voice`, `success`, `error`) calibrated above AOSP/Motorola vibrator actuation thresholds (`>= 22ms`) with single-pulse fallback if an OEM HAL rejects array waveforms, gated strictly on browser support, visible tab state, and the persisted `hapticsEnabled` preference exposed via `features/settings/components/stability-section/HapticsToggle.tsx` (never silently suppressed by Android reduced-animation / battery-saver flags).
  - `lib/audio/{context,effects,index}.ts` unlock and silently prime the `AudioContext` on early `pointerdown`/`touchstart`/`keydown` gestures (and re-prime after returning from background), schedule synth tones through `runWithContext()` only after `ctx.resume()` resolves to `"running"`, disconnect finished oscillator/gain nodes, and apply mobile-calibrated gain and click duration (`isMobileAudioDevice()`) so MIUI/Redmi speakers do not gate short UI tones while leaving desktop audio unchanged.
- **File System Access API & Web Share API (`lib/fileTransfer.ts`, `configBackupService.ts`, `BackupRestoreSection.tsx`):**
  - `lib/fileTransfer.ts` provides native `showSaveFilePicker` / `showOpenFilePicker` JSON file I/O (with automatic fallback to `<a download>` and `<input type="file">` inside restricted contexts) and `navigator.canShare` / `navigator.share` (`Web Share API` with File attachment or text/clipboard fallback).
  - `features/iot/services/configBackupService.ts` and `features/settings/components/stability-section/BackupRestoreSection.tsx` allow exporting, sharing, and restoring full dashboard backup bundles (`home-control-backup-v1`: `EspConfig` + `usePreferencesStore` Trellis layouts/haptics + `WorkflowStudioState`) as well as standalone `EspConfig` JSON files.
- **Workflow Studio Sub-flows/Grouping, Undo/Redo, Clipboard & JSON I/O (`features/iot/components/workflows/`):**
  - **Sub-flows / Node Grouping (`parentGroupId`, `workflowSubflowHelpers.ts`):** Nodes can be grouped into a `kind === "group"` sub-flow container box via `Ctrl+G`, the header/footer `Boxes`/`Unlink` button, or by dragging and dropping a node inside a group container. Dragging a parent group moves all nested child nodes in lockstep.
  - **Undo / Redo & Copy / Paste / Duplicate (`useWorkflowHistoryAndClipboard.ts`):** Per-workflow bounded undo/redo stack (40 snapshots) covering node/edge creation, deletion, property edits, drag moves, and resizes (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`), plus node/sub-flow clipboard Copy (`Ctrl+C`), Paste (`Ctrl+V`), Duplicate (`Ctrl+D`), and `Delete`/`Backspace` shortcuts alongside footer toolbar controls.
  - **Workflow JSON Export / Share / Import:** `WorkflowHeaderBar.tsx` and `WorkflowEmptyState.tsx` support exporting individual workflows to `.workflow.json`, sharing via `Web Share API`, and importing workflow JSON files with automatic ID deduplication.

## 19. Codebase Knowledge Graph (`codebase-memory-mcp`) & Token Tooling (`rtk`, `TokenEconomizer`)

- **`codebase-memory-mcp` (`v0.12.1`, pinned in `./tools/cbm.sh`):** Cached in `/.agent-state/cbm/bin/` (`ensure` restores offline and keeps the warm background daemon active), configured via `.cbmignore`, with portable graph `.codebase-memory/graph.db.zst` (project identifier: `app-applet`).
  - Use `bun run r -- bun run cbm <tool> --project app-applet` (`search_graph`, `trace_path`, `query_graph`, `get_architecture`, `detect_changes`) for **unknown structural discovery**, then switch immediately to parallel native `view_file` (`~2ms`) or `bun run r -- grep`. Keep `cbm` calls to 1–2 per turn and refresh `.codebase-memory/graph.db.zst` with `bun run cbm:index` after meaningful changes.
- **`rtk` (Rust Token Killer `v1.2.1`, pinned in `./tools/rtk.sh`) in Lite Mode:** Installed at `/usr/local/bin/rtk` (`awareness.level = "default"`, `colors = false`, `emoji = false`, `pro_hint = false`, `telemetry.enabled = false`, lossless SQLite gzip recall store via `rtk recall <hash>`, `.rtk/pipeline.toml` `home-control-lite`).
- **`TokenEconomizer` + `rtk` + `cbm` Persistent Vault & Unified Bridge (`/.agent-state/`, `./tools/agent-bridge.py`, `./tools/r`):**
  - All three tools persist binaries, `history.db`, Lite Mode config, self-contained stdlib plugin bundle, and learned repository state inside gitignored/cbm-ignored `/.agent-state/{rtk,tokeneconomizer,cbm}` and restore symlinks + `+x` permissions offline in milliseconds.
  - Prefer **`bun run r -- <cmd>`** (or `bash ./tools/r <cmd>`) so execution succeeds even if `+x` bits reset. `agent-bridge.py` unwraps `bun run {typecheck,lint,format,lint:ox,test,build,check}` into native `rtk` filters (`rtk tsc`, `rtk err bunx biome/oxlint`, `rtk test`, `rtk next`, avoiding `rtk:passthrough` `0`-token gaps and keeping `cbm` unwrapped), emits Claude-format events/transcripts to `te-hook --host claude`, auto-folds stale sessions (`>60s` on explicit `start` or `>=600s` idle), and runs `te fold` on `end`.
  - Run **`bun run tools:check`** for a single-command health, permission, symlink, and index check across `rtk`, `TokenEconomizer`, and `codebase-memory-mcp`. Note: `te status`'s `effective tokens` metric requires LLM API usage blocks from a native host CLI transcript and stays `0` in AI Studio's sandbox, while `rtk gain` tracks exact CLI output token savings.

- **Empty zoom-readout cache fast path (`sheetViewportAnimator.ts`):** when the gesture hook has already primed an empty readout cache, per-frame viewport updates skip document-wide badge discovery. A `null` cache still allows the initial discovery fallback; non-empty cached elements retain the existing text update behavior. This reduces avoidable main-thread DOM queries without changing camera or grid rendering.
## 20. Canvas Sheet Kinetic & Spatial Motion + 60 FPS Compositor Pipeline (`sheetViewportAnimator.ts`, 20 November 2026)

- **Unified Multi-Touch Pointer/Pinch State Machine (`useSheetViewportGestures.ts`):**
  - Both `CanvasWorkspace` and `WorkflowStudio` use a single mutually-exclusive pointer-ID-locked state machine (`idle` | `pan` | `scroll-child` | `pinch`) driven by capture-phase `touch` pointer tracking + `window` pointer listeners, completely eliminating the pre-pinch stale-coordinate jump when transitioning `1 ↔ 2` fingers (`2 → 1` finger release re-anchors `pan` cleanly to `viewportRef.current` with a `150ms` / `28px` post-pinch inertia guard).
  - Single-finger touch inside overflowing `[data-canvas-scroll-area="true"]` containers (`CanvasGroupBody`) smoothly delegates vertical scroll (suppressing accidental button clicks after `6px`), while `2`-finger touch anywhere on the sheet—including over cards or buttons—immediately transitions into focal pinch-to-zoom (`clampCanvasZoom` `0.001` precision).
  - Node drag/resize (`useCanvasNodeInteractions.ts`, `useWorkflowInteractions.ts`) filter strictly by `pointerId`, apply a `4.5px` touch drag threshold in Canvas, and abort cleanly on multi-touch pinch or `blur`.
- **Zero-Repaint GPU Compositor Pipeline (`sheetViewportAnimator.ts`, `canvasGeometry.ts`, `nodeMotion.ts`):**
  - Instead of mutating `backgroundSize` / `backgroundPosition` on the full-viewport container every frame or mutating `rotate`/`translate` across dozens of inner node layers during sheet pan/inertia, `applyViewportToDom` updates `worldPlaneRef.style.transform` (`translate3d(...) scale(...)`), translates a dedicated oversized `gridLayerRef` (`getCanvasGridTransform`, `inset: -48px`) via `translate3d(...)` (updating `backgroundSize` only when `visualStep` changes), and updates cached `[data-sheet-zoom-readout="true"]` badges with zero React re-renders.
  - `CanvasGroupNode`, `CanvasSegmentNode`, and `WorkflowNodeCard` apply `contain: layout style`, use frozen static motion target objects in `resolveCanvasNodeMotionState`, `CanvasChromeBar` and `WorkflowFooterControls` avoid full-pass `backdrop-blur` over moving canvases, and `CanvasWiresLayer` uses a single particle `<animateMotion>` circle per active wire.
- **Mobile & Tablet Responsive Ergonomics (`canvasGeometry.ts`, `useCanvasController.ts`, `CanvasChromeBar.tsx`, `CanvasResizeHandles.tsx`):**
  - `buildDefaultCanvasNodes` calibrates node/column sizing across `"mobile"` (`< 640px`), `"tablet"` (`640px–1023px`), and `"desktop"` (`>= 1024px`) tiers (`resolveCanvasViewportTier`), while `computeFitCanvasViewport` and `computeFitWorkflowViewport` accept asymmetric `insets` so fitted nodes center inside the unobstructed viewport between the top chrome bar and bottom `MobileDockNav`.
  - On `< md` viewports (`!footerSlot`), `CanvasChromeBar` provides `32px+` top capsule controls (`گروه‌ها` | `قطعات`, `Fit`, `Lock`, `Reset Layout`) plus a dedicated one-handed thumb zoom capsule (`+`, live `%` tap-to-fit readout, `-`) anchored above `MobileDockNav`, and `CanvasResizeHandles` / `WorkflowNodeResizeGrip` enlarge corner touch hit areas (`size-9 sm:size-7`, tagged `data-canvas-resize="true"`).

## 21. ESP32 Analog Output (`analog_output` / LEDC PWM) Support (19 November 2026)

- **Domain helpers & pin validation (`features/iot/utils/analogOutput.ts`, `pinValidation.ts`):**
  - Canonical segment type is `"analog_output"` (normalizing legacy `"pwm_output"` alias in Cloudflare mappers). Clamps LEDC resolution (`8..12` bits, default `8` → `0..255`, max `4095`), frequency (`100..40000` Hz, default `5000`), and raw duty cycle (`0..maxDuty`) with percentage conversion helpers.
  - `validateEsp32Pin(pin, "analog_output")` rejects SPI Flash (`6..11`) and input-only pins (`34, 35, 36, 39`) and emits a non-blocking boot/UART warning for pins `0, 1, 3` while preserving monomorphic 3-key return objects.
- **Zustand store & Cloudflare config (`createSegmentsSlice.ts`, `createConfigSlice.ts`, `cloudflare/mappers.ts`, `cloudflare/api.ts`):**
  - `SegmentsSlice` adds `pinsAnalogValue`, `pinsLastNonZeroValue`, and `pinsPwmResolution` alongside `pinsState` and `pinsTimer` (bridged through `storeBridge.ts` and hydrated from Cloudflare config without overwriting live ESP32 RAM state).
  - `updateAnalogPinOnCloudflare` posts backwards-compatible `{ value: isOn, state: isOn, analogValue }` payloads to `POST /pins/:pin`.
- **Binary MQTT & Local WebSocket protocol (`mqtt/protocol.ts`, `pinPublishers.ts`, `segmentPublishers.ts`, `messageParser.ts`, `mqtt/init.ts`, `useConnectionStrategy.ts`, `deviceGatewayAdapter.ts`):**
  - **Opcode `0x0A` (`SET_ANALOG_OUTPUT`, 8-byte LE frame):** `[0x0A, pin:u8, value:u16LE, timerSeconds:u32LE]` for real-time PWM duty control (and Local WebSocket `{"command":"set_state","pin":P,"value":V,"timer":T}`).
  - **Extended Opcode `0x02` (`ADD_SEGMENT`):** appends a 5-byte PWM tail (`res:u8`, `freq:u16LE`, `initVal:u16LE`) when adding `analog_output` segments.
  - **Opcode `0x0B` (`UPDATE_RULE_ANALOG`, 13-byte action records, max 4/side):** automatically selected by `publishUpdateRuleCommand` whenever any rule action specifies an explicit `targetValue >= 0` (`-1` preserves boolean/last-non-zero mode); pure boolean rules continue using Opcode `0x05`.
  - **Incoming telemetry (`command_ack`, `pin_update`, `state_sync`):** parses optional `value`/`resolution` and `values`/`resolutions` maps cleanly (omitting absent keys to preserve legacy snapshot contracts) and preserves active Auto-Off countdowns on ON acknowledgments.
- **UI controls across Grid, Trellis, Canvas, Modules, Conditions & Macros:**
  - `AnalogOutputBody.tsx` (mounted via shared `CardBody.tsx`) pairs a boolean Power toggle (`0x01`, restoring `lastNonZeroValue` or `maxDuty`) with a `DashboardSlider` (`defaultVariant="fluid"`, overridable via Settings) throttled to `100ms` (`persistToCloud: false` during drag) and immediate final flush on release (`onValueCommit` with `persistToCloud: true`), plus `onPointerDown` propagation stopping so drag-and-drop and Canvas panning never conflict with slider dragging.
  - `SegmentSettingsMenu.tsx` shows live PWM `% (duty/maxDuty)`, resolution, and frequency; `SegmentControls.tsx` hides the switch/push toggle while retaining Auto-Off timers.
  - `AddSegmentForm.tsx`, `PinSelector.tsx`, `SegmentList.tsx`, `ConditionActionItem.tsx`, `ConditionsSection.tsx`, and `MacrosSection.tsx` support adding `analog_output` modules (recommended PWM pin quick-picker, resolution/frequency/initial brightness), defining exact PWM duty or boolean rules (`0x0B`), and selecting PWM outputs in macros.

## 22. Adaptive beUI Motion Slider Suite & Settings Switcher (19 November 2026)

- **All 6 beUI motion slider primitives (`components/motion/range-slider*.tsx`):**
  - `range-slider.tsx` (`RangeSlider`), `range-slider-inline.tsx` (`InlineSlider`), `range-slider-fluid.tsx` (`FluidSlider`), `range-slider-wave.tsx` (`WaveSlider`), `range-slider-bubble.tsx` (`BubbleSlider`), and `range-slider-ruler.tsx` (`RulerSlider`) all share `lib/hooks/use-slider.ts`, `lib/touch.ts`, and `lib/ease.ts`, adapted to `LazyMotion` (`m.*`), RTL-safe LTR track geometry (`dir="ltr"`), and `onValueCommit` release callbacks.
- **Unified adaptive facade (`components/motion/dashboard-slider.tsx` & `lib/sliderStyles.ts`):**
  - `DashboardSlider` reads `sliderStyle` (`"auto" | "inline" | "range" | "fluid" | "wave" | "bubble" | "ruler"`) from `usePreferencesStore` (persisted locally in `home-control-preferences-v1` and included in `configBackupService.ts` backups without altering `EspConfig` / Cloudflare KV payloads).
  - In `"auto"` mode (default), each dashboard slot renders its best-fit UX variant: `FluidSlider` for PWM dimmer cards (`AnalogOutputBody`), `InlineSlider` for theme darkness/whiteness (`ColorsSection`), `RulerSlider` for Auto-Off timers (`SegmentControls`), `BubbleSlider` for initial PWM intensity (`AddSegmentForm`), and `RangeSlider` for exact PWM rule targets (`ConditionActionItem`). Large raw ranges (such as 12-bit PWM `0..4095` or `0..600s` timers) automatically use `rulerScale` adaptation in `RulerSlider` to cap DOM ticks cleanly.
- **Appearance Settings switcher (`features/settings/components/colors-section/SliderStyleSection.tsx`):**
  - Mounted inside `ColorsSection.tsx` alongside `FontSection`, exposing `"auto"` plus all 6 beUI slider designs with an interactive live preview and instant dashboard-wide switching.

## 23. 60 FPS Main-Thread, Subscription, Async/Idle & Compositor Pipeline (19 November 2026)

### Phase 1 — Subscription, MQTT Batching, Context & CSSOM
- **Zero-broadcast `useAutoOffTimer` & no-op slice guards (`useAutoOffTimer.ts`, `createSegmentsSlice.ts`):**
  - `useAutoOffTimer` subscribes to `state.autoOffRemaining[pin]` (single-pin primitive selector) instead of the entire `autoOffRemaining` map, preventing a single pin's MQTT frame from re-rendering every segment card across the dashboard, and skips redundant mount `setTimeout(..., 0)` churn on inactive cards.
  - `createSegmentsSlice` setters (`setAutoOffRemaining`, `setSegments`, `setPinsState`, `setPinsAnalogValue`, `setPinsLastNonZeroValue`, `setPinsPwmResolution`) short-circuit and return the existing `state` reference whenever unchanged, eliminating spurious Zustand subscriber notifications.
- **Single-rAF coalesced MQTT telemetry commits (`features/iot/services/mqtt/init.ts`):**
  - `createStateUpdateQueue` accepts an optional `PinTelemetryPatch` (`analogValue`, `resolution`, `clearAutoOffTimer`) alongside boolean pin state and merges all queued updates into **one atomic `requestAnimationFrame` flush**, eliminating 3–4 synchronous back-to-back store broadcasts per incoming `pin_update` packet while preserving backward compatibility for `tests/legacy-seams.test.mjs`.
- **Zero-churn pin operations & split `DashboardActionsContext` (`usePinOperations.ts`, `DashboardContext.tsx`, `DashboardWorkspace.tsx`, `WorkspaceSection.tsx`):**
  - `usePinOperations` tracks in-flight request counts in a `useRef` instead of `useState`, stopping every relay click and PWM drag tick from triggering two full-tree `DashboardContext` re-renders.
  - `DashboardContext.tsx` exposes a separate memoized `DashboardActionsContext` + `useDashboardActions()` hook so action-only subtrees (`HomeWorkspaceMainContent`, `WorkflowsCanvasSection`) remain isolated from transient state changes (`mounted`, `isFullyReady`, `targetPlaceholderId`, `workerUrl`).
- **Zero-`<style>`-reparse live CSS custom property engine (`themeStyles.ts`, `DashboardStyles.tsx`):**
  - `themeStyles.ts` splits pure `computeThemeCssVariables(...)` (22 dynamic `:root` CSS custom properties) from `getStaticThemeRules(isDark)` (keeping `getThemeStyles` backward-compatible).
  - `DashboardStyles.tsx` keeps `<style>{staticCss}</style>` strictly keyed to `(isDark, animationsEnabled)` and patches only changed CSS variables via `document.documentElement.style.setProperty(...)` synchronously on first mount/polarity flip and `requestAnimationFrame`-coalesced during continuous darkness/whiteness/accent slider drags.
- **Zero idle rAF polling & strictly user-controlled tiering (`lib/performanceTier.ts`, `lib/hooks/use-performance-tier.ts`):**
  - Removed the continuous 60 Hz idle `requestAnimationFrame(tick)` polling loop from `usePerformanceTierObserver` and locked `resolveEffectivePerformanceTier` to user-selected Settings (`animationsEnabled === false || animationsFps <= 30`), guaranteeing full animations and full visual fidelity on every device unless explicitly lowered by the user.

### Phase 2 — Asynchronous / Idle Serialization, Concurrent Switches & Workflow/Canvas Isolation
- **Reusable Idle Scheduler & Safe Storage Coalescer (`lib/asyncScheduler.ts`):**
  - `scheduleIdleTask` wraps `requestIdleCallback` (with bounded `setTimeout` fallback) and `scheduleIdleStorageWrite` / `cancelIdleStorageWrite` / `flushIdleStorageWrites` coalesce per-key `JSON.stringify` + `localStorage.setItem` writes into browser idle slices with automatic `pagehide` and `visibilitychange` (`hidden`) flush guarantees so zero user state is lost on tab close.
- **Idle-deferred Cloudflare & Web Storage serialization (`useCloudflarePush.ts`, `buildEspConfig.ts`, `useCloudflareInit.ts`, `canvasStorage.ts`, `workflowStorage.ts`, `useTrellisWorkspaceController.ts`):**
  - `useCloudflarePush` no longer executes synchronous `JSON.stringify(buildEspConfig(state))` on every 60 Hz slider/color change; it resets the `1200ms` debounce immediately and runs serialization/diffing inside `scheduleIdleTask` only after interaction settles (and establishes initial baselines on idle).
  - `cached_esp_config`, Canvas settings/nodes/viewport, Workflow Studio state, and Trellis preset writes update in-memory caches synchronously and defer `JSON.stringify` + `localStorage.setItem` to `scheduleIdleStorageWrite` (preserving synchronous writes when injected custom `storage` mocks are supplied).
- **Consolidated Workflow Runtime & Non-Pin Node Isolation (`useWorkflowRuntime.ts`, `WorkflowStudio.tsx`):**
  - All active workflow countdown timers share **one single 1-second `setInterval`** committing one batched state update per second instead of N independent timers.
  - The 30-second schedule trigger interval depends on a primitive `hasScheduleNode` boolean so dragging/moving nodes never destroys/recreates the timer.
  - `useWorkflowRuntime` scopes DAG evaluation to a lightweight signature of pins actually referenced by `activeWorkflow`, and `WorkflowStudio` passes a stable `EMPTY_PINS_STATE` object to non-pin nodes (`logic_*`, `timer`, `trigger_*`) so unrelated MQTT pin updates never break `React.memo`.
- **Concurrent Heavy Mode/Tab Deferral & Scoped Drag GPU Promotion (`DashboardWorkspace.tsx`, `IoTWorkspace.tsx`, `WorkspaceSection.tsx`, `CanvasGroupNode.tsx`, `CanvasSegmentNode.tsx`, `WorkflowNodeCard.tsx`):**
  - `workspaceDisplayMode` (`grid | trellis | canvas`) and `SettingsWorkspace`'s `ActiveSettingsPanel` tab use `useDeferredValue` so header/sidebar/dock button feedback stays instant at 60 FPS while heavy workspace engines or settings sections render concurrently (without ever wrapping urgent pin mutations).
  - Active node drags temporarily set `willChange: isDragging ? "transform" : undefined` on `CanvasGroupNode`, `CanvasSegmentNode`, and `WorkflowNodeCard` and release GPU memory immediately upon drop.

## 24. Impeccable Design Audit, Accessibility, Touch & RTL Hardening (20 November 2026)

- **Typography & Token Integrity (`app/globals.css`, `themeStyles.ts`, `WorkflowEdgeItem.tsx`, `WorkflowNodeCard.tsx`, `WorkflowCanvasGateDiagram.tsx`, `CanvasWiresLayer.tsx`, `AudioToggleButton.tsx`):**
  - Added explicit `--font-mono` token + `tabular-nums` on mono/code elements and excluded `.font-mono` from `getStaticThemeRules`'s `!important` sans override so GPIO pins, timers, Hz readouts, and logic gates render in crisp tabular monospace.
  - Replaced hardcoded workflow/canvas/audio hex & indigo glow literals with semantic tokens (`var(--success)`, `var(--color-success-soft)`, `var(--accent3-foreground)`), improved dark `--info-foreground` and light-mode warning contrast (`PinSelector.tsx`), and scoped `bezel-shell`/`bezel-core` inset highlights to dark mode.
- **Accessibility, Heading Hierarchy & RTL Logical Layout (`VerticalBrandBox.tsx`, `DashboardContainer.tsx`, `app/reui-nova.css`, `range-slider-inline.tsx`, `WorkflowNodeBodies.tsx`, `WorkflowHeaderBar.tsx`, `PlaceholderCard.tsx`):**
  - Converted sidebar brand wordmark from `<h1>` to `<div>` so every screen maintains a single primary `<h1>` inside `<main>`; upgraded `PlaceholderCard` drag handle to an accessible `<button type="button">`; restored `focus-visible` rings across `InlineSlider`, `WorkflowNodeBodies`, `WorkflowHeaderBar`, `PinSelector`, and `DashboardContainer`'s skip-to-content link; converted `.cn-alert` physical LTR classes to logical `text-start`/`pe-18`/`end-2`; and calmed `.animate-pulse` under `prefers-reduced-motion`.
- **Touch Scroll Isolation, Interrupted Gesture Hardening & Persian Input Resilience (`SortableGroup.tsx`, `GroupHeader.tsx`, `SortableSegmentCard.tsx`, `CardHeader.tsx`, `baseStyles.ts`, `lib/hooks/use-slider.ts`, `color-picker.tsx`, `lib/persianText.ts`, `PinSelector.tsx`, `WorkflowPalettePanel.tsx`):**
  - Scoped `touch-none` strictly to drag handles instead of full resting Group/Segment cards so vertical touch scrolling works smoothly over dashboard cards; gated CSS hover states on `@media (hover: hover) and (pointer: fine)`; hardened `useSlider`, `InlineSlider`, and `ColorPicker` `useDrag` with `activePointerIdRef` multi-touch isolation, `lostpointercapture`, and `window` `blur` cleanup; and added `lib/persianText.ts` (`toAsciiDigits`, `normalizePersianSearch`) so Persian/Arabic numerals (`۰-۹`/`٠-٩`) and `ي`/`ك` variants work cleanly in GPIO entry and Workflow search without stripping ZWNJ (`\u200C`).

## 25. Dashboard Color Token & SSR Theme Unification (20 November 2026)

- **SSR & Hydration Theme Synchronization (`app/layout.tsx`, `DashboardStyles.tsx`, `DashboardContainer.tsx`, `app/icon.svg`, `cloudflare/mappers.ts`):**
  - `app/layout.tsx` sets `dark` and `suppressHydrationWarning` on `<html>` to match default `isDark: true` before client hydration; `DashboardStyles.tsx` synchronizes `root.classList` (`.dark`/`.light`) and `<meta name="theme-color">` inside `useLayoutEffect`; `DashboardContainer.tsx` applies explicit `"dark" | "light"` classes; and `app/icon.svg` + `cloudflare/mappers.ts` use Graphite/Blue defaults (`#141415` / `#E5E7EB` / `#3B82F6`) rather than legacy `#D4AF37` / `#10B981` values.
- **Unified Light/Dark CSS Variables & Dynamic Accent Hover (`app/globals.css`, `themeStyles.ts`):**
  - `app/globals.css` aligns `:root, .dark` and `.light` ReUI tokens (`--background`, `--card`, `--sidebar`, `--primary`, `--secondary`, `--border`, `--muted-foreground`) alongside full `.light` dashboard custom properties (`--bg-main`, `--card-bg*`, `--border-color`, `--text-*`, `--accent3*`, `--accent4*`, `--sidebar-bg`).
  - `themeStyles.ts` separates Light Mode chrome (`deepest` `#f3f3f5`) from `--bg-main`, computes dynamic `--accent3-dark` hover shades via `computeAccentHoverHex`, and binds `--primary` / `--primary-foreground` / `--sidebar-primary*` to the active `accent3` customization.
- **Component Token & Light Mode Polish (`components/motion/range-slider*.tsx`, `AddSegmentForm.tsx`, `IconPicker.tsx`, `SegmentControls.tsx`, `MacrosSection.tsx`, `ConditionActionItem.tsx`, `ConditionActionsList.tsx`, `ConditionSegment.tsx`, `VoiceCommandsSection.tsx`, `VoiceCommandEditor.tsx`, `VoiceCommandActionsEditor.tsx`, `WifiNetworkEditor.tsx`, `CloudflareIntegration.tsx`, `BackupRestoreSection.tsx`, `AnimationsToggle.tsx`, `LowDataToggle.tsx`, `HapticsToggle.tsx`, `AutomationList`, `MobileVoiceCommandButton.tsx`, `WelcomePortal.tsx`, `LowDataModeBanner.tsx`, cards & chrome):**
  - Unified all 6 beUI motion slider variants with `accent3` and semantic track/text tokens; replaced `text-bg-main` / hardcoded `text-white` / `bg-white` switch knobs on accent/destructive surfaces with `accent3-foreground`, `accent4-foreground`, and `destructive-foreground`; unified `WelcomePortal` and `LowDataModeBanner` onto dashboard semantic tokens; and scoped white top-edge inset highlights strictly to `dark:shadow-[...]` (retaining `text-amber-800 dark:text-amber-300` on `bg-warning-soft` in `PinSelector.tsx`).

## 26. ESP32 Analog Input (`analog_input` / ADC1) Support (20 November 2026)

- **Domain helpers & ADC1-only pin validation (`features/iot/utils/analogInput.ts`, `pinValidation.ts`):**
  - Canonical segment type is `"analog_input"` (`isAnalogInputType`, `isAnalogInputSegment`, `isReadOnlyInputType`, `isReadOnlyInputSegment`).
  - Strictly enforces ESP32 **ADC1-only pins (`32, 33, 34, 35, 36, 39`)** in `validateEsp32Pin(pin, "analog_input")` (blocking ADC2 pins that conflict with active Wi-Fi and preserving monomorphic 3-key validation objects without unnecessary pull-up warnings on `34, 35, 36, 39`).
  - Clamps ADC resolution (`8..12` bits, default `12` → `0..4095`), sampling interval (`50..60000` ms, default `500`), delta threshold (`1..maxVal`, default `40`), and Schmitt-Trigger hysteresis thresholds (`0 <= atl <= ath <= maxVal`, forcing `atl = 0` when `ath = 0`), with percentage/approximate voltage (`3.3V` reference) conversions and 3 built-in sensor presets (Potentiometer, LDR, Soil Moisture/NTC).
- **Binary MQTT & Local WebSocket protocol (`mqtt/protocol.ts`, `segmentPublishers.ts`, `ports.ts`, `deviceGatewayAdapter.ts`):**
  - **Extended Opcode `0x02` (`ADD_SEGMENT`):** appends a 9-byte Little-Endian tail (`res:u8`, `sint:u16LE`, `delta:u16LE`, `ath:u16LE`, `atl:u16LE`, `buf[2] = 0x00`) when adding `analog_input` segments.
  - **Opcode `0x0C` (`UPDATE_ANALOG_INPUT_CONFIG`, 10 or 11 bytes):** `[0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]` + optional `[res:u8]` (and Local WebSocket `{"command":"config_analog_input","pin":P,"sint":...,"delta":...,"ath":...,"atl":...,"res"?:...}`) for live reconfiguration without recreating the segment.
  - **Opcode `0x0D` (`READ_ANALOG_INPUT`, 2 bytes):** `[0x0D][pin:u8]` (and Local WebSocket `{"command":"read_analog","pin":P}`) for on-demand immediate ADC sampling.
  - Reuses existing incoming telemetry (`pin_update`, `state_sync` `values`/`resolutions`/`states`) and existing Rules Engine opcodes (`0x05` / `0x0B`) driven by the firmware's Schmitt-Trigger boolean transitions (`HIGH`/`LOW`).
- **Store, Cloudflare config & Read-Only Guards (`createConfigSlice.ts`, `cloudflare/mappers.ts`, `useSegmentManagement.ts`, `useSegmentUpdates.ts`, `usePinOperations.ts`, `DashboardContext.tsx`):**
  - Normalizes and seeds `adcResolution`, `adcSampleIntervalMs`, `adcDeltaThreshold`, `adcHighThreshold`, `adcLowThreshold`, `pinsPwmResolution`, `pinsAnalogValue`, and `pinsState` from Cloudflare config and on creation.
  - Exposes `handleUpdateAnalogInputConfig` and `handleReadAnalogInput` on `DashboardActions` while guarding `executeSinglePinUpdate`, `executeAnalogPinUpdate`, Canvas group toggles, Automations `ActionBuilder`, Voice Commands, Macros, Conditions target pins, and Workflow Studio (`workflowGraphEvaluator.ts`) so `analog_input` is strictly read-only.
- **UI controls across Grid, Trellis, Canvas, Modules, Conditions & Workflow Studio:**
  - `AnalogInputBody.tsx` (mounted via shared `CardBody.tsx`) renders live `%`, `~V`, raw ADC readout, `HIGH`/`LOW` alert badge, semantic `<meter>` with visual Schmitt-Trigger hysteresis dead-zone (`ATL..ATH`), and an instant Refresh button (`0x0D`).
  - `AnalogInputConfigEditor.tsx` inside `SegmentSettingsMenu.tsx` provides live sensor preset, resolution, interval, delta, and `ATH`/`ATL` updates (`0x0C`).
  - `AddSegmentForm.tsx`, `PinSelector.tsx`, `AnalogInputSettingsPanel.tsx`, `SegmentList.tsx`, `ConditionsSection.tsx`, `ConditionSegment.tsx`, and `WorkflowNodeBodies.tsx` support creating, configuring, inspecting, and building Schmitt-Trigger / workflow rules from `analog_input` sensors.

## 27. Dimensional Drawing Reference Suite & Concentric Radius Alignment (20 November 2026)

- **Monochrome architectural spec sheets (`docs/dimensional-drawings/`):** Added self-contained Apple-style monochrome dimensional drawings measured directly from source components (`index.html`, `segment-card-sheet.html` / `UI-SEG-001`, `mobile-dock-sheet.html` / `UI-DOCK-001`, and `group-bezel-sheet.html` / `UI-GRP-001`), using variable-based dimensions, closed formulas, RTL slot architecture, exploded axonometric layer stacks, concentric corner details, and viewport/container-query schematics.
- **Concentric corner radius precision (`app/globals.css`, `SortableGroup.tsx`, `GroupHeader.tsx`, `CardFooter.tsx`):** Aligned `.bezel-core` and group inner card corners to exact concentric geometry (`calc(1.25rem - 1px - 0.375rem)` = `13px`, satisfying `R2 = R1 − B − S6 = 20 − 1 − 6`), and aligned `SwitchModeTrack` thumb radii to exact concentric geometry (`rounded-[4px]` standard = `7 − 1 − 2`, `rounded-[3px]` small = `6 − 1 − 2`).

## 28. Dashboard-Wide Compositor-Oriented Rendering Optimizations (20 November 2026)

> **Terminology and verification:** These changes favor compositor-friendly properties and reduce recurring layout/paint work. CSS `will-change`, `transform-gpu`, `translateZ(0)`, and WAAPI do not force a specific physical GPU, guarantee compositor promotion, or prove that backing surfaces reside in dedicated VRAM. The browser, OS, and driver choose the rendering path. Treat every item below as a source-level optimization candidate until verified in a browser trace on the target device.

- **Per-frame SVG Path Work Removal (`app/globals.css`, `NodePerimeterSpark.tsx`, `CanvasWiresLayer.tsx`, `WorkflowWiresSvg.tsx`):** Paired signal particles now share one WeakMap-cached transform/opacity keyframe array per curve object, avoiding duplicate Bezier sampling and string/keyframe allocation while retaining separate WAAPI timelines.
  - Replaced continuously repainted SVG perimeter/wire paths and SMIL `<animateMotion>` path-position evaluation with:
    1. Masked concentric conic-gradient layers in `NodePerimeterSpark.tsx`, animated with compositor-friendly `transform` rotation. The browser still performs initial paint/rasterization and layer composition; this avoids repeated SVG path painting, not all CPU work.
    2. Static cached Bezier `<svg>` rails paired with `CompositedBezierParticle`: Bezier geometry is sampled when endpoints change, then Web Animations API keyframes animate only `translate3d` and `opacity`. These are compositor candidates; actual layer promotion is browser-dependent. The shared component pauses when the document is hidden and respects reduced-motion.
- **Workflow Edge Hover Compositing Candidate (`WorkflowEdgeItem.tsx`):** Main Bezier strokes and endpoint rings retain stable colors during hover. Destructive hover styling is cross-faded through opacity overlays instead of animating SVG `stroke`/`stroke-opacity`. This is a compositor-friendly candidate, not a guarantee of GPU-only SVG rendering; browser layer promotion must be profiled.
- **Zero Per-Frame Layout Reflow & Clip-Path Paint in Sliders & Loaders (`range-slider-fluid.tsx`, `range-slider-bubble.tsx`, `range-slider-wave.tsx`, `range-slider.tsx`, `range-slider-inline.tsx`, `range-slider-ruler.tsx`, `loader-shapes.tsx`):**
  - `FluidSlider` replaces per-frame `clipPath: inset(...)` painting with `ResizeObserver`-measured pixel `fillX` sliding and exact `-fillX` label counter-translation (`willChange: "transform"`), preserving glyph-for-glyph text inversion and rounded liquid caps while making the animated fill compositor-friendly.
  - `BubbleSlider` replaces CSS `width` and `left` layout animations with `origin-left scaleX` fill and transform-based thumb/bubble translations.
  - `WaveSlider` replaces `32` concurrent JS Motion spring instances with `scaleY(...) translateZ(0)` CSS transitions (`will-change-transform`) and staggered delays; actual compositor execution is browser-dependent.
  - `RangeSlider`, `InlineSlider`, `RulerSlider`, and `Percent` loader use fills/strips/bars (`scaleX` / `translate3d`) as compositor-oriented animations; no dedicated-VRAM allocation is guaranteed.
- **Blur Pass & Software Transition Cleanup (`expandable-tabs.tsx`, `dock.tsx`, `action-swap-variants.ts`, `action-swap.tsx`, `color-picker.tsx`, `theme-toggle-config.ts`, `AnalogInputBody.tsx`, `AnalogOutputBody.tsx`, `CardFooter.tsx`, `SegmentControls.tsx`, `SegmentSettingsMenu.tsx`, `GroupSettingsMenu.tsx`, `WorkflowPalettePanel.tsx`, `WorkflowHeaderBar.tsx`, `WorkflowStudio.tsx`, `WorkflowNodePorts.tsx`, `AudioTrackInfo.tsx`, `VoiceTranscriptOverlay.tsx`, `MacroSidebar/index.tsx`, `button-variants.ts`, `cursor-svg.tsx`):**
  - Eliminated offscreen nested/character `filter: blur(...)` texture reallocations in `ExpandableTabs`, `ActionSwap`, and `ColorPicker`, dead `backdrop-blur-xl`/`backdrop-blur-md` passes on opaque `bg-card-bg-solid` menus and moving Workflow canvas chrome, `AnalogInputBody` telemetry `width` reflows (`scaleX translateZ(0)`), and `transition-all`/`box-shadow` transitions, while applying scoped compositing hints (`will-change`, `transform-gpu`, `backface-visibility: hidden`) to active dots, thumbs, cursor layers, and ViewTransition textures.
  - The stationary `Dock` shell no longer forces an additional `transform-gpu` promotion; only its moving active pill retains a scoped transform hint. The existing backdrop filter may still require browser-managed compositing/raster resources, and the dock surface styling is unchanged.
  - In the `"lite"` tier, the `circle-blur` theme transition switches to the non-blurred circle reveal and overrides the injected `will-change: clip-path, filter` with `will-change: clip-path` plus `filter: none`, avoiding an unnecessary filter promotion while retaining the circular reveal.

## 9. Android APK build

The Android shell uses Capacitor 8.6.2 and packages the existing static Next.js export; it does not duplicate the React UI or change the MQTT/WebSocket application services.

- `capacitor.config.json` declares the native application ID/name and points `webDir` to `out`.
- `bun run android:prepare` installs the pinned Capacitor 8 packages without changing `package.json` or `bun.lock`, then generates the Android platform if it is not present.
- `bun run android:apk` runs the production static export, synchronizes Capacitor assets, and invokes Gradle `assembleDebug`.
- `android/app/build/outputs/apk/debug/app-debug.apk` is the installable debug artifact.
- `.github/workflows/android-apk.yml` builds on GitHub-hosted Ubuntu and uploads the APK as a workflow artifact. The workflow uses Node.js 22, Java 21, and Android SDK API 36. Google's Android CLI installs Platform Tools, Android Platform 36, and Build Tools 36.0.0 via `android sdk install`, avoiding the deprecated `sdkmanager` interface. GitHub Actions use Node 24-compatible major versions (`checkout@v7`, `setup-node@v7`, `setup-java@v6`, `upload-artifact@v6`).

This is an APK-only development pipeline. It intentionally excludes AAB, release signing, Google Play, OTA updates, and GitHub Releases. The generated Android project is created during preparation/CI rather than committed in this initial APK-only bootstrap. The first successful CI build and real-device validation are still required before claiming native runtime compatibility.


## 10. Android APK distribution

- The `Android APK` workflow runs on pushes to `main` and manual dispatch, builds only `app-debug.apk`, and retains the Actions artifact for 30 days.
- After artifact upload, the workflow creates a GitHub **pre-release** and attaches the same APK. It uses the built-in GitHub CLI and the workflow token with `contents: write`; no third-party release action is required.
- Release tags and Actions artifact names include both `<run-number>` and `<run-attempt>`. Including the attempt number keeps reruns of the same workflow run from colliding with an existing tag, release, or artifact. Pre-releases are explicitly excluded from the repository's Latest release.
- The attached file is an **unsigned debug APK** for development and manual device validation. A GitHub Release does not make it a production-signed APK; release signing remains out of scope until separately approved.
- GitHub Packages is not used because this deliverable is a downloadable APK asset, not a package-registry artifact.


## 29. WebGL 2 3D LUT rendering foundation (20 November 2026)

- `lib/gpu/lut3d.ts` parses bounded standard 3D `.cube` LUT files (2–64 edge length), validates the domain and entry count, and creates identity LUTs.
- `lib/gpu/webgl2-lut-renderer.ts` owns a WebGL 2 context, uploads the source image and a `TEXTURE_3D` LUT, and applies color grading in a fragment shader using a fullscreen triangle. It uses immutable RGBA16F LUT storage populated from Float32 values, linear filtering, no mipmaps, no GPU-to-CPU readback, and explicit resource disposal. Shader initialization is asynchronous: when `KHR_parallel_shader_compile` is supported, program completion is polled without a premature blocking status query; browsers without it use the synchronous compatibility path.
- `components/gpu/GpuLutImage.tsx` is an opt-in image surface. It lazily creates the context near the viewport, redraws on content/size changes rather than running a permanent frame loop, sizes its backing buffer from the device DPR subject to the WebGL viewport/renderbuffer limits and a 4096-pixel maximum edge, and keeps the original image as a fallback when hardware WebGL 2 is unavailable or the context is lost.
- The component is intentionally not mounted globally. Apply LUT grading only to non-semantic decorative imagery; do not recolor live device states, warning colors, controls, text, charts, or theme tokens.
- This is a source-level foundation, not a measured production integration. Browser/OS policy still selects the physical GPU, and runtime GPU memory, context count, shader output, and visual quality must be profiled before wider adoption. See `docs/performance/GPU-RENDERING.md`.


- **Exact identity-LUT bypass (`lib/gpu/lut3d.ts`, `components/gpu/GpuLutImage.tsx`):** `isIdentityLut()` recognizes an exact Float32 identity grid and standard domain. `GpuLutImage` keeps the original browser image visible and skips WebGL context/resource allocation for identity LUTs or non-positive intensity; a live transition back to identity disposes its renderer and hides the overlay. Creative LUTs continue through the existing WebGL2 shader. This is a no-op fast path, not a global LUT filter or a claim that browser image decode/DOM work uses VRAM exclusively.
