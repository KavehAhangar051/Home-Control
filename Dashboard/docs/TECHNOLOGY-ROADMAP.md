# Technology Refresh and Engineering Direction

**Status:** Active engineering direction  
**Last reviewed:** 17 November 2026

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
- Workspace transitions use `useDeferredValue` over the Zustand-selected view and Motion's `AnimateView`. Do not assume wrapping an external-store update in `startTransition` makes it non-blocking.
- Respect both the app animation setting and `prefers-reduced-motion`.
- The experimental Playwright PR #9 was closed without merging. New browser E2E authoring is not part of the current workflow; the project owner performs hands-on UI verification.

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

- [ ] Compare every direct dependency with its latest stable release and compatibility requirements.
- [ ] Group upgrades into small, reviewable changes (patch/minor first; major versions separately).
- [ ] Regenerate and commit `bun.lock` with Bun; never hand-edit lockfile resolutions.
- [ ] Run lint, typecheck and relevant tests after each upgrade batch.
- [x] Remove three confirmed unused runtime dependencies and their unreferenced QueryProvider; regenerate `bun.lock` with Bun.
- [x] Resolve Oxlint plugin visibility and restore the missing Effect plugin rules/helpers; the PR Knip workflow now reports zero unresolved imports.

### Phase C — use platform capabilities where they help

- [ ] Audit React 19.3 capabilities such as `Activity` and `useEffectEvent` against concrete dashboard use cases.
- [x] Remove stale `optimizePackageImports` entries for removed packages and for `lucide-react`, which Next.js optimizes by default; retain only installed custom entries (`@base-ui/react`, `motion`, `zustand`).
- [x] Provide a repeatable saved-output command for the Next.js 16/Turbopack analyzer (`bun run analyze` → `.next/diagnostics/analyze`).
- [x] Expose named analyzer snapshots and JSONL graph export through `bun run analyze --snapshot <name>` and `bun run analyze:export --snapshot <name>` (Next.js 16.4+).
- [x] Add a GitHub Actions workflow that captures and uploads the JSONL graph and static analyzer report, avoiding local CLI setup for the project owner.
- [x] Move the sortable DnD hook from the global dashboard state hook into the dynamically loaded Grid workspace; the after graph confirms the global state module no longer imports DnD.
- [ ] Verify in a browser Network panel that Trellis and Canvas do not request the DnD chunk; the static graph still includes the conditional Grid preload path.
- [ ] Review Base UI and Motion coverage before introducing overlapping component or animation libraries.
- [ ] Audit Tailwind v4 CSS output, token consistency and duplicated styling patterns.

### Phase D — improve runtime UX and performance

- [ ] Profile first load, workspace switching, device state bursts and automation editing.
- [x] Gate informational MQTT connection and per-message state logs to development builds; retain warnings and errors in production.
- [ ] Reduce unnecessary client bundle and defer non-critical UI only where measurements show a benefit.
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
