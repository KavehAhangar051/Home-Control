# GPU-First Rendering Implementation Plans

Generated 2026-11-20 from the approved design at `docs/superpowers/specs/2026-11-20-gpu-first-rendering-design.md`.

Execute plans in order. Keep the UI and all existing visual behavior unchanged.

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---|---|---|---|---|
| [001](001-gpu-first-rendering.md) | Migrate eligible dashboard rendering paths toward GPU composition | P1 | XL | Approved design | IN PROGRESS |

## Dependency notes

- Plan 001 begins with a measured browser baseline. Runtime migrations must not begin until baseline evidence identifies a real candidate.
- Subsequent slices should be split into separate plans/PRs if they touch independent render paths or exceed a reviewable change size.

## Findings considered and rejected

- Blanket `will-change` / `translateZ(0)` on all elements: rejected because it can increase layer and GPU memory pressure without guaranteeing compositor execution.
- Moving the DOM Canvas/Workflow scene wholesale into OffscreenCanvas: rejected because it is not an HTML canvas surface and would still require per-frame DOM updates.
- Applying a creative LUT to the entire DOM: rejected because it changes semantic colors, text, and the authored UI.
- Treating all browser memory as VRAM or claiming zero CPU use: rejected as impossible to guarantee from web application code.
