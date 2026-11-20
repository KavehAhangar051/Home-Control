# GPU Rendering and 3D LUT Engine

## Scope

The dashboard uses a GPU-first rendering strategy for visual work. Browser application logic, React reconciliation, DOM updates, layout, image decoding, and WebGL command submission still involve CPU work; WebGL moves shader execution and texture sampling to the graphics pipeline. Hardware acceleration is requested explicitly for this renderer. If the browser cannot provide an acceptable WebGL 2 context, the original image remains visible instead of falling back to software rendering.

This module is an opt-in visual surface. It is not mounted globally and does not alter device-state colors, semantic status indicators, text, or existing dashboard themes.

## Modules

- `lib/gpu/lut3d.ts`: parses standard 3D `.cube` LUT data and creates identity LUTs.
- `lib/gpu/webgl2-lut-renderer.ts`: owns one WebGL 2 context, one source texture, one 3D LUT texture, a fullscreen-triangle program, and explicit resource disposal.
- `components/gpu/GpuLutImage.tsx`: React surface with an original-image fallback, lazy context creation, resize-driven redraws, and context-loss recovery.

## Usage

```tsx
import { useMemo } from "react";
import { GpuLutImage } from "@/components/gpu/GpuLutImage";
import { parseCubeLut } from "@/lib/gpu/lut3d";

const lut = useMemo(() => parseCubeLut(cubeFileText), [cubeFileText]);

<GpuLutImage
  imageSrc="/images/ambient-surface.webp"
  alt=""
  lut={lut}
  intensity={0.85}
  className="aspect-video w-full"
/>
```

The source image must be same-origin or served with CORS permission. The component loads the image lazily, waits until the surface is near the viewport before creating a WebGL context, and redraws only after source load, LUT/intensity changes, resize, or tab visibility restoration. It does not run a permanent animation loop.

## LUT format and limits

- Accepts 3D `.cube` files with `LUT_3D_SIZE`, optional `DOMAIN_MIN` / `DOMAIN_MAX`, and exactly `size³` RGB entries.
- 1D LUTs are intentionally rejected.
- LUT edge length is bounded to 2–64. Texture storage is RGBA16F with linear filtering and clamp-to-edge addressing; the parser retains Float32 values until upload, where the GPU stores half-float texels. The source texture is bounded to 4096×4096; larger sources remain on the original-image fallback.
- Approximate 3D LUT texture allocation (no mipmaps): 17³ = 38.4 KiB, 33³ = 280.8 KiB, 64³ = 2 MiB.
- LUT rows use the standard .cube order: red changes fastest, then green, then blue.
- `.cube` output triplets are stored as clamped floating-point RGB values; `DOMAIN_MIN` / `DOMAIN_MAX` normalize source RGB coordinates before the 3D lookup. The LUT is expected to use the same RGB encoding convention as the source texture. This first version does not add an implicit linear-light / sRGB conversion pass.

## GPU and lifecycle rules

- Requests WebGL 2 with `powerPreference: "high-performance"` and `failIfMajorPerformanceCaveat: true`. Browser and operating-system policy still decide which physical adapter executes the context; web code cannot guarantee a particular GPU.
- Uses one fullscreen triangle and a fragment shader. The 3D lookup and interpolation run in the graphics pipeline.
- Does not read rendered pixels back to JavaScript.
- Does not allocate mipmaps or poll GPU state in the render path.
- Sizes the drawing buffer from the current device pixel ratio without an arbitrary 2× cap, bounded by `MAX_RENDERBUFFER_SIZE`, `MAX_VIEWPORT_DIMS`, and a 4096-pixel maximum output edge. This preserves the highest supported output density within the renderer's existing ceiling. A 4096×4096 RGBA8 source texture can still consume up to 64 MiB, so avoid mounting multiple large surfaces concurrently.
- Reuses the source texture when only LUT intensity or surface dimensions change; LUT data is re-uploaded only when its typed-array reference changes. Output dimensions are capped at 4096 pixels per edge.
- Creates the context only when the surface approaches the viewport; it does not keep an animation loop alive.
- Re-arms a resolution media-query listener after each `devicePixelRatio` change so moving the browser between displays with different pixel densities redraws the backing buffer even when the CSS box size is unchanged. `ResizeObserver` alone does not guarantee notification for DPR-only changes.
- Releases textures, vertex array, and program on unmount. Recreates resources after `webglcontextrestored`.
- If WebGL 2 is unavailable, context creation fails, or rendering throws, the original image remains visible.

## Integration policy

Use this renderer only for non-semantic decorative imagery (ambient artwork, visual backdrops, or media previews). Do not color-grade the entire dashboard or apply a LUT to live device status, warnings, switches, text, charts, or theme tokens. Color semantics and accessibility contrast must remain deterministic.

Do not add one WebGL context per small UI element. Prefer a single shared surface for each genuinely independent visual scene. Before global integration, profile GPU memory, compositing, frame time, and context count on desktop and mobile devices.

## Verification status

Source implementation only. The component is not mounted in the live dashboard yet; no runtime GPU trace, visual comparison, memory measurement, or context-loss exercise has been recorded. Do not describe this engine as production-verified until those checks are completed.

## Non-negotiable visual and execution constraints

The dashboard's visual output is a compatibility contract. Performance work must not remove, simplify, replace, shorten, recolor, or reduce the quality of an existing effect, animation, transition, blur, glow, shadow, mask, or interaction. Do not add a new visual effect as part of GPU migration. A change is acceptable only when the rendered result, timing, easing, interaction response, and reduced-motion behavior remain equivalent.

A browser cannot run the entire UI with zero CPU work or store all rendering resources exclusively in VRAM. React/DOM updates, style calculation, layout, accessibility, event handling, image decoding, command submission, and some raster work remain CPU/browser responsibilities. The application can request hardware acceleration and move eligible animation interpolation, rasterization, and pixel processing to GPU-backed browser paths, but it cannot force every browser operation onto the GPU or choose a physical GPU. System RAM remains part of browser and GPU resource management.

### Source-level animation inventory (not a runtime measurement)

| Area | Current mechanism | GPU migration boundary |
|---|---|---|
| Infinite Canvas / Workflow viewport (`features/iot/components/canvas/sheetViewportAnimator.ts`) | `requestAnimationFrame` computes flight easing, focal zoom smoothing, and pan inertia; writes world/grid transforms and zoom readouts | Pan inertia snapshots the invariant zoom once at start, avoiding a viewport getter and object spread on every frame; its per-frame stop threshold compares squared velocity to avoid a square-root calculation. Position interpolation and DOM submission remain on the main thread; transform compositing is only a browser-managed GPU candidate. Moving interpolation off-thread must preserve live zoom readouts, focal anchoring, inertia decay, cancellation, and final committed viewport. |
| Bezier particles (`components/motion/composited-bezier-particle.tsx`) | Precomputed keyframes played through the Web Animations API using transform and opacity | Already avoids React state updates and per-frame path calculations; actual compositor promotion remains browser-dependent. |
| Motion loaders (`components/motion/loader.tsx`) | Motion transform/opacity animations for geometric variants; ASCII variants update React state on an interval | Transform/opacity variants are compositor candidates. ASCII glyph changes are DOM/text updates and cannot be represented as a pure texture-only animation without changing implementation semantics or introducing a visual snapshot pipeline. |
| Theme transitions (`components/motion/theme-toggle-config.ts`, `styles/view-transitions.css`) | View Transition pseudo-elements animate `clip-path`, `filter`, and a CSS custom property used by the blinds mask | Preserve the exact effect and timing. These properties are not universally compositor-only; validate paint/raster activity in each target browser before claiming GPU execution. |
| WebGL2 LUT (`lib/gpu/webgl2-lut-renderer.ts`) | Fragment shader samples a source texture and 3D LUT | Shader work executes on the graphics pipeline when hardware WebGL is available. The image decode, source data, JS API calls, and browser resource copies are not guaranteed to reside exclusively in VRAM. |
| Canvas viewport + dot grid (`sheetViewportAnimator.ts`, `canvasGeometry.ts`, `CanvasWorkspace.tsx`) | World plane and grid are updated imperatively with `translate3d`; grid tile size changes as zoom changes | Pan is designed around compositor transforms. During zoom, `background-size` changes whenever `visualStep` changes, which is a paint/raster candidate. Do not replace it with a simple scaled layer: the current gradient keeps a constant 1.25px dot radius while spacing changes. A GPU shader/SVG migration is only acceptable after pixel-level equivalence checks at all zoom thresholds and DPRs. |

### Confirmed GPU-oriented implementation already present

- `lib/gpu/webgl2-lut-renderer.ts` already requests WebGL2 with `powerPreference: "high-performance"` and `failIfMajorPerformanceCaveat: true`. This is a browser hint/requirement, not a guarantee of a discrete GPU or exclusive VRAM allocation. It also rejects software-only contexts rather than silently claiming GPU acceleration.
- `features/iot/components/canvas/CanvasWorkspace.tsx` already keeps the transformed world plane and dot grid on separate `translate3d` paths. Preserve the grid's fixed dot radius and its 2x spacing rule below an 8px raw step when evaluating alternatives.
- `components/motion/composited-bezier-particle.tsx` already precomputes equal-distance keyframes once and uses the Web Animations API for transform/opacity, avoiding React state updates and path calculations per frame. Do not add blanket `will-change`; verify actual layer promotion and memory cost in DevTools first.


### Required optimization and acceptance process

1. Record a baseline trace for each representative effect in the target browser/device. Capture Main, Compositor, Raster, GPU, dropped frames, and memory/layer information where available.
2. Classify every frame-time operation: JavaScript, React/DOM, style, layout, paint/raster, texture upload, compositing, or shader execution. Do not infer GPU execution from a CSS class or property name.
3. Change only the execution mechanism. Keep the same assets, colors, geometry, blur radius, shadow parameters, keyframes, duration, easing, stagger, and interaction states.
4. Compare before/after recordings and visual output at the same viewport, DPR, browser, and device. Reject changes that introduce paint regressions, extra texture uploads, excessive layers, VRAM pressure, context loss, or any visible/timing difference.
5. Track GPU memory as an estimate, not a directly queried universal VRAM counter. WebGL does not expose a portable API for querying available or allocated physical VRAM. Budget textures/render targets explicitly and release resources deterministically.
6. Keep a browser-compatible path when hardware acceleration or a required GPU capability is unavailable; do not silently substitute a lower-quality effect. Report the fallback honestly.

### OffscreenCanvas / Worker decision for the current DOM Canvas

`CanvasWorkspace` is a DOM scene composed of positioned React nodes, SVG wires, and CSS-transformed `<div>` layers; it is not a `<canvas>` rendering surface. `transferControlToOffscreen()` only transfers an actual HTML `<canvas>` element, so it cannot move the current DOM scene, its CSS transforms, or its React nodes into a Worker.

Moving the existing viewport animator's math into a Worker would still require sending viewport values to the main thread every frame so it can update `worldPlane.style.transform`, `gridLayer.style.transform`, the zoom readout text, and React's committed viewport state. That adds message traffic without removing the DOM/style writes that currently gate the visible result. It is therefore not an automatic GPU migration and must not be applied as a blanket change.

Web Animations API / compositor animation is a more appropriate candidate for static-target viewport flights because the browser may animate transform values without a JavaScript callback each frame. However, smooth focal zoom continuously retargets x/y/zoom, pan inertia integrates pointer-derived velocity, and the zoom readout is updated live. Replacing these loops requires a behavior-equivalent retargeting design and trace evidence; do not replace them until the exact focal anchor, easing, friction, interruption, visibility cancellation, and final persisted viewport are preserved.

`OffscreenCanvas` remains appropriate for genuinely canvas-based rendering or pixel processing (for example, a future dedicated GPU grid renderer), where the worker owns the canvas context. Such a renderer must preserve the current CSS radial-gradient output, including 1.25 CSS-pixel dot radius, theme color, spacing threshold, zoom alignment, and device-pixel-ratio behavior before it can replace the existing layer.

### Existing WebGL2 LUT renderer: allocation and lifecycle audit

The current `WebGL2LutRenderer` is a demand-driven, standalone image-processing renderer, not a universal CSS/UI color pipeline. Its fragment shader samples one RGBA8 source texture and one RGBA16F 3D LUT, then draws into a WebGL canvas. Applying that LUT to the entire dashboard would change the authored color output and is explicitly out of scope unless a separate visual specification requires it.

Current source-level allocation ceilings (nominal storage only; driver/browser overhead and staging copies are excluded):

| Resource | Current limit / format | Nominal upper bound |
|---|---|---:|
| Source texture | 4096 × 4096 × RGBA8 | 64 MiB |
| 3D LUT texture | 64³ × RGBA16F | 2 MiB |
| Canvas drawing buffer | Up to 4096 × 4096 RGBA8-equivalent | 64 MiB |
| **Combined nominal peak** | One renderer at the maximum dimensions and LUT size | **~130 MiB** |

The 130 MiB figure is a conservative arithmetic ceiling for these three allocations, not a measured VRAM reading or a promise that the browser places every byte in dedicated VRAM. The decoded source image may additionally occupy system memory, and the browser/driver may maintain staging or compositor copies. Multiple simultaneous renderer instances multiply the budget.

Lifecycle observations from source:

- The renderer reuses one source texture and reallocates the 3D LUT texture only when the LUT dimension changes.
- LUT data is uploaded only when the `Float32Array` identity changes; callers should keep parsed LUT data stable rather than recreating it on unrelated React renders.
- The React wrapper creates the WebGL context lazily when the image approaches the viewport, pauses draws while the document is hidden, and disposes the renderer on unmount or context loss.
- Context restoration creates a new renderer and redraws from the retained image/LUT inputs.
- The original image remains visible while the GPU canvas is not ready or when WebGL initialization/rendering fails; do not replace this with a lower-quality software filter and claim GPU execution.
- `dispose()` explicitly deletes the texture, vertex-array, and program handles when the context is still valid. When the context is already lost, the browser/driver owns teardown of the lost context's resources.

Before increasing these limits or creating more renderer instances, profile concurrent instances and peak texture memory on target desktop and Android devices. Prefer reducing duplicate allocations and deterministic lifecycle management over forcing additional layers or contexts.


### Shader initialization and texture-upload follow-up

A further source inspection found two details worth preserving in future optimization work:

- Shader compilation and program linking currently happen synchronously in `WebGL2LutRenderer` construction. The constructor is reached lazily when the image approaches the viewport, so this is not per-frame work, but the first visible initialization can still incur a main-thread wait while `getShaderParameter` / `getProgramParameter` query compile and link status. MDN notes that shader/program status and info-log queries can cause synchronous stalls. Treat asynchronous compilation through `KHR_parallel_shader_compile` as a measured follow-up only: it needs an explicit pending state, extension/fallback handling, and must keep the original image visible until the program is ready.
- The source image currently enters the 2D texture through `texImage2D` only when the source object changes. Do not mechanically replace this with `texStorage2D` + `texSubImage2D`: immutable storage can make allocation behavior more predictable, but DOM-image uploads can have different costs across implementations. Benchmark the actual image-upload path before changing it. The 3D LUT already uses immutable `texStorage3D` allocation followed by `texSubImage3D` updates.

These are source-level candidates, not confirmed performance defects. No runtime trace or GPU timing is available, so no renderer code was changed in this pass.

### Expanded source-level inventory (2026-11-20)

The following paths extend the initial inventory. These are source observations and migration candidates, not proof of paint cost, compositor promotion, or GPU execution. Runtime classification remains **not measured** until comparable browser traces are captured.

| Area | Source paths | Current behavior / migration boundary |
|---|---|---|
| Global CSS motion | `app/globals.css` | Defines fade, slide, dialog, header marquee, node perimeter orbit, port wakeup, popover entry/exit, and reduced-motion rules. Transform/opacity keyframes are compositor candidates; animated conic gradients, masks, backdrop filters, and custom properties require browser traces. Preserve all keyframes and reduced-motion behavior. |
| Native View Transitions | `components/motion/theme-toggle-config.ts`, `components/motion/theme-toggle.tsx`, `styles/view-transitions.css` | Rectangle/circle/circle-blur/blinds effects use `clip-path`, `filter`, mask and a registered custom property. Keep exact geometry, timing, origin, theme synchronization, and interruption semantics; do not remove blur in the full tier. |
| Shared Motion primitives | `components/MotionProvider.tsx`, `components/motion/action-swap.tsx`, `components/motion/action-swap-variants.ts` | Existing Motion 14 runtime and lazy `domMax` feature loading. Audit animated properties and per-frame state updates; do not replace the runtime or change variant selection without profiling. |
| Loader family | `components/motion/loader.tsx`, `components/motion/loader-shapes.tsx` | Geometric variants use Motion animations, including transform/opacity and other shape-specific properties. ASCII variants update React state from an interval and change glyph content; a texture-only replacement would alter DOM semantics and is not automatically equivalent. |
| Color picker | `components/motion/color-picker.tsx` | Uses MotionValues/springs for interactive cursor/thumb/loupe behavior. Inspect the spring update path and reveal effects; preserve drag response and the exact visual easing. |
| Slider family | `components/motion/dashboard-slider.tsx`, `components/motion/range-slider*.tsx` | Uses MotionValues/springs and transform-driven fills/thumbs across variants. Preserve track geometry, bubble/ruler/wave behavior, and input semantics; avoid React state per pointer sample. |
| Dock and expandable navigation | `components/motion/dock.tsx`, `components/motion/expandable-tabs.tsx`, `components/motion/expandable-tabs-layout.tsx` | Motion-driven panel and active-indicator transitions with translucent/backdrop surfaces. Profile large-area blur, layer count, and animation properties; no blanket layer promotion. |
| Canvas/Workflow viewport | `features/iot/components/canvas/sheetViewportAnimator.ts`, `useSheetViewportGestures.ts`, `CanvasWorkspace.tsx`, `canvasGeometry.ts` | rAF computes flight, focal zoom, and inertia; imperative DOM writes update world/grid transforms and zoom labels. Static-target flights may be candidates for native WAAPI; dynamic focal zoom/inertia require equivalent retargeting and live readouts. Grid spacing changes at zoom thresholds and may repaint. |
| Canvas node motion | `features/iot/components/canvas/nodeMotion.ts`, `useCanvasNodeInteractions.ts`, `CanvasGroupNode.tsx`, `CanvasSegmentNode.tsx` | Pointer-driven tilt/translation is written to non-inherited transform properties on cached node elements. The pan path loops over visible nodes; measure DOM write volume and compositing cost before changing it. |
| Canvas wire effects | `features/iot/components/canvas/CanvasWiresLayer.tsx`, `components/motion/composited-bezier-particle.tsx` | Bezier paths are sampled on geometry changes and animated through WAAPI transform/opacity. Verify compositor execution and memory cost with realistic node/particle counts. |
| Node perimeter and port effects | `features/iot/components/canvas/NodePerimeterSpark.tsx`, `app/globals.css` | Two masked conic-gradient layers rotate continuously; port wakeup uses scale/opacity. Perimeter masks/gradients may still require raster work even when the rotation itself is composited. |
| GPU image grading | `components/gpu/GpuLutImage.tsx`, `lib/gpu/webgl2-lut-renderer.ts`, `lib/gpu/lut3d.ts` | Lazy WebGL2 image surface with 3D LUT texture and source-image fallback. The component is not mounted in the live dashboard. Identity LUT data can be generated, but a bit-preserving pass-through shader mode and a deliberate opt-in creative grading integration are still design/implementation work. |

### Baseline status and first migration order

No Chrome DevTools Performance trace, target-device frame-time sample, GPU memory reading, or before/after visual comparison is attached to this repository as of this inventory. Accordingly, all performance impact statements above are source-level hypotheses. The scorecard remains **not measured**.

Recommended investigation order, subject to trace evidence:

1. Capture the existing Canvas/Workflow gesture and animation traces; the rAF viewport loop is the clearest recurring JavaScript frame path.
2. Capture loader and decorative particle/spark scenes under realistic concurrency; distinguish WAAPI compositor work from mask/gradient raster work.
3. Capture theme View Transitions separately for all four variants; preserve the authored effects even if their raster work remains browser-managed.
4. Capture the slider/color-picker and Dock interactions while MQTT state updates are arriving; identify React/DOM work overlapping the frame budget.
5. Audit the existing LUT renderer independently before mounting it anywhere. Identity mode must have a pass-through path for exact source preservation; creative mode stays opt-in and decorative-only.

The next code change must target one measured path at a time. Do not implement a global CSS override, global WebGL screenshot compositor, blanket `will-change`, or blanket Worker conversion.

## GPU memory and WebGL lifecycle constraints (research update)

The browser platform does not expose a portable API for querying the machine's actual dedicated VRAM capacity or the exact physical VRAM currently consumed by a WebGL context. WebGL applications must therefore use conservative estimates, observe allocation failures/context loss, and avoid reporting estimates as measured VRAM. See [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

### Current LUT renderer allocation model

The existing `WebGL2LutRenderer` uses:
- One RGBA8 source texture, uploaded only when the `TexImageSource` identity changes.
- One 3D RGBA16F LUT texture, allocated with one mip level using `texStorage3D`.
- One canvas drawing buffer, sized from the CSS box and device DPR, bounded by the WebGL viewport/renderbuffer limits and 4096 pixels on the longest edge.
- A shader program and VAO; these are driver-managed resources whose physical allocation is not exposed.

Nominal payload estimates (not driver/VRAM measurements):

| Resource | Dimensions / format | Approximate payload |
|---|---|---:|
| Source image texture | 4096 × 4096 × RGBA8 | 64 MiB |
| 3D LUT texture | 64 × 64 × 64 × RGBA16F | 2 MiB |
| Canvas color buffer | 4096 × 4096 × 4 bytes | 64 MiB |
| **Nominal total** | **One source + LUT + one color buffer** | **130 MiB** |

This estimate excludes decoded source-image memory, browser/driver staging copies, implementation-specific padding/alignment, compositor surfaces, possible buffering, and any extra copies. The actual footprint may be materially higher or lower. Do not present 130 MiB as actual VRAM usage.

The renderer currently caps source dimensions at 4096×4096 and caps its drawing buffer's longest edge at 4096. It also limits the LUT edge length to 64. These are source-level safety ceilings, not a validated device budget. Keep the output backing size tied to the actual CSS box and device pixel ratio; do not reduce it to improve FPS without explicit approval because that would reduce image output resolution.

### Allocation and lifecycle rules

1. Keep the existing one-context-per-renderer ownership model; do not create a context per dashboard node or decorative element.
2. Keep `texStorage3D` with a single mip level for the 3D LUT. The source and LUT surfaces are 2D/3D image processing inputs, not minified 3D scene textures that automatically benefit from mipmaps.
3. Release texture, VAO, and program handles deterministically on disposal. Deleting a WebGL handle does not guarantee immediate physical reclamation until the implementation no longer uses the underlying object.
4. Treat `webglcontextlost` and `OUT_OF_MEMORY` as expected recoverable failure modes. Preserve the original-image fallback and never make the dashboard dependent on successful WebGL allocation.
5. Do not poll `getError()`, `getParameter()`, or GPU completion synchronously in the animation/render hot path. Query static limits at initialization only when needed, and do not mistake those limits for available VRAM.
6. Avoid CPU pixel readback in interactive rendering. A synchronous `readPixels()` round trip can force GPU completion and stall the pipeline; prefer GPU-to-GPU operations where applicable.
7. Use `texStorage*` for immutable texture storage and reuse allocations. Benchmark upload paths before replacing `texImage*` with `texSubImage*`; the API choice alone does not guarantee faster image uploads.
8. Do not request reduced-resolution backing buffers or lower-quality texture formats as an automatic performance fallback. Any quality tier that changes resolution, antialiasing, color precision, or image quality violates the current product constraint.
9. On context restoration, rebuild program, VAO, source texture, and LUT texture from retained CPU-side source data. A lost context invalidates all previous WebGL handles.
10. Keep GPU telemetry honest: report browser-exposed diagnostics and estimated payload separately, and mark unavailable values as `not exposed`.

### Rendering-path implications

- CSS/WAAPI `transform` and `opacity` are the primary compositor candidates, but DevTools must confirm that a particular animation is actually composited. [Chrome Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) exposes compositor failure reasons, GPU activity, raster activity, and frame classifications.
- Blur, masks, clip-path, gradients, and filters remain property- and browser-dependent. Do not remove or simplify them; use Paint Flashing and the Paint Profiler to identify whether they cause repeated raster work. [web.dev animation guidance](https://web.dev/articles/animations-guide).
- A composited layer still consumes rasterized texture memory and upload bandwidth. Promoting every element can increase memory pressure and make performance worse. Use `will-change` only for a measured issue and remove it after the relevant animation window.
- The dashboard's DOM-based Canvas/Workflow is not a canvas drawing surface. `OffscreenCanvas` is relevant only to actual canvas renderers; it cannot move React, DOM layout, DOM text, or arbitrary HTML into a Worker.

### Research references

- [MDN — WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [Chrome DevTools — Performance features reference](https://developer.chrome.com/docs/devtools/performance/reference)
- [web.dev — High-performance CSS animations](https://web.dev/articles/animations-guide)
- [web.dev — Rendering pipeline and animation overview](https://web.dev/articles/animations-overview)

All values above are based on source-level dimensions and nominal format sizes. No target-device GPU memory or frame-time measurements have been collected yet.
## Canvas viewport animation: source-level execution map

The infinite-sheet Canvas/Workflow viewport is a DOM-based scene, not a WebGL canvas. The current path in `features/iot/components/canvas/sheetViewportAnimator.ts` is an imperative `requestAnimationFrame` loop:

| Operation | Current execution | Optimization implication |
|---|---|---|
| Flight easing and interpolation | JavaScript callback on the main thread each frame | The camera trajectory is not currently an autonomous declarative compositor animation |
| Smooth focal zoom | JavaScript reads the current viewport, calculates interpolation, and submits styles each frame | Target changes and focal anchoring make this a dynamic trajectory |
| Pan inertia | JavaScript updates velocity, decay, and position each frame | The motion is input-derived and cannot be replaced with a fixed CSS transition without preserving its dynamic physics |
| World plane | Per-frame `style.transform` update | Transform is eligible for compositor handling, but the JavaScript producer still runs on the main thread |
| Dot grid | Per-frame transform update; background tile size changes only when the visual step changes | Transform may composite; tile-size changes can require style/paint/raster work |
| Zoom readout | DOM text is updated when its rounded percentage changes | This remains a main-thread DOM write, although it avoids a React render pass |
| Pointer pan | Latest pointer event is coalesced into one rAF callback | Existing batching prevents redundant updates within a frame |

### Why not replace the whole camera with WAAPI immediately?

A finite flight has a known start, target, and duration, so it is a possible candidate for a declarative transform animation. Smooth focal zoom changes its target as wheel input arrives; inertia integrates live velocity and frame delta. Replacing those modes with fixed keyframes or CSS transitions could change interruption behavior, focal-point locking, velocity response, or frame-rate independence.

A future WAAPI experiment must therefore be isolated to finite flights first and must preserve:
- The exact existing `easeOutCubic` trajectory and duration.
- Interruption/cancellation semantics when a new pointer or wheel gesture begins.
- The final viewport commit and persistence behavior.
- Synchronization of the dot grid and zoom readouts.
- Reduced-motion behavior and all existing visual states.

Do not migrate smooth zoom or inertia to a fixed transition as a shortcut. Do not remove the grid, readout, or effects. Keep the existing rAF implementation as the fallback until browser traces prove the candidate path is composited and visual equivalence is confirmed.

### Measurement needed before further changes

Record the same pan, flight, wheel-zoom, pinch, and inertia scenarios from `GPU-BASELINE-CAPTURE.md`. Inspect Main, Compositor, Raster/Thread Pool, and GPU tracks, plus frame classifications. A low Main-thread time or an FPS counter alone does not establish that every update was compositor-driven. Chrome's RenderingNG documentation explains that the pipeline can skip layout/pre-paint/paint for eligible visual effects, while scripts and DOM mutation remain main-thread work.

Research:
- [Chromium RenderingNG architecture](https://developer.chrome.com/docs/chromium/renderingng-architecture)
- [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference)
- [web.dev — Smoothness](https://web.dev/articles/smoothness)
- [MDN — requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

This is a source-level execution map, not a measured performance finding. No FPS, frame-time, CPU utilization, or GPU memory values are inferred from source inspection.


## Exact identity-LUT pass-through

- `isIdentityLut()` recognizes only a byte-for-byte Float32 identity grid with the standard [0, 1] domain; approximate or creative LUTs are never treated as identity.
- `GpuLutImage` skips WebGL context creation for an identity LUT or non-positive intensity and keeps the original browser image visible. If a live surface changes back to identity, its renderer resources are disposed and the WebGL overlay is hidden immediately.
- This avoids source texture upload, LUT texture allocation/upload, shader execution, and an unnecessary GPU context for a no-op color transform. It also avoids precision changes from sampling an identity 3D texture. It does not claim to move DOM image decoding or browser UI work to the GPU.
- The identity check is performed when the LUT/intensity inputs change, not per animation frame. A creative LUT continues to use the existing WebGL2 shader path.


## Canvas viewport: redundant style-write elimination (20 November 2026)

- `applyViewportToDom()` now compares the next world-plane transform and grid transform with the current inline style before assigning them. The legacy container-grid fallback similarly compares `backgroundSize` and `backgroundPosition` before writing.
- This is a behavior-preserving main-thread micro-optimization: it avoids redundant CSSOM/style invalidation when the same viewport is applied repeatedly (for example, duplicate final/idle synchronization). It does not move the camera interpolation loop off the main thread and does not claim GPU-only execution.
- The existing transform strings, grid spacing thresholds, dot radius, readout text, easing, inertia, and focal zoom calculations are unchanged. No effect, animation, or transition was removed or added.
- Validation is source-level only in this change. Compare browser Performance traces before/after; expected benefit is limited to repeated identical viewport applications, not the per-frame work when values genuinely change.


## Non-blocking LUT shader initialization

- `WebGL2LutRenderer.create(canvas)` now initializes the renderer asynchronously. When `KHR_parallel_shader_compile` is available, shader compile/link work is submitted first and program completion is polled through `COMPLETION_STATUS_KHR` on animation frames; the potentially blocking `LINK_STATUS` query is made only after completion.
- Browsers without the extension retain the existing synchronous compile/link validation path as a compatibility fallback. The extension is not Baseline across all browsers, so this is progressive enhancement, not a requirement for rendering.
- `GpuLutImage` guards async initialization against unmount and WebGL context loss, disposes a renderer that completes after the surface switches to identity pass-through, and retains the original image fallback while the program is compiling.
- This optimization targets shader startup stalls only. It does not change shader source, LUT sampling, texture format, output pixels, animation timing, or dashboard UI. Parallel compilation can reduce main-thread blocking but does not guarantee a shorter total compile duration.
- Source-level change only. Verify extension support and startup responsiveness in target browsers; no runtime FPS or VRAM improvement is claimed.


## Canvas zoom readout empty-cache fast path (20 November 2026)

- `applyViewportToDom()` now returns from the readout-update section when the caller supplies a primed empty cache. This avoids repeating a document-wide `querySelectorAll` on every animation frame when the active canvas has no zoom-readout badges.
- A `null` cache still means "not primed" and retains the one-off DOM discovery fallback. Non-empty cached readouts keep the existing update path. Viewport transforms, grid calculations, zoom values, animation timing, and visible output are unchanged.
- This is a source-level hot-path reduction; its benefit is workload-dependent and should be confirmed in a Performance trace. No FPS or VRAM improvement is claimed.


## Shared Bezier keyframes for paired signal particles

- `CompositedBezierParticle` now caches generated transform/opacity keyframes in a `WeakMap` keyed by the immutable-by-convention curve object. The two signal particles rendered for the same active Canvas/Workflow wire receive the same curve reference, so Bezier sampling, arc-length calculation, and keyframe string generation happen once per shared curve instead of once per particle.
- The cache is weakly keyed, so geometry entries can be reclaimed when the owning curve object becomes unreachable; it does not create an unbounded strong-reference cache.
- Animation duration, delay, iteration count, easing, transform/opacity keyframes, particle count, and rendered appearance are unchanged. Each DOM element still owns its own WAAPI Animation instance.
- This reduces duplicate initialization work and allocations; it does not move keyframe generation to the GPU or change per-frame compositor behavior. Runtime benefit depends on active wire count and should be profiled on target devices.


## Shared Canvas wire geometry (20 November 2026)

- `CanvasWiresLayer` now derives each valid connection's Bezier geometry once in a memoized map keyed by connection ID and passes the same immutable geometry object to both the static SVG wire and the optional signal-particle layer.
- Previously, the static wire and particle component each called `buildBezierWireGeometry` independently for the same connection. The shared result avoids duplicate endpoint/control-point calculations and SVG path-string allocation on renders where the connection/node inputs change.
- Geometry values, SVG path data, endpoint positions, stroke styling, particle motion, and UI are unchanged. The memo recomputes when the connections array or node map identity changes; it does not cache stale geometry across changed inputs.
- This is a CPU-side duplicate-work reduction, not GPU migration. Validate with a browser Performance trace on large canvases; no FPS or VRAM improvement is claimed without measurement.


## Shared Workflow edge geometry

- `WorkflowWiresSvg` now memoizes each valid edge's Bezier geometry from its source/target port anchors and resolved input-port index. The same geometry object is passed to the SVG edge renderer and the active-edge signal particles.
- This removes duplicate `getPortAnchor` and `buildWorkflowBezierPath` work for active edges and avoids rebuilding identical SVG path strings in the particle overlay. The geometry map is recomputed when the edge list, node map, or resolved port-index map changes.
- Path coordinates, midpoint cut controls, edge hit areas, hover/selection styling, particle count, timing, and visible UI remain unchanged. This is a main-thread computation reduction, not a claim that SVG rendering moved to the GPU.


- Workflow connection drafting now computes the current draft Bezier geometry once per render and shares it between the visible SVG draft wire and its optional magnetic-target signal particle. Pointer-driven geometry still updates on every draft position change; this only removes duplicate calculation for the same frame. Visual path, endpoints, magnetic styling, and particle timing are unchanged.


## Compositor layer budget and animation property policy

- Prefer the existing compositor-candidate `transform` and `opacity` paths for continuous motion. Changes to layout properties (for example `width`, `height`, `top`, `left`, `margin`) can trigger layout; paint-heavy properties such as animated shadows and blur may still require raster/paint work.
- Do not add blanket `will-change`, `translateZ(0)`, or `transform-gpu` to every dashboard element. A promoted layer consumes graphics memory and compositor bookkeeping; excessive layers can increase memory pressure and hurt performance. Keep promotion scoped to elements that are actively moving, as the existing Canvas node drag behavior does.
- Keep always-running marquee hints only on the marquee that is actually animating. For transient interactions, enable promotion shortly before the animation and release it afterward. Do not use `will-change` as a substitute for profiling.
- Validate with Chrome DevTools Performance (Main, Compositor, Raster and GPU tracks) and Rendering → Paint flashing. Confirm whether a candidate avoids layout/paint and whether layer count/memory remain reasonable; a CSS property alone cannot guarantee hardware-GPU execution or dedicated VRAM allocation.
- No visual or source behavior was changed by this policy note. References: [MDN CSS performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS), [MDN will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change), [Chrome compositor-only properties and layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count), [Chrome RenderingNG](https://developer.chrome.com/docs/chromium/renderingng-architecture).

### User Performance Trace baseline (2026-11-20)

Analyzed `Trace-20261120T224646.json.gz` from Chrome DevTools. This capture is useful as an initial baseline, but it does **not** represent the requested 1920×1080 target: the recorded page viewport was 1149×912 CSS pixels at DPR 1.25 (approximately 1436×1140 device pixels). The trace covers approximately 5.51 seconds.

Observed in the primary Renderer compositor pipeline:

- 333 frame reports: 205 `STATE_PRESENTED_ALL`, 102 `STATE_PRESENTED_PARTIAL`, 7 `STATE_DROPPED`, and 19 `STATE_NO_UPDATE_DESIRED`.
- Four explicit `DroppedFrame` events were recorded.
- The main thread had two tasks longer than 50 ms: approximately 172.2 ms and 51.9 ms. The 172.2 ms task contains a roughly 100.7 ms `FunctionCall` in a minified application chunk; the trace has no source maps, so this call cannot yet be attributed reliably to a source module.
- A `RunMicrotasks` slice reached approximately 71.4 ms; a `Layout` slice reached approximately 33.0 ms.
- 399 `GPUTask` events were recorded, totalling approximately 187.4 ms with a maximum individual duration of 8.69 ms. These event durations are not a GPU-utilization percentage and do not expose physical VRAM usage.
- The primary renderer pipeline reported 269 frames with main-thread animation and 112 with compositor animation. These flags are not additive and do not identify individual dashboard effects.

This trace is a short mixed-activity capture, not a controlled 60/120/144 Hz animation benchmark. It does not establish a sustained FPS value or prove that the Canvas viewport animator caused the long task. Do not change a visual animation based on this trace alone. The next useful capture should use the target display resolution and DPR, isolate one repeatable interaction (for example Fit View, wheel zoom, or pan/inertia), and record the same interaction before and after any implementation change. Enable source maps in a development profiling build if source-level attribution is needed.

### Source-mapped profiling builds

The initial user trace contains a 100.7 ms `FunctionCall` in the deployed minified chunk `1irek62w6m78r.js` (reported function name `z`) and a 71.4 ms `RunMicrotasks` slice. The trace does not contain source maps, so the function cannot yet be attributed to an authored module. Do not infer that this is the Canvas animator or a GPU-rendering bottleneck.

For a diagnostic static export with authored function/file attribution, run the **Profiling build (source maps)** GitHub Actions workflow manually from the Actions tab. It builds with `ENABLE_PROFILING_SOURCEMAPS=true`, verifies that maps exist, and uploads the static site as a seven-day artifact; it does not deploy the artifact to GitHub Pages. Alternatively, build locally with:

```sh
ENABLE_PROFILING_SOURCEMAPS=true bun run build
```

To profile the downloaded artifact locally, extract it and serve the export directory (for example, `python3 -m http.server 4173 --directory out`), then open `http://localhost:4173`. The opt-in sets Next.js `productionBrowserSourceMaps`; the normal build remains unchanged and does not emit production browser source maps. Record a new trace and save it with **Include resource content**, **Include script source maps**, and **Compress with gzip** enabled. Treat the artifact and trace as source-bearing project material. Never copy the profiling artifact into the Pages deployment.

The next trace should isolate one repeatable Canvas action and use the target display mode. Compare the same action before/after; source attribution alone is not evidence of an optimization.


### Pan inertia threshold constant folding (2026-11-20)

- Precompute the squared stop-speed threshold once at module initialization and compare each frame's squared velocity against that constant. This removes two repeated multiplications from the inertia frame callback while preserving the exact threshold, friction, integration, rounding, and stop behavior.
- This is a source-level hot-loop reduction only. The inertia loop still runs on the main thread and submits DOM updates; it does not establish GPU-only execution or a measurable FPS improvement.


### Avoid permanent promotion hints on port wake-up animations (2026-11-20)

- Removed the persistent `will-change: transform, opacity` hint from `.animate-port-wakeup`. The class only applies while the wake-up animation is active; the browser can promote eligible transform/opacity CSS animations as needed.
- This avoids requesting long-lived compositor-layer resources for every matching element. The animation keyframes, duration, easing, opacity, transform, and visual output are unchanged.
- This is a memory-pressure optimization, not a guarantee that a particular browser allocates or releases a specific amount of VRAM. Verify layer count and compositing behavior on target devices when possible.


### Remove redundant permanent marquee promotion hint (2026-11-20)

- Removed the static `will-change: transform` declaration from the continuously animated header marquee track. The active CSS animation already identifies `transform` as an animated property to the browser, so the explicit permanent hint is redundant.
- Kept the existing keyframes, 10-second duration, linear timing, infinite iteration, and backface-visibility declaration unchanged.
- This avoids explicitly requesting long-lived layer preparation; actual compositor promotion and GPU memory allocation remain browser/device decisions and are not guaranteed by CSS.


### Native Popover entry/exit transition audit (2026-11-20)

- The shared `[popover]` rule transitions `opacity` and `transform` over 200ms and uses `display 200ms allow-discrete` for the native open/close lifecycle. The `@starting-style` rule supplies the existing closed-to-open starting values.
- Keep this native CSS transition rather than replacing it with a JavaScript animation loop: opacity/transform are compositor-friendly candidates and avoid per-frame React/DOM writes. Actual off-main-thread execution remains browser- and element-dependent.
- Do not add permanent `will-change` to all popovers. They can be numerous and short-lived; MDN warns that broad or persistent hints increase memory use and can worsen rendering. Preserve the current 200ms duration, easing token, scale (0.96 → 1), opacity, discrete display behavior, and reduced-motion override.


### Theme View Transition effect audit (2026-11-20)

- Audited the four existing theme reveal variants in `components/motion/theme-toggle-config.ts`: rectangular and circular `clip-path` reveals, circular `clip-path + filter: blur()`, and the repeated `mask-image` blinds reveal driven by the registered `--beui-vt-slat` custom property.
- These effects are intentionally retained unchanged. Unlike simple `transform`/ `opacity` animation, `clip-path`, `filter`, animated custom properties, and masks are not a universal compositor-only guarantee; depending on browser, GPU, geometry, and implementation they can require paint/raster work. The temporary `will-change` hints do not guarantee GPU execution or dedicated VRAM allocation.
- Do not replace these reveals with a different effect or reduce blur, duration, origin, mask geometry, or easing to chase a presumed GPU win. Any future renderer migration must reproduce all four variants and be validated visually and with browser compositor/raster traces on supported engines.
- The existing CSS View Transition path remains preferable to introducing a JavaScript per-frame loop. Keep the current animation definitions and use browser-native transition handling; measure before changing the rendering path.
- References: [MDN CSS animation performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS), [MDN `will-change`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change), [Chrome modern motion guidance](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/ui-behaviors/motion/guide.md).


### LUT image-fit math moved from fragment to vertex shader (2026-11-20)

- Moved the invariant canvas/image aspect-ratio calculation and UV letterbox mapping from the per-fragment shader into the fullscreen triangle's vertex shader. The resulting interpolated source UV is affine-equivalent to the previous fragment calculation; source texture sampling, LUT lookup, intensity blend, alpha, texture formats, and draw count are unchanged.
- This removes repeated aspect-ratio division and branching from every output fragment. The calculation now runs for the fullscreen triangle's three vertices and is interpolated across the rasterized surface.
- This is a GPU shader workload optimization, not a claim of lower CPU usage or a measured frame-rate gain. The renderer remains demand-driven and only renders on source/size/LUT changes.
- Visual equivalence and device-specific shader performance have not been runtime-verified in this environment. Keep the original-image fallback and compare output on representative DPR/aspect-ratio combinations before treating the shader change as validated.
- Reference: [MDN WebGL best practices — prefer doing work in the vertex shader](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).


### WebGL shader initialization and hot-path re-audit (2026-11-20)

- Confirmed the renderer now uses `KHR_parallel_shader_compile` when available: shader status checks are deferred until `COMPLETION_STATUS_KHR` reports completion, while browsers without the extension retain the synchronous compile/link fallback. The image component keeps the original image visible while asynchronous renderer creation is pending.
- Confirmed uniform locations are cached during renderer construction, the fullscreen-triangle VAO is created once and reused, LUT storage uses immutable `texStorage3D`, and rendering is demand-driven rather than a permanent animation loop. No per-frame `getError`, `getParameter`, `readPixels`, or `finish` calls were found in the render method.
- Kept the source-image upload path unchanged. MDN recommends considering immutable texture storage, but explicitly notes that DOM-image `texSubImage` uploads can be slower on some implementations; replacing `texImage2D` without device benchmarks could regress first-image latency. The source texture is already reused and uploaded only when the source object changes.
- No additional renderer code change was justified by this source-only pass. Avoid adding a second context, mipmaps for the 2D source image, or a permanent render loop: the current image surface is demand-driven and the source is displayed at its native aspect-fit size.
- Reference: [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).


### Skip unchanged LUT shader uniform uploads (2026-11-20)

- The LUT renderer now caches the last uploaded intensity, canvas dimensions, source dimensions, and all six LUT domain components. It issues each corresponding `uniform*` call only when that value changes.
- This preserves the exact shader inputs and output while avoiding redundant JavaScript-to-WebGL uniform submissions on repeated redraws (for example, ResizeObserver callbacks where dimensions and LUT parameters are unchanged).
- The cache is renderer-instance-local and starts with sentinel values, so the first draw always initializes every uniform. A recreated renderer after context loss also initializes all uniforms on its first draw.
- This reduces redundant API calls, not shader work or guaranteed CPU time; the renderer remains demand-driven and no runtime benchmark or trace was available.


### Coalesce demand-driven LUT redraws (20 November 2026)

- `GpuLutImage` now coalesces redraw triggers from image load, ResizeObserver, viewport visibility, window resize, DPR changes, visibility restoration, and LUT/intensity updates into one `requestAnimationFrame` callback. This prevents multiple synchronous WebGL resize/render submissions when several browser notifications arrive in the same frame.
- The renderer remains demand-driven: there is no permanent animation loop, and no additional frames are requested after the queued draw completes. A pending callback is cancelled during unmount; the original image remains the fallback during initialization and context loss.
- The shader, LUT data, texture formats, output resolution policy, image fit, transition, and visible UI are unchanged. This is a source-level scheduling optimization; runtime CPU, GPU, FPS, and VRAM gains have not been measured.


### Avoid persistent compositor hints on every wave-slider bar (2026-11-20)

- Removed the always-on `will-change: transform`, `backface-visibility: hidden`, and `translateZ(0)` hints from the 32 wave-slider bars. Their animated property remains `transform: scaleY(...)`, which is eligible for compositor handling during the existing CSS transition.
- This avoids explicitly requesting a persistent layer for every decorative bar when the slider is idle; the browser can promote transitioning elements as needed. It preserves bar count, geometry, scale values, colors, easing, delays, reduced-motion behavior, and interaction semantics.
- This is a GPU-layer memory hygiene change, not a measured VRAM or FPS improvement. Browser layer promotion remains implementation-dependent; verify on representative devices if compositor traces become available.
- References: [MDN CSS animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance), [web.dev animation overview](https://web.dev/articles/animations-overview).


### Restrict Newton loader layer hints to animated balls (2026-11-20)

- The Newton loader renders five balls, but only the two outer balls animate in the normal motion mode. The three stationary middle balls no longer receive `will-change: transform`; reduced-motion mode also avoids transform-layer hints because the balls are static and only the loader's reduced-motion behavior applies.
- Animation values, timing, positions, ball count, and appearance are unchanged. This avoids explicitly requesting compositor resources for three elements that never transform. Actual layer allocation remains browser-dependent and no runtime VRAM/FPS measurement is available.
- Reference: [web.dev high-performance CSS animations](https://web.dev/articles/animations-guide).


### Helix loader reduced-motion layer hints (2026-11-20)

- The Helix loader's fourteen particles animate `transform` only in normal-motion mode. In reduced-motion mode they animate opacity only, so the two particle elements per row no longer request `will-change: transform` in that mode.
- Particle count, positions, opacity timing, normal-motion transforms, and reduced-motion visuals are unchanged. This avoids unnecessary transform-layer hints when no transform animation is active. Browser layer allocation is implementation-dependent; no runtime GPU-memory or FPS measurement is claimed.
- Reference: [MDN `will-change`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change).


### Avoid inactive compositor hints in Comet and Bubble Slider (2026-11-20)

- The Comet loader now requests a transform layer only in normal-motion mode; reduced-motion mode animates opacity and no longer requests a transform hint for its wrapper.
- The Bubble Slider thumb no longer forces an additional `will-change: transform` layer. Its horizontal movement remains on the existing parent Motion transform, while the thumb's scale interaction remains an ordinary transform animation that the browser can promote when appropriate.
- Visible animation values, timing, geometry, pointer behavior, and reduced-motion behavior are unchanged. This is a source-level reduction in explicit layer requests, not a measured GPU-memory/FPS improvement. Browser layer promotion is implementation-dependent.
- References: [web.dev animation guide](https://web.dev/articles/animations-guide), [MDN `will-change`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change).


### Keep transient workspace swipe coordinates out of React state (2026-11-20)

- `features/dashboard/hooks/useWorkspaceSwipe.ts` stores touch-start and touch-move coordinates in refs instead of React state. Touch-move events therefore no longer schedule React renders solely to retain the latest pointer coordinates; the same swipe threshold, axis-dominance check, group ordering, and selection callback remain in place at touch end.
- This reduces avoidable main-thread React work during touch gestures. It does not change rendered UI or move gesture recognition to the GPU; gesture event handling still runs on the main thread.
- Reference: [Vercel React Best Practices — transient values in refs](https://github.com/vercel/react-best-practices).


### Coalesce Color Picker pointer updates to the display frame (2026-11-20)

- The shared Color Picker drag hook now retains only the latest pointer coordinates and applies at most one color update per `requestAnimationFrame`, rather than updating React context state for every delivered `pointermove` event.
- Pointer-down remains immediate, and pointer-up flushes its final coordinates synchronously before committing. Pointer cancellation, lost capture, window blur, and unmount cancel pending frames so stale movement cannot be applied after a gesture ends.
- The same coordinate mapping, color values, interaction model, and spring behavior are preserved. This reduces redundant main-thread React work when input events arrive faster than the display can paint; it does not make color math GPU work. No runtime FPS or INP measurement is claimed.
- References: [React `useRef`](https://react.dev/reference/react/useRef), [MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [MDN `pointermove`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event).
