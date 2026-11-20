# GPU Rendering Baseline Capture

**Date:** 2026-11-20  
**Related plan:** [001 — GPU-first rendering](../../plans/001-gpu-first-rendering.md)  
**Status:** Capture procedure; no runtime measurements have been recorded.

## Purpose

Collect reproducible browser evidence before changing animation or rendering code. A source audit can identify candidates, but cannot establish actual compositor promotion, GPU raster activity, frame pacing, or GPU memory usage.

## Test environment record

Record these values with every capture:

- Device model and GPU model (if known).
- OS and graphics driver version.
- Browser name and exact version.
- Dashboard commit SHA and whether the build is production or development.
- Display resolution and refresh rate as configured in the OS.
- Browser viewport in CSS pixels, zoom percentage, and `window.devicePixelRatio`.
- Power mode (battery/performance), external display status, and whether hardware acceleration is enabled.
- Whether DevTools was docked or undocked.
- Dashboard state: theme, active workspace, visible node/connection count, open panels, and test data source.

Do not infer the display refresh rate from the FPS overlay. Record the configured display mode separately.

## Chrome DevTools capture

1. Open the dashboard in Chrome/Chromium and wait for initial loading, fonts, images, and device state to settle.
2. Open DevTools → **Performance**.
3. Enable screenshots only if useful for correlating visual state; screenshots add overhead, so use the same setting for all before/after captures.
4. Start recording, perform exactly one scenario below, then stop recording.
5. Save the trace using the Performance panel's export/save control. Keep the original trace file; do not edit or reserialize it.
6. Repeat each scenario three times after one warm-up run. Keep the same test sequence and timing.
7. Do not use the trace from a DevTools-open run as a direct comparison with a DevTools-closed run.

## Scenarios

Capture each scenario separately:

| ID | Scenario | Sequence |
|---|---|---|
| CANVAS-PAN | Canvas pan | Pointer down on empty canvas, pan continuously for 8 seconds, release |
| CANVAS-ZOOM | Focal zoom | Zoom in/out around at least three different focal points for 8 seconds |
| CANVAS-FLIGHT | Fit/flight | Trigger fit view and any existing viewport flight 5 times, allowing each to finish |
| CANVAS-INERTIA | Pan inertia | Perform the same quick pan gesture and release 5 times |
| CANVAS-NODE | Node drag | Drag a node around the workspace for 8 seconds, then release |
| PARTICLES | Bezier + perimeter | Show a representative workspace with active wires and perimeter effects for 10 seconds |
| THEME-RECT | Theme rectangle | Trigger the existing rectangle theme transition 3 times |
| THEME-CIRCLE | Theme circle | Trigger the existing circle theme transition 3 times |
| THEME-BLUR | Theme circle blur | Trigger the existing circle-blur theme transition 3 times |
| THEME-BLINDS | Theme blinds | Trigger the existing blinds theme transition 3 times |
| CONTROLS | Loader/slider/color picker/Dock | Exercise each existing control independently for 8 seconds |
| MQTT-OVERLAP | Live state overlap | Repeat CANVAS-PAN and PARTICLES while representative device state updates are arriving |

Do not alter the visual settings, animation speed, or dashboard density to make a capture easier.

## Rendering diagnostics

Open DevTools → More tools → **Rendering** and inspect these overlays in separate diagnostic runs:

- **Frame Rendering Stats:** observe real-time FPS, successful/partially presented/dropped frames, GPU raster status, and GPU memory usage where Chrome exposes them.
- **Paint Flashing:** identify regions that repaint during animation. Keep this run separate from baseline traces if overlay overhead is material.
- **Layer Borders:** inspect layer count and layer churn. A larger layer count is not inherently better.
- **Scrolling Performance Issues:** inspect only during scroll/gesture scenarios where relevant.

In the Performance recording:

- Inspect **Frames** for frame duration and dropped/partially presented frames.
- Inspect **Main** for scripting, style recalculation, layout, paint, and long tasks.
- Inspect **Compositor** and **GPU** tracks where present.
- Inspect **Raster** / Thread Pool activity.
- Select animations and inspect compositing failure reasons when Chrome exposes them.
- Compare the same time window and scenario across baseline and candidate captures.

## Refresh-rate budgets

These are theoretical per-frame budgets, not promises that the application can force a display mode:

| Refresh rate | Frame interval |
|---:|---:|
| 60 Hz | 16.67 ms |
| 90 Hz | 11.11 ms |
| 120 Hz | 8.33 ms |
| 144 Hz | 6.94 ms |
| 165 Hz | 6.06 ms |
| 240 Hz | 4.17 ms |

A frame must fit within the browser's actual presentation schedule, shared with browser, OS, compositor, and other application work. An animation's measured FPS must not be interpreted without the configured display refresh rate and dropped-frame data.

## Result template

Append one row per scenario and capture:

| Scenario | Run | Browser/device | Refresh | Viewport/DPR | Frame-time p50/p95 | Dropped frames | Main-thread work | Paint/Raster | GPU activity/memory | Trace file |
|---|---:|---|---:|---|---:|---:|---|---|---|---|
| — | — | — | — | — | not measured | not measured | not measured | not measured | not measured | — |

Only fill fields visible in the trace or diagnostic overlay. If GPU memory or GPU activity is unavailable, write `not exposed`, not zero. If a trace cannot distinguish CPU rasterization from GPU rasterization, state that limitation.

## Comparing before and after

- Use the same physical device, display mode, browser version, OS power mode, viewport, DPR, dashboard data, theme, and gesture sequence.
- Compare three warmed-up runs; report median and spread, not the best run.
- Check frame pacing and dropped frames, not just average FPS.
- Inspect the Main, Compositor, Raster, and GPU tracks together. A low Main-thread time alone does not prove GPU-only rendering.
- Check for layer and texture memory growth during repeated open/close, theme changes, route changes, and context restoration.
- Confirm visual equivalence at the same viewport and DPR. Any visual difference, even if the frame rate improves, blocks the migration until resolved.
- Do not compare traces recorded with different DevTools overlays or different screenshot settings.

## What this capture cannot prove

- It cannot prove every pixel resides exclusively in dedicated VRAM.
- It cannot prove the CPU performs no work. React, DOM, event handling, style/layout, image decoding, command submission, and browser coordination remain CPU responsibilities.
- It cannot force Chrome, the operating system, the GPU driver, or the physical display to present at 120 Hz.
- Browser-reported GPU memory is diagnostic telemetry, not a guaranteed physical VRAM allocation figure.

## References

- [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference)
- [Chrome DevTools rendering performance diagnostics](https://developer.chrome.com/docs/devtools/rendering/performance)
- [web.dev: Rendering performance](https://web.dev/articles/rendering-performance)
- [web.dev: High-performance CSS animations](https://web.dev/articles/animations-guide)
