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
- Uses a device-pixel-ratio cap of 2 and a 4096-pixel maximum output edge to bound framebuffer allocation. A 4096×4096 RGBA8 source texture can still consume up to 64 MiB, so avoid mounting multiple large surfaces concurrently.
- Reuses the source texture when only LUT intensity or surface dimensions change; LUT data is re-uploaded only when its typed-array reference changes. Output dimensions are capped at 4096 pixels per edge.
- Creates the context only when the surface approaches the viewport; it does not keep an animation loop alive.
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
| Infinite Canvas / Workflow viewport (`features/iot/components/canvas/sheetViewportAnimator.ts`) | `requestAnimationFrame` computes flight easing, focal zoom smoothing, and pan inertia; writes world/grid transforms and zoom readouts | Transform compositing can be GPU-backed, but JS still calculates per-frame values and updates readout text. Moving interpolation off the main thread must preserve live zoom readouts, focal anchoring, inertia decay, cancellation, and final committed viewport. |
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
