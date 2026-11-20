# GPU-First Dashboard Rendering — Design

**Date:** 2026-11-20  
**Status:** Approved — implementation plan created  
**Branch:** `gpu-first-rendering-design`

## Intent

Move every eligible visual animation, transition, effect, and pixel-processing path in Home-Control-Dashboard toward browser compositor and GPU execution while preserving the current UI exactly. This is an execution-path migration, not a redesign.

The user explicitly selected both LUT modes:
- **Identity LUT:** a neutral/reference mode that must preserve the source appearance.
- **Creative 3D LUT:** a color-grading mode for explicitly opted-in decorative image surfaces only.

## Non-negotiable constraints

1. Do not remove, add, simplify, shorten, recolor, or reduce the quality of any existing effect, animation, transition, blur, glow, shadow, mask, or interaction.
2. Preserve DOM structure, layout, responsive behavior, typography, colors, assets, keyframes, durations, delays, easing, stagger, interruption/cancellation behavior, and reduced-motion behavior.
3. Do not apply creative grading to device status colors, alerts, switches, text, charts, theme tokens, or the interactive DOM.
4. Do not force every DOM element into its own GPU layer or add blanket `will-change`, `translateZ(0)`, or `transform-gpu`.
5. Do not add a new animation library or dependency without measured evidence and an explicit design need. Keep the current Motion runtime and native View Transition integration.
6. No Playwright or Playwright CLI. Do not add temporary tests or visual/UI tests. Follow the repository's existing lint, format, typecheck, and test policy.
7. Do not claim zero CPU use, exclusive VRAM residency, a guaranteed physical GPU, or guaranteed 120 FPS. Browsers retain CPU responsibilities for React, DOM, events, style, layout, image decoding, command submission, and parts of rasterization. Browser/driver owns physical allocation and may use system memory or staging copies.

## Success definition

- Existing visual output and interaction behavior remain equivalent at the same browser, device, viewport, zoom, and device-pixel ratio.
- High-frequency animation avoids avoidable React state updates, layout, paint, and main-thread per-frame JavaScript wherever the browser can preserve equivalent behavior through native compositor animations.
- GPU shader work is used only for surfaces whose pixels are intentionally owned by a canvas/WebGL renderer.
- GPU resources have bounded allocation, deterministic cleanup, context-loss recovery, and no CPU pixel readback in the render path.
- Animations follow the display/browser scheduling cadence. The application does not cap a 90/120/144 Hz display at 60 Hz, but cannot force the browser or display to present at a requested rate.
- Resolution follows the actual CSS viewport and device pixel ratio; internal canvas render targets are sized to the required backing resolution within explicit device/memory limits. Do not upscale a low-resolution source and describe it as native-resolution rendering.

## Existing architecture and constraints discovered

- Next.js 16 App Router, React 19, TypeScript 7, Tailwind v4, Motion 14, Zustand, Turbopack, static export, and a Capacitor Android path.
- `MotionProvider` already uses async `LazyMotion` with `domMax`; all current Motion calls use `m.*`. A recent `motion/react-m` experiment was reverted after increasing the homepage client graph.
- `components/motion/composited-bezier-particle.tsx` precomputes equal-distance Bezier keyframes and runs transform/opacity through WAAPI. It avoids per-frame React updates and path math; compositor promotion remains browser-dependent.
- `features/iot/components/canvas/sheetViewportAnimator.ts` still uses rAF for viewport flight, focal zoom, and inertia. It writes DOM transforms and zoom readouts. The DOM-based Canvas cannot be moved wholesale to OffscreenCanvas.
- `features/iot/components/canvas/CanvasWorkspace.tsx` has a separate transformed world plane and dot-grid layer. The grid's 1.25 CSS-pixel dot radius and zoom-dependent spacing (including the 2x rule below an 8px raw step) are visual invariants.
- `components/motion/theme-toggle-config.ts` contains Rectangle, Circle, Circle+Blur, and Blinds View Transition effects. Clip-path, filter, masks, and animated custom properties are not universally compositor-only.
- `components/motion/loader.tsx` includes transform/opacity candidates and ASCII variants that update text through React on an interval. Text semantics and exact glyph sequence must remain intact.
- `features/iot/components/canvas/NodePerimeterSpark.tsx` uses masked conic-gradient layers and rotation; layer promotion and paint cost need runtime evidence.
- `lib/gpu/lut3d.ts`, `lib/gpu/webgl2-lut-renderer.ts`, and `components/gpu/GpuLutImage.tsx` already provide a lazy, demand-driven WebGL2 3D LUT image renderer with a source-image fallback and context-loss recovery. It is currently not mounted in the live dashboard.
- The current LUT renderer has source-level ceilings of roughly 64 MiB source texture + 2 MiB 64³ RGBA16F LUT + up to 64 MiB output buffer (about 130 MiB nominal before driver/staging/decoded-image overhead). This is an estimate, not measured VRAM.

## LUT design — both modes

### Identity/reference mode

- Keep a neutral identity LUT representation for calibration and validation.
- For exact visual preservation, the identity mode must use a pass-through shader path (or the existing original-image path) rather than relying on finite-precision 3D texture interpolation to be bit-identical.
- Compare output against the source using a defined pixel-difference tolerance on representative browsers/devices before enabling it for a surface.
- Do not wrap the whole DOM in a WebGL snapshot pipeline. That would duplicate rendering, threaten text sharpness/accessibility/interaction, and consume substantial GPU memory without moving React/DOM work off the CPU.

### Creative 3D LUT mode

- Use the existing `.cube` parser and WebGL2 3D texture/shader path for decorative image surfaces only.
- Keep the mode opt-in per surface and preserve original image visibility until the GPU result is ready.
- Keep semantic UI colors, theme tokens, status indicators, charts, text, and controls outside creative grading.
- Maintain the original source image as the failure/fallback path; never substitute a lower-quality software filter and call it GPU rendering.
- Preserve current color-space assumptions explicitly. Do not silently introduce sRGB/linear conversions or alter alpha/premultiplication behavior without a validated color specification.

## Rendering migration strategy

### 1. Inventory and baseline

Create a source inventory of all animation mechanisms and high-frequency visual writes across app CSS, Motion, WAAPI, View Transitions, SVG, Canvas, and imperative DOM code. Classify each operation as JavaScript, React render/commit, style, layout, paint/raster, compositor, texture upload, or shader execution.

Capture comparable Chrome DevTools Performance traces on:
- Desktop Chromium at 1920×1080, DPR 1, with a 60 Hz and 120 Hz display where available.
- Android Chromium/WebView on representative hardware and its actual viewport/DPR.
- Existing 1440×900 desktop and 390×844 mobile cases from the performance strategy.

Record frame-time distribution, dropped frames, long tasks, main/compositor/raster/GPU tracks, layer count/memory where available, texture upload activity, and GPU context count. No source-only guess may be reported as a measured result.

### 2. Compositor-native motion

- Retain WAAPI/CSS/Motion animations that use transform and opacity and verify whether the browser actually composites them.
- For JS rAF loops, assess whether the animation has a fixed target and can be represented as equivalent WAAPI keyframes without losing live interaction semantics.
- Keep pointer-driven focal zoom, inertia, dynamic readouts, and retargeting on the current path unless an equivalent native animation can preserve every anchor, easing, friction, interruption, visibility, and commit behavior.
- Batch unavoidable DOM writes and keep transient high-frequency values out of React state where the existing architecture allows.
- Promote layers only around measured animation windows and only when layer-memory cost is acceptable.

### 3. Paint-bound effects

- Profile blur, clip-path, masks, gradients, shadows, SVG filters, and animated custom properties individually.
- Do not mechanically rewrite these to transform/opacity: their geometry and visual output differ.
- Consider a GPU-owned canvas/WebGL implementation only when it can reproduce the exact pixels, timing, antialiasing, clipping, blending, and responsive scaling. Otherwise retain the current browser effect and document its execution boundary.
- Do not move DOM Canvas/Workflow nodes into OffscreenCanvas; OffscreenCanvas is applicable only to actual canvas surfaces.

### 4. GPU renderer and resource management

- Keep WebGL2 as the current broadly usable shader path; treat WebGPU as an optional future capability, not a required runtime dependency, because browser support is not universal (especially across embedded WebViews).
- Prefer a small number of long-lived contexts for independent visual scenes; avoid one context per small component.
- Budget source textures, LUT textures, render targets, DPR, and concurrent surfaces explicitly. Release resources deterministically and handle context/device loss.
- Avoid readPixels/readback in the interactive render path. Do not poll GPU completion synchronously.
- Do not claim physical VRAM usage as an exact number; expose estimates and observed browser diagnostics only.

### 5. Refresh rate and resolution

- Let requestAnimationFrame/WAAPI follow the browser's presentation cadence; do not use fixed 60 FPS timers for visual animation.
- Use elapsed-time-based animation math where custom integration remains necessary; preserve the existing time constants and behavior.
- Use CSS viewport dimensions for layout and devicePixelRatio for canvas backing resolution. Respect browser zoom, DPR changes, orientation changes, and output-size caps.
- 120 FPS at 1920×1080 is a target for capable hardware/display/browser combinations, not an enforceable application guarantee. 120 Hz provides an 8.33 ms total frame budget shared by all browser and system work.

## Delivery phases

1. **Phase 0 — Baseline and complete inventory:** no visual or code changes; report all motion/effect paths, measured traces, and priority candidates.
2. **Phase 1 — Low-risk compositor migration:** only verified behavior-equivalent migrations, one component/path at a time; retain exact fallback and accessibility semantics.
3. **Phase 2 — Paint-bound surfaces:** evaluate GPU-owned shader rendering for suitable surfaces; reject any candidate that cannot pass visual-equivalence checks.
4. **Phase 3 — LUT integration:** expose both identity/reference and creative LUT modes on appropriate GPU-owned image surfaces; no global DOM filter.
5. **Phase 4 — Documentation and verification:** update `GPU-RENDERING.md`, `60-FPS-STRATEGY.md`, and `ARCHITECTURE.md`; run the required repository checks and summarize unmeasured device/browser cases.

## Acceptance gates

A migration is accepted only if all apply:
- Same UI and pixel output within the documented tolerance; no changed content, geometry, color, font, layout, or effect.
- Same animation duration, delay, easing, keyframes/path, repetition, interruption, and reduced-motion behavior.
- No increase in paint/layout work on the critical animation path.
- No unbounded GPU layer/context/texture growth or leaked resources.
- No new CPU pixel readbacks or synchronous GPU stalls.
- Lint, format, typecheck, existing test suite, and production build pass under repository commands.
- Runtime traces and target-device visual comparison are reviewed; unsupported devices are clearly reported without claiming universal GPU-only execution.

## Out of scope

- UI redesign, visual refresh, changing effect styles, introducing new effects, deleting animations, changing user settings, changing ESP32/MQTT behavior, changing dashboard navigation, or adding a global screenshot-to-WebGL rendering layer.
- Promising zero CPU use, VRAM-only memory, or guaranteed refresh-rate presentation.

## Builder self-review

No unresolved product decision blocks a plan. The browser/device matrix is left to the implementation owner to validate using the supported desktop Chromium and Android WebView paths. The key technical boundary is explicit: preserve DOM-native rendering where moving it to a GPU-owned surface would change pixels or semantics.
