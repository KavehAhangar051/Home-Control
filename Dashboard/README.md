# Home Control Dashboard

A browser-based dashboard for monitoring and controlling ESP32-based home-automation devices. The project focuses on a modular React UI, device communication over MQTT/WebSocket transports, and configurable dashboard/settings experiences.

## Features and project areas

- Multi-workspace dashboard and IoT UI (`Grid`, `Trellis`, infinite `Canvas`, and node-based `Workflows` studio).
- IoT feature modules for ESP32 device communication over MQTT (WebSocket), local WebSocket, and Cloudflare KV sync.
- Settings UI for theme/appearance presets (Light/Dark View Transitions, accents, contrast), typography, stability/FPS mode, and broker configuration.
- Responsive RTL navigation: vertical right-rail header (`MasterHeader`) + footer on desktop (`md:`+), and a floating bottom Dock with upward-expanding `ExpandableTabs` panels and integrated voice trigger (`MobileDockNav`) on mobile (`< md`), alongside browser Web Audio feedback (`lib/audio`).
- Static-site export and GitHub Pages deployment workflow.

Device availability depends on the ESP32 firmware, network connectivity, broker/socket configuration, and browser security policies. A successful UI command publish does not by itself guarantee that a physical device changed state.

## Technology

- Next.js 16.4 App Router (`output: "export"` + Turbopack + React Compiler), React 19.3, TypeScript 7
- Tailwind CSS v4 and PostCSS
- Zustand 5 (`features/iot/hooks/useIoTStore.ts`) for client and hardware state
- MQTT.js (async WebSocket transport) and native WebSocket client
- Motion 14 (`LazyMotion` + async `domMax` + `AnimateView`), `@dnd-kit/react` / `@dnd-kit/dom`, Base UI, and `@danfessler/trellis-react`
- Biome (lint/format), Oxlint diagnostic audit, and `node:test` deterministic suite

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current source layout, module responsibilities, communication constraints, and contributor guidance. See [DESIGN.md](DESIGN.md) for verified UI conventions, [docs/dimensional-drawings/index.html](docs/dimensional-drawings/index.html) for source-derived monochrome UI dimensional drawings (`UI-SEG-001`, `UI-DOCK-001`, `UI-GRP-001`), and [docs/TECHNOLOGY-ROADMAP.md](docs/TECHNOLOGY-ROADMAP.md) / [docs/performance/60-FPS-STRATEGY.md](docs/performance/60-FPS-STRATEGY.md) for the active optimization direction.

## Requirements

- Node.js 20.9.0 or newer
- Bun (`bun@1.4.4`, matching `bun.lock`)

## Local development

```bash
git clone https://github.com/KavehAhangar051/Home-Control-Dashboard.git
cd Home-Control-Dashboard
bun install --frozen-lockfile
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

If a feature requires environment values, copy the example file and fill in only the values you need:

```bash
cp .env.example .env.local
```

Do not commit `.env.local`, real credentials, private broker details, or API keys. Values embedded in a static client-side application are visible to users; do not put secrets in client-side configuration.

## Available commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Next.js development server with Turbopack |
| `bun run dev:webpack` | Start the Webpack dev workflow (`DISABLE_HMR=true` compatibility) |
| `bun run build` | Run the production static export (`out/`) with Turbopack |
| `bun run analyze` | Capture a Turbopack bundle analysis snapshot under `.next/diagnostics/analyze` |
| `bun run analyze:export` | Export the saved Turbopack bundle analyzer graph as JSON Lines |
| `bun run lint` | Run Biome lint checks across `app`, `components`, `features`, and `lib` |
| `bun run lint:ox` | Run Oxlint + Anti-Slop diagnostic checks |
| `bun run typecheck` | Run TypeScript compiler checks (`tsc --noEmit`) |
| `bun run test` | Run core domain, MQTT/ESP32 protocol, and sync tests (`tests/*.test.mjs`; excludes UI/throwaway tests) |
| `bun run check` | Run lint, typecheck, and core domain tests together |
| `bun run format` | Format source directories in place with Biome |
| `bun run clean` | Remove `.next`, `out`, and `tsconfig.tsbuildinfo` |
| `bun run start` | Run the Next.js server; not intended to preview the static `out/` export |
| `bun run serve:static` | Run the zero-dependency production static server for `out/` with compression negotiation |
| `bun run r -- <cmd>` | Run a shell command through the unified `rtk` + `TokenEconomizer` bridge |
| `bun run ov` / `bun run ov:doctor` | Run OpenViking CLI, manage local Ollama, or verify server/plugin/MCP health |
| `bun run ov:server` / `bun run ov:mcp` | Manage local `openviking-server` daemon or run the OpenViking stdio MCP proxy |
| `bun run tools:check` | Verify and auto-repair `rtk`, `TokenEconomizer`, `cbm`, `ov`, `ollama`, symlinks, and permissions |
| `bun run android:prepare` | Bootstrap Capacitor Android platform (`@capacitor/android@8.6.2`) |
| `bun run android:apk` | Build Next.js static bundle (omitting web compression sidecars) and assemble debug APK |

Run `bun run lint`, `bun run typecheck`, and `bun run build` before submitting changes when possible, and update relevant documentation (`ARCHITECTURE.md`, `DESIGN.md`, `docs/*`) immediately after code changes.

## GitHub Pages

The Next.js configuration applies the `/Home-Control-Dashboard` base path and asset prefix when `GITHUB_PAGES=true`. The deployment workflow is located at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

The repository must have GitHub Pages configured to deploy using **GitHub Actions**. A workflow file alone does not enable Pages in repository settings. Check the Actions run and Pages settings if deployment fails.

## Repository hygiene

Keep source, documentation, lockfiles, and required static assets under version control. Always update docs immediately after code changes so they remain trustworthy, avoid authoring temporary or UI-detail unit tests, and do not commit local environment files, dependencies, build output, console logs, temporary verification artifacts, credentials, or temporary migration files. The `.gitignore` file defines the primary exclusions.

## License

No license is declared in this repository yet. Do not assume the code is available for unrestricted reuse until a license is added.

## Android APK (debug)

The Android app is built from the same Next.js dashboard using Capacitor 8. The Android platform is generated locally/inside CI; the web bundle is exported to `out/` and packaged into the APK.

Requirements: Node.js 22+, Bun 1.4.4, Java 21, and Android SDK Platform 36.

Prepare the Capacitor Android platform and build an installable debug APK:

```bash
bun install --frozen-lockfile
bun run android:prepare
bun run android:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. The Android build sets `CAPACITOR_BUILD=true`, which removes/omits generated `.gz` and `.br` sidecars from `out/` before Capacitor sync; these web-server compression variants must not be bundled as Android assets alongside their original files.

The `Android APK` GitHub Actions workflow runs on pushes to `main` and can also be started manually from the Actions tab. It installs Google's Android CLI and uses `android sdk install` for Platform Tools, Android Platform 36, and Build Tools 36.0.0; this avoids the deprecated `sdkmanager` interface. The workflow uses Node.js 22, Java 21, current Node 24-compatible GitHub Actions, uploads the debug APK as a downloadable artifact (30-day retention), and attaches the same APK to a uniquely tagged GitHub **pre-release**. Artifact names and release tags include `<run-number>-<run-attempt>`, so workflow reruns do not collide. Releases are explicitly marked as unsigned debug builds, not production-signed releases. This pipeline produces **APK only**: it does not build an AAB, configure release signing, publish to Google Play, or depend on GitHub Pages.

Capacitor packages are installed with Bun's `--no-save` option by the preparation script so the existing application dependency manifest and lockfile remain unchanged during this initial bootstrap. The package versions are pinned together at 8.6.2.
