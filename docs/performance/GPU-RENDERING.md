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
- LUT edge length is bounded to 2–64. Texture storage is RGBA8 with linear filtering and clamp-to-edge addressing.
- Approximate 3D LUT texture allocation (no mipmaps): 17³ = 19.2 KiB, 33³ = 140.4 KiB, 64³ = 1 MiB.
- LUT rows use the standard .cube order: red changes fastest, then green, then blue.
- The LUT is expected to use the same RGB encoding convention as the source texture. This first version does not add an implicit linear-light / sRGB conversion pass.

## GPU and lifecycle rules

- Requests WebGL 2 with `powerPreference: "high-performance"` and `failIfMajorPerformanceCaveat: true`. Browser and operating-system policy still decide which physical adapter executes the context; web code cannot guarantee a particular GPU.
- Uses one fullscreen triangle and a fragment shader. The 3D lookup and interpolation run in the graphics pipeline.
- Does not read rendered pixels back to JavaScript.
- Does not allocate mipmaps or poll GPU state in the render path.
- Uses a device-pixel-ratio cap of 2 for the output canvas to bound framebuffer allocation.
- Creates the context only when the surface approaches the viewport; it does not keep an animation loop alive.
- Releases textures, vertex array, and program on unmount. Recreates resources after `webglcontextrestored`.
- If WebGL 2 is unavailable, context creation fails, or rendering throws, the original image remains visible.

## Integration policy

Use this renderer only for non-semantic decorative imagery (ambient artwork, visual backdrops, or media previews). Do not color-grade the entire dashboard or apply a LUT to live device status, warnings, switches, text, charts, or theme tokens. Color semantics and accessibility contrast must remain deterministic.

Do not add one WebGL context per small UI element. Prefer a single shared surface for each genuinely independent visual scene. Before global integration, profile GPU memory, compositing, frame time, and context count on desktop and mobile devices.

## Verification status

Source implementation only. The component is not mounted in the live dashboard yet; no runtime GPU trace, visual comparison, memory measurement, or context-loss exercise has been recorded. Do not describe this engine as production-verified until those checks are completed.
