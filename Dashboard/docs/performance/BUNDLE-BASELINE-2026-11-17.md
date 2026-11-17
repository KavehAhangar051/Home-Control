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

## Motion lightweight-entrypoint follow-up

The root `MotionProvider` already uses `LazyMotion` with an asynchronously loaded `domMax` feature bundle. The app-facing shared Hugeicons set and core animation/Canvas/Workflow components have now been migrated from the `m` export of `motion/react` to the dedicated `motion/react-m` entrypoint. The migration covers 48 icons imported by `components/ui/hugeicons.tsx` and 32 directly inspected UI/animation/dashboard/IoT components.

This is an import-boundary optimization, not yet a measured bundle-size win. `LazyMotion`, `domMax`, hooks, `AnimatePresence`, `LayoutGroup` and other APIs remain imported from `motion/react`. The app still needs a repository-wide search for additional `m` imports and a matching post-change analyzer comparison before quantifying any reduction. The migration commits are `256a6b5a6af4035633b9c377720c75c2981c8632` and `fabe66c79f1b33eab5cd80d59c93c1b19edeb318`.

## What this report does not establish

- It does not measure LCP, INP, TTI, device CPU time or real network transfer timings.
- It does not prove that every output chunk is downloaded during first paint; async groups must be interpreted by their trigger/import path.
- It does not justify optimizing MQTT, Trellis, Workflow Studio or global CSS solely because their source modules have visible sizes.
