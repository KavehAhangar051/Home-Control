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

## What this report does not establish

- It does not measure LCP, INP, TTI, device CPU time or real network transfer timings.
- It does not prove that every output chunk is downloaded during first paint; async groups must be interpreted by their trigger/import path.
- It does not justify optimizing MQTT, Trellis, Workflow Studio or global CSS solely because their source modules have visible sizes.
