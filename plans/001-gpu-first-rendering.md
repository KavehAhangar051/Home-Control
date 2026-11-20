# Plan 001: Migrate eligible dashboard rendering paths toward GPU composition

> **Executor instructions:** Execute one measured path at a time. Preserve the existing UI and animation behavior exactly. Run each verification gate before proceeding. Do not invent browser/GPU measurements from source inspection.
>
> **Drift check (run first):** compare the planned-at commit with the current branch for all in-scope paths. If any target file changed, inspect the live version before applying the plan.

## Status

- **Priority:** P1
- **Effort:** XL (deliver as small sequential slices)
- **Risk:** HIGH
- **Depends on:** approved design at `docs/superpowers/specs/2026-11-20-gpu-first-rendering-design.md`
- **Category:** perf
- **Planned at:** commit `222f45ee39a46c87f90a10b6765f5fa06bb4e6e5`, 2026-11-20

## Why this matters

The dashboard already uses Motion, WAAPI, CSS transforms, and WebGL2, but some recurring visual paths still calculate and write values from JavaScript each frame, while several effects animate properties whose compositor behavior is browser-dependent. A measured, behavior-preserving migration can reduce main-thread work without removing effects or changing the UI. The target is compositor/GPU-first rendering where the browser supports it, not a false guarantee of zero CPU or VRAM-only allocation.

## Current state

- The repository already contains compositor-oriented optimizations documented in `ARCHITECTURE.md` §28. Those are source-level changes, not proof of physical GPU/VRAM execution; the wording in that section now makes this limitation explicit.
- A DPR-change listener was added to `components/gpu/GpuLutImage.tsx` so a display-density change triggers a redraw even when the CSS box size is unchanged. This is an isolated correctness fix for the opt-in LUT image surface, not a global dashboard renderer change.
- Exact identity LUTs and non-positive LUT intensity now bypass WebGL in `GpuLutImage`: the original browser image remains the visible source, no source/LUT textures or shader draw are created for a no-op grade, and existing renderer resources are disposed when a live surface switches back to identity. Detection is memoized per LUT/intensity input and compares Float32 values exactly. This affects only the opt-in image surface; no global dashboard LUT or UI effect was introduced.

- `docs/superpowers/specs/2026-11-20-gpu-first-rendering-design.md` — approved product/technical design and constraints.
- `docs/performance/GPU-RENDERING.md` — source-level inventory, LUT architecture, memory estimates, and GPU lifecycle rules. Expanded inventory added in commit `222f45e`.
- `docs/performance/GPU-BASELINE-CAPTURE.md` — reproducible Chrome DevTools capture procedure, scenarios, refresh-rate budgets, diagnostic overlays, and result template.
- `docs/performance/60-FPS-STRATEGY.md` — existing 60/90/120/144 Hz frame budgets, Motion/runtime conventions, settings semantics, and existing performance architecture.
- `components/MotionProvider.tsx` — async `LazyMotion` with `domMax`; current Motion callsites use `m.*`. Keep this runtime.
- `features/iot/components/canvas/sheetViewportAnimator.ts` — rAF-driven flight, focal zoom, and inertia; DOM transform/grid/readout updates happen per frame.
- `components/motion/composited-bezier-particle.tsx` — precomputed equal-distance keyframes animated through WAAPI transform/opacity.
- `components/motion/theme-toggle-config.ts` and `styles/view-transitions.css` — four theme reveal variants involving clip-path, filter, masks, and a registered custom property.
- `components/motion/loader.tsx` and `loader-shapes.tsx` — Motion-powered geometric loaders plus ASCII variants that update React state on an interval.
- `features/iot/components/canvas/NodePerimeterSpark.tsx` — masked conic-gradient layers with transform rotation.
- `lib/gpu/lut3d.ts`, `lib/gpu/webgl2-lut-renderer.ts`, `components/gpu/GpuLutImage.tsx` — existing lazy WebGL2 image LUT path; not mounted in the live dashboard.
- `package.json` — Bun 1.4.4; required commands include `bun run lint`, `bun run format`, `bun run typecheck`, `bun run test`, `bun run build`. Run shell commands through `bun run r -- <command>` as required by AGENTS.md.
- No runtime trace, GPU memory measurement, or device-level visual comparison is currently available. All source findings remain hypotheses until measured.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Lint | `bun run r -- bun run lint` | Exit 0; no Biome diagnostics |
| Format check | `bun run r -- bunx biome format <changed source files>` | Exit 0; no formatting differences |
| Typecheck | `bun run r -- bun run typecheck` | Exit 0; no TypeScript errors |
| Existing tests | `bun run r -- bun run test` | Existing suite passes; do not add UI/visual tests |
| Production build | `bun run r -- bun run build` | Exit 0; production export completes |

Do not run `bun run format` without a scoped path in this task: its package script formats all files under app/components/features/lib and can create unrelated diffs.

## Scope

**In scope (one slice at a time):**
- `features/iot/components/canvas/sheetViewportAnimator.ts`
- `features/iot/components/canvas/useSheetViewportGestures.ts`
- `features/iot/components/canvas/CanvasWorkspace.tsx`
- `components/motion/composited-bezier-particle.tsx`
- `components/motion/loader.tsx`
- `components/motion/loader-shapes.tsx`
- `components/motion/theme-toggle-config.ts`
- `styles/view-transitions.css`
- `components/motion/color-picker.tsx`
- `components/motion/dashboard-slider.tsx`
- `components/motion/range-slider*.tsx`
- `components/motion/dock.tsx`
- `features/iot/components/canvas/NodePerimeterSpark.tsx`
- `lib/gpu/lut3d.ts`
- `lib/gpu/webgl2-lut-renderer.ts`
- `components/gpu/GpuLutImage.tsx`
- relevant documentation under `docs/performance/` and `ARCHITECTURE.md`

**Out of scope:**
- Any UI redesign, DOM restructuring, color/layout/typography changes, or changed animation/effect inventory.
- Removing, simplifying, shortening, recoloring, or reducing quality of any existing animation/effect.
- Replacing the Motion runtime or adding another animation library.
- Moving the DOM-based Canvas/Workflow scene wholesale into OffscreenCanvas.
- A global screenshot-to-WebGL renderer or global LUT filter.
- Forcing all elements into GPU layers or forcing WebGPU where unsupported.
- New tests or UI/visual tests; only run existing project checks.
- Changes to MQTT, ESP32 protocol, persistence semantics, or device behavior.

## Git workflow

- Primary development branch: `main`.
- Apply future changes directly to `main`; do not create a feature branch for this work unless explicitly requested.
- Commit each independently reviewable slice with a descriptive conventional commit.
- Do not wait for GitHub Pages or other deployment workflows to complete.

## Steps

### Step 1 — Establish a reproducible browser baseline

Follow [GPU-BASELINE-CAPTURE.md](../docs/performance/GPU-BASELINE-CAPTURE.md) for the exact environment record, scenario sequence, Rendering diagnostics, and result template. Capture Chrome DevTools Performance traces before changing runtime code. Use the same browser version, device, viewport, zoom, DPR, dashboard data, and interaction sequence for later comparisons.

Required scenarios:
1. Canvas/Workflow pan, focal zoom, fit-view flight, inertia, and node drag.
2. Bezier particles and NodePerimeterSpark at realistic concurrent node/connection counts.
3. Each theme transition variant: rectangle, circle, circle-blur, blinds.
4. Loader family, color picker, slider variants, and Dock panel transitions.
5. Rapid MQTT state updates while the above visual paths are active.

Record frame-time distribution, dropped frames, long tasks, Main/Compositor/Raster/GPU activity, layer count/memory where exposed, and context/texture activity. Do not report a metric if the trace does not expose it. Mark unavailable device traces as pending rather than guessing.

**Verify:** attach/export the baseline traces and a concise table to `docs/performance/GPU-RENDERING.md`; scorecard entries have an explicit source and are not marked measured without evidence.

### Step 2 — Migrate only a proven static-target animation

Start with the Canvas/Workflow `flight` mode only if trace evidence shows main-thread frame work is material and a WAAPI animation can preserve the exact ease-out-cubic curve, duration, rounding, interruption, reduced-motion behavior, final viewport commit, and visibility behavior.

Keep focal zoom and inertia unchanged in this slice. Do not change grid updates or live zoom readouts unless their current semantics can be preserved exactly.

**Verify:** compare the same interaction trace and inspect the final committed viewport; no changed easing, duration, endpoint, cancellation, or visible movement.

### Step 3 — Audit and optimize remaining recurring motion

Use traces to select the next single candidate among loader, slider/color picker, node spark, Bezier particles, and Dock. Retain existing Motion/WAAPI/CSS mechanisms where already efficient. Move frequent transient values out of React state only where the current DOM output and accessibility semantics remain identical.

Do not convert ASCII text loaders into canvas textures. Do not change the theme transition variants to simpler variants. Do not add global `will-change`.

**Verify:** per-candidate before/after trace shows no added layout/paint on the hot path and no regression in frame-time distribution; inspect the same visual states manually.

### Step 4 — Audit LUT modes and resource ownership

Keep the Identity LUT as a reference/calibration mode and use a true pass-through path for pixel-identical source output; finite-precision 3D texture interpolation is not sufficient to promise bit identity. Keep Creative LUT opt-in for decorative image surfaces only. Do not mount a LUT across the DOM or on semantic colors.

Review shader compile/link stalls, image texture upload, resize/DPR caps, source/LUT texture reuse, context loss/restoration, and disposal. Consider `KHR_parallel_shader_compile` only if a trace demonstrates a meaningful initialization stall and fallback behavior can remain identical.

**Verify:** no image surface is integrated until source-vs-output comparison passes the documented tolerance and original-image fallback works on unavailable/lost contexts. No CPU pixel readback is introduced.

### Step 5 — Update documentation and run repository checks

Update `docs/performance/GPU-RENDERING.md`, `docs/performance/60-FPS-STRATEGY.md`, and `ARCHITECTURE.md` only when behavior or architecture actually changes. Record exact browser/device scope and remaining browser-managed CPU/memory work.

**Verify:** run lint, scoped format check, typecheck, existing tests, and production build using the commands above. Inspect actual output, not just exit codes.

## Done criteria

- [ ] Every migration has a trace-backed reason and a recorded before/after comparison.
- [ ] Existing UI, animation/effect count, timing, easing, assets, geometry, and interaction semantics are unchanged.
- [ ] No blanket layer promotion, global LUT, global WebGL snapshot, or unbounded GPU context/texture allocation.
- [ ] Identity LUT has a pass-through path for exact source preservation; Creative LUT remains opt-in and decorative-only.
- [ ] No new synchronous pixel readback or unbounded per-frame main-thread work.
- [ ] Documentation reflects actual implementation and explicitly separates measured data from source-level hypotheses.
- [ ] Lint, scoped format, typecheck, existing tests, and production build pass.
- [ ] Any unmeasured physical-device/browser case is reported as unverified.

## STOP conditions

Stop and report instead of improvising if:
- A proposed migration changes any pixel, animation timing/easing, geometry, interaction response, or accessibility behavior.
- A candidate depends on changing DOM structure or rendering text as a bitmap.
- A trace shows the browser is already compositing the candidate and the migration adds complexity without measurable benefit.
- A WebGL context, texture budget, or output size exceeds the measured device budget.
- A verification command fails twice or exposes an unrelated baseline failure.
- A planned source file has drifted from the current-state description.

- The Canvas viewport source audit is documented in `docs/performance/GPU-RENDERING.md`: finite camera flights are a potential WAAPI candidate, while dynamic focal zoom and velocity-based inertia remain rAF-driven until a behavior-preserving migration is demonstrated. Source comments now describe transform layers as compositor candidates rather than claiming guaranteed GPU execution.


### Phase 1 progress — Canvas viewport write elision (20 November 2026)

- Updated `features/iot/components/canvas/sheetViewportAnimator.ts` to skip assignments when the next world-plane/grid transform or legacy grid background values exactly match the current inline styles.
- This avoids redundant style writes for repeated identical viewport applications without changing any computed value or animation behavior. It does not remove the requestAnimationFrame camera loop or transfer its math to the GPU.
- Remaining verification: run the project's lint/typecheck/build and capture comparable Chrome Performance traces. No FPS or VRAM improvement is claimed without runtime measurements.


### Phase 1 progress — non-blocking LUT shader initialization (20 November 2026)

- Added an async WebGL2 LUT renderer factory. When `KHR_parallel_shader_compile` exists, it polls program completion without querying blocking compile/link status prematurely; unsupported browsers keep the synchronous compatibility path.
- Updated `GpuLutImage` to await renderer creation safely and discard late results after unmount, context loss, or a switch to identity LUT pass-through. The source image remains visible during initialization.
- Shader source, LUT sampling, texture formats, output dimensions, animation behavior, and UI remain unchanged.
- Remaining verification: run Biome lint/format and TypeScript typecheck; inspect Actions results; validate supported and fallback browser paths. No runtime FPS/VRAM claim is made.
