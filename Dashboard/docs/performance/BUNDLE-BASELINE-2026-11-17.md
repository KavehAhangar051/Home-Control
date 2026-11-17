# Turbopack Bundle Baseline — 17 November 2026

## Capture context

- Snapshot: `before`
- Source commit: `4a1915b66f89037d6de989f8479fc267be9d2a75` (merged into `main` by commit `644f9c40f308e7d63e2f8452d9abfffd0455ac0d`)
- Analyzer: Next.js 16.4.6 with Turbopack
- Runtime: Bun 1.4.4 on Ubuntu 26.04
- Export: `bundle-before.jsonl`
- Routes represented: 4 (dashboard `/` plus the icon, not-found and global-error routes)
- Graph records: 7,411 total — 2,658 modules, 248 output records and 77 groups

The JSONL export is the source of truth for this baseline. Chunk sizes below are analyzer module-part contributions (raw and compressed), not browser timing measurements or a Lighthouse score.

## Findings

| Area | Report evidence | Interpretation |
|---|---|---|
| MQTT.js | `mqtt/dist/mqtt.esm.js`: 328,036 B raw / 96,660 B compressed; output chunk `18i9vzk8tbd4m.js`: 340,153 B / 103,765 B | Loaded through an async import from the MQTT initialization path. It is not part of the initial dashboard bootstrap; do not prioritize it as an initial-load optimization. |
| Trellis workspace | `2mxr-yalmdbpe.js`: 134,788 B / 48,419 B | Already isolated behind the Trellis workspace's dynamic import. |
| Workflow Studio | `0vjp_h21-uz6b.js`: 112,820 B / 41,154 B | Already isolated behind the Workflow Studio dynamic import. |
| Sortable DnD | `1aygvxjtxsi3t.js`: 109,351 B / 39,439 B | The runtime `isSortable` import came from `useAchaemenidDnd`, which was instantiated by the global `useAchaemenidState` hook. This made sortable code reachable from dashboard startup even when the active workspace was Trellis or Canvas. |
| Global CSS | `app/globals.css`: 167,737 B raw / 26,077 B compressed | The compressed contribution is comparatively modest; no broad CSS rewrite is justified by this snapshot alone. |
| Motion | The DashboardShell graph contains `framer-motion`/`motion-dom` modules; `MotionProvider` also loads the Motion feature module asynchronously. | Keep the existing `domMax` feature set for now: the application has real layout use cases (`ActiveCard` layout positioning and ColorPicker layout IDs/groups). Replacing it globally with `domAnimation` would remove required layout behavior. |

## Implemented follow-up

The sortable DnD hook is now instantiated inside `DndGridWorkspace`, which is already loaded dynamically. The global dashboard state and shared context no longer import or expose DnD event handlers.

Expected effect: Trellis and Canvas users no longer need the `@dnd-kit` sortable runtime merely because the dashboard state hook mounted. Grid users retain the same sensors, 5px activation threshold, drag callbacks, group/segment ordering and trash behavior.

The post-change analyzer run is tagged `after` by the `[bundle-after]` commit-message marker. Compare the resulting JSONL graph with this baseline before claiming a byte reduction.

## After snapshot — 17 November 2026

- Snapshot: `after`
- Source commit: `a8e43c37d6f7680e613d925f202942f24437b9c0`
- Workflow run: [44169515586](https://github.com/KavehAhangar051/Home-Control-Dashboard/actions/runs/44169515586)
- Artifact: `bundle-analysis-after-a8e43c37d6f7680e613d925f202942f24437b9c0`
- Graph records: 7,411 total — 2,658 modules, 247 output records and 77 groups

The source graph confirms the intended dependency-boundary change: `useAchaemenidState.ts` no longer imports `useAchaemenidDnd`; `DndGridWorkspace.tsx` now imports and invokes it. The DnD runtime is therefore reachable through the Grid workspace module rather than the global dashboard state hook.

This did **not** produce a meaningful total DnD byte reduction in the static graph. Before, the two DnD-related output chunks contributed 115,412 B raw / 42,501 B compressed; after, the consolidated output contributed 114,155 B / 41,994 B. The analyzer still lists that output in the DashboardShell async group because the graph includes the conditional Grid preload path. The benefit to Trellis/Canvas is avoiding that conditional import at runtime, not shrinking the Grid implementation itself. A browser Network check with Trellis and Canvas selected is still needed to confirm the request is absent.

## Motion lightweight-entrypoint trial — 18 November 2026

The root `MotionProvider` already uses `LazyMotion` with asynchronously loaded `domMax`. A trial migrated the `m` namespace to `motion/react-m` in 80 app-facing modules (48 Hugeicons imported by `components/ui/hugeicons.tsx` and 32 UI/animation/dashboard/IoT components). The purpose was to test the official lightweight entrypoint against the actual Next.js 16/Turbopack build.

### Same-environment comparison

- Before: commit `9198c858bc00df110c20aa085e50dda2b1e1f49f`, workflow [44170435688](https://github.com/KavehAhangar051/Home-Control-Dashboard/actions/runs/44170435688)
- Trial after: commit `775456186b5b3fd2a9d8b68b68e86b4a08847a38`, workflow [44172890216](https://github.com/KavehAhangar051/Home-Control-Dashboard/actions/runs/44172890216)
- Both analyzer runs covered the same four routes and used Bun 1.4.4 / Ubuntu 26.04.

| Homepage client graph | Before | Trial after | Post-revert | Trial delta |
|---|---:|---:|---:|---:|
| Raw module-part contribution | 2,974,509 B | 2,997,646 B | 2,974,509 B | +23,137 B |
| Compressed contribution | 1,164,289 B | 1,174,423 B | 1,164,289 B | +10,134 B |
| Client chunk count | 61 | 66 | 61 | +5 |

Motion-related module-part contributions increased from 440,952 B raw / 216,794 B compressed to 463,620 B / 226,487 B during the trial. The additional Motion chunks had no async loaders in the dashboard route graph, so this was not a deferred-loading win.

### Decision and revert verification

The trial was reverted in commit `152179e94c95cd1964bd8f95c769261dd1c3c2de`. The current code keeps its original `motion/react` imports and the existing async `domMax` provider. The official `motion/react-m` pattern is valid, but it did not improve this project's current Turbopack output.

The post-revert snapshot was captured in workflow [44173469986](https://github.com/KavehAhangar051/Home-Control-Dashboard/actions/runs/44173469986) from verification commit `e1a5a614d47e0844d8cbb0f75f96189e7544fff3`. It returned exactly to the baseline: 61 client chunks, 2,974,509 raw bytes, 1,164,289 compressed bytes and 7,411 graph records. This confirms the 80-module import migration was fully reverted. Re-evaluate only after a Motion or Turbopack change, or if a focused profile identifies a different way to reduce the initial graph.

## What this report does not establish

- It does not measure LCP, INP, TTI, device CPU time or real network transfer timings.
- It does not prove that every output chunk is downloaded during first paint; async groups must be interpreted by their trigger/import path.
- It does not justify optimizing MQTT, Trellis, Workflow Studio or global CSS solely because their source modules have visible sizes.


## Post-revert snapshot — 18 November 2026

- Source commit: \`e1a5a614d47e0844d8cbb0f75f96189e7544fff3\` (the Motion trial had been reverted before this capture).
- Workflow: [44173469986](https://github.com/KavehAhangar051/Home-Control-Dashboard/actions/runs/44173469986) — completed successfully.
- Artifact: \`bundle-analysis-after-e1a5a614d47e0844d8cbb0f75f96189e7544fff3\`.
- Same analyzer/runtime family and same four selected routes as the original baseline: Next.js 16.4.6, Turbopack, Bun 1.4.4, Ubuntu 26.04.

### All route-level client-fs JavaScript output records

The values below are the sum of Turbopack \`part\` contributions assigned to JavaScript output chunks under \`[client-fs]/\`. They are graph contributions, not a direct measurement of bytes transferred by a browser; shared/module-part accounting and async groups must be interpreted separately.

| Metric | Original baseline | Post-revert snapshot | Difference |
|---|---:|---:|---:|
| All `[client-fs]` JS output records | 60 | 59 | -1 |
| Client JS raw contribution | 4,222,084 B | 4,222,562 B | +478 B |
| Client JS compressed contribution | 1,705,406 B | 1,705,753 B | +347 B |
| dnd-kit contribution, raw | 115,412 B | 114,155 B | -1,257 B |
| dnd-kit contribution, compressed | 42,501 B | 41,994 B | -507 B |
| framer-motion contribution, raw / compressed | 190,451 B / 105,668 B | 190,451 B / 105,668 B | No change |
| motion-dom contribution, raw / compressed | 518,604 B / 239,236 B | 518,604 B / 239,236 B | No change |

The Motion trial was fully reverted in the resulting client graph: the measured \`framer-motion\` and \`motion-dom\` contributions match the original baseline exactly. The total client graph is effectively unchanged (+347 compressed bytes), while the DnD contribution is slightly smaller after the DnD ownership refactor.

This comparison spans more than one code change (including the DnD refactor), so it must not be used to attribute the overall difference to one change. It also does not prove whether a particular async chunk is requested in a real browser session.

### Decision and remaining verification

- Keep the existing \`motion/react\` imports and the asynchronous \`LazyMotion\` + \`domMax\` provider. The measured broad \`motion/react-m\` trial increased the homepage graph and was reverted.
- Keep the DnD hook scoped to the dynamically loaded Grid workspace. Its value is dependency ownership and avoiding unnecessary runtime reachability in other workspaces, not a large reduction in total static graph bytes.
- Still required: owner-led browser Network verification for Trellis/Canvas and browser Performance profiling for first load, workspace switching, and device-state bursts.
