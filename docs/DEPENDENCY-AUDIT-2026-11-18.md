# Direct Dependency Audit — 18 November 2026

## Result

The committed `bun.lock` was compared with the latest stable releases available on 18 November 2026. **No direct dependency upgrade is currently required.** Every reviewed runtime and development dependency resolves to its current stable release, or to the current stable major/minor line where the upstream project documents releases at that level.

No package or lockfile changes were made. The package manifest intentionally keeps semver ranges; `bun.lock` records the exact reproducible resolutions. Do not tighten every range merely to make the manifest resemble the lockfile.

## Locked versions and release checks

| Package | Locked version | Latest stable check / note |
|---|---:|---|
| `@animate-ui/react` | 2.4.6 | Current release; 2.4.6 published 15 Nov |
| `@base-ui/react` | 1.9.0 | Current stable release |
| `@danfessler/trellis` | 0.3.0 | Current published stable package |
| `@danfessler/trellis-react` | 0.3.0 | Current published stable package |
| `@dnd-kit/dom` | 0.5.3 | npm `latest` |
| `@dnd-kit/react` | 0.5.3 | npm `latest` |
| `lucide-react` | 1.74.0 | npm `latest` |
| `motion` | 14.14.0 | Current Motion release; includes the LazyMotion async-hydration blink fix |
| `mqtt` | 5.16.1 | Latest GitHub release checked |
| `next` | 16.4.6 | Latest GitHub stable release checked |
| `postcss` | 8.5.33 | npm `latest` |
| `react` / `react-dom` | 19.3.1 | Current React 19.3 stable line |
| `zustand` | 5.1.0 | Latest stable release checked |
| `@biomejs/biome` | 2.6.8 | Latest GitHub stable release checked |
| `oxlint` / `@oxlint/plugins` | 1.94.0 | Current npm `latest` |
| `@tailwindcss/postcss` / `tailwindcss` | 4.3.5 | Current Tailwind CSS release |
| `typescript` | 7.0.2 | Latest GitHub stable release checked |
| `@typescript/typescript6` | 6.0.2 | Test-loader compatibility API; keep separate from the app compiler |
| `@types/node` | 26.6.6 | npm `latest` |
| `@types/react` / `@types/react-dom` | 19.3.0 | npm `latest` |
| `babel-plugin-react-compiler` | 1.0.0 | Current stable npm tag |
| Bun (CI/runtime) | 1.4.4 | Latest GitHub stable release checked |

## Primary release sources

- [Next.js 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6)
- [React versions](https://react.dev/versions)
- [TypeScript 7.0.2](https://github.com/microsoft/TypeScript/releases/tag/v7.0.2)
- [Tailwind CSS releases](https://github.com/tailwindlabs/tailwindcss/releases)
- [Motion changelog](https://motion.dev/changelog)
- [Base UI releases](https://base-ui.com/react/overview/releases)
- [Animate UI changelog](https://animate-ui.com/docs/changelog)
- [dnd-kit React on npm](https://www.npmjs.com/package/@dnd-kit/react)
- [dnd-kit DOM on npm](https://www.npmjs.com/package/@dnd-kit/dom)
- [Lucide React on npm](https://www.npmjs.com/package/lucide-react)
- [PostCSS on npm](https://www.npmjs.com/package/postcss)
- [MQTT.js releases](https://github.com/mqttjs/MQTT.js/releases)
- [Zustand releases](https://github.com/pmndrs/zustand/releases)
- [TanStack Query release stream](https://github.com/TanStack/query/releases)
- [Biome releases](https://github.com/biomejs/biome/releases)
- [Oxlint plugins on npm](https://www.npmjs.com/package/@oxlint/plugins)
- [Node types on npm](https://www.npmjs.com/package/@types/node)
- [React Compiler on npm](https://www.npmjs.com/package/babel-plugin-react-compiler)
- [Bun releases](https://github.com/oven-sh/bun/releases)
- [Trellis core](https://www.npmjs.com/package/@danfessler/trellis) and [React adapter](https://www.npmjs.com/package/@danfessler/trellis-react)

## Decisions

1. Do not perform a version-only dependency refresh: the current lockfile already resolves the latest stable releases checked in this audit.
2. Keep `bun.lock` authoritative and use Bun for any future dependency update.
3. Treat beta, canary and prerelease tags separately; do not adopt them just because they are newer.
4. The next optimization work should focus on actual API usage, client/server boundaries, unused exports and runtime profiling—not upgrading packages whose locked versions are already current.
5. Repeat this audit when a new stable release lands or before a feature requires a newer API.
